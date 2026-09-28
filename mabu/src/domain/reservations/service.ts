import type { ServiceContext } from '../context';
import { audit, nowIso, requireFlag, requireOwnerOrStaff, requireRole } from '../context';
import type { Actor } from '../guests/types';
import type { PaymentsService } from '../payments/service';
import { DomainError } from '../shared/errors';
import { idempotent } from '../shared/idempotency';
import { addDays, venueDate } from '../shared/time';
import { assertContact, cleanNote } from '../shared/validation';
import { DEFAULT_BOOKING_POLICY, depositFor, type BookingPolicy } from './policy';
import { assertQueryAllowed, isOpenOn, parseSlotId } from './slots';
import { ACTIVE_STATUSES, isActive } from './status';
import type {
  AvailabilityQuery,
  PolicyOutcome,
  ReservationCreateRequest,
  ReservationEventType,
  ReservationProvider,
  ReservationProviderId,
  ReservationRecord,
  ReservationSlot,
  StaffNote,
  WaitlistEntry,
} from './types';

export const NO_AVAILABILITY_MESSAGE =
  'That time is currently unavailable. Try another time or request a reservation.';

export type DayState = 'available' | 'full' | 'closed';

export interface AmendPatch {
  occasion?: ReservationRecord['occasion'];
  occasionNote?: string;
  seatingPreference?: string;
  dietaryNotes?: string;
  accessibilityNotes?: string;
  specialRequest?: string;
}

/**
 * The reservation lifecycle (§30, §44): search, create, confirm, amend,
 * reschedule, cancel, waitlist, complete and no-show.
 *
 * Safety rules (§33) and where they are enforced:
 *   - never show an unverified table   → slots come only from the provider,
 *                                        and create() re-verifies the slot
 *   - never duplicate on retry          → every change takes an idempotency key
 *   - recoverable provider failures     → nothing is persisted until the provider says yes
 *   - webhooks stored and de-duplicated → ingestWebhook()
 *   - deposits reconcile independently  → PaymentsService owns payment state
 *   - rules configurable, not in the UI → BookingPolicy document
 */
export class ReservationsService {
  constructor(
    private readonly ctx: ServiceContext,
    private readonly providers: Record<ReservationProviderId, ReservationProvider>,
    private readonly payments: PaymentsService,
  ) {
    payments.onSettled('deposit', async (intent) => {
      const r = this.ctx.db.reservations.get(intent.referenceId);
      if (!r || r.depositStatus !== 'pending') return;
      await this.applyDepositOutcome(r, intent.status === 'succeeded');
    });
  }

  /* ── Policy ─────────────────────────────────────────────────────────── */

  policy(): BookingPolicy {
    return this.ctx.db.bookingPolicy.get('booking-policy') ?? DEFAULT_BOOKING_POLICY;
  }

  updatePolicy(actor: Actor, patch: Partial<Omit<BookingPolicy, 'id' | 'version'>>): BookingPolicy {
    requireRole(actor, 'admin');
    const current = this.policy();
    const next: BookingPolicy = {
      ...current,
      ...patch,
      id: 'booking-policy',
      version: current.version + 1,
      updatedAt: nowIso(this.ctx),
    };
    if (next.minPartySize < 1 || next.maxPartySize < next.minPartySize) {
      throw new DomainError('VALIDATION', 'Party-size limits are not valid.', 'party limits');
    }
    if (next.slotIntervalMinutes < 5 || next.coversPerSlot < 1) {
      throw new DomainError('VALIDATION', 'Pacing values are not valid.', 'pacing');
    }
    this.ctx.db.bookingPolicy.upsert(next);
    audit(this.ctx, actor, 'booking_policy.updated', 'booking_policy', next.id, {
      version: next.version,
      fields: Object.keys(patch),
    });
    return next;
  }

  private provider(): ReservationProvider {
    return this.providers[this.ctx.flags.bookingProvider];
  }

  /* ── Availability ───────────────────────────────────────────────────── */

  async searchAvailability(query: AvailabilityQuery): Promise<ReservationSlot[]> {
    requireFlag(this.ctx.flags.bookingEnabled, 'booking');
    const policy = this.policy();
    assertQueryAllowed(policy, query, this.ctx.clock.now());
    const slots = await this.provider().search(query);
    this.ctx.analytics.track('availability_checked', {
      partySize: query.partySize,
      date: query.date,
      available: slots.filter((s) => s.available).length,
    });
    return slots;
  }

  /**
   * Calendar states for the date picker. 'full' only when the provider has
   * been asked and said no to every seating — a closed day is known from
   * policy alone and never costs a provider call.
   */
  async dayStates(from: string, days: number, partySize: number): Promise<Record<string, DayState>> {
    const policy = this.policy();
    const out: Record<string, DayState> = {};
    for (let i = 0; i < days; i++) {
      const date = addDays(from, i);
      if (!isOpenOn(policy, date)) {
        out[date] = 'closed';
        continue;
      }
      const slots = await this.provider().search({ venueId: policy.venueId, date, partySize });
      out[date] = slots.some((s) => s.available) ? 'available' : slots.length ? 'full' : 'closed';
    }
    return out;
  }

  /** Re-asks the provider about one slot. The only way a slot becomes bookable. */
  private async verifySlot(slotId: string, partySize: number, ignoreReservationId?: string) {
    const { venueId, date } = parseSlotId(slotId);
    const policy = this.policy();
    if (venueId !== policy.venueId) {
      throw new DomainError('VALIDATION', 'Please choose a time again.', 'venue mismatch');
    }
    assertQueryAllowed(policy, { venueId, date, partySize }, this.ctx.clock.now());
    let partyForSearch = partySize;
    if (ignoreReservationId) {
      // When moving a booking within its own seating, its own covers are free to it.
      const own = this.ctx.db.reservations.get(ignoreReservationId);
      if (own && own.slotId === slotId) partyForSearch = Math.max(1, partySize - own.partySize);
    }
    const slots = await this.provider().search({ venueId, date, partySize: partyForSearch });
    const slot = slots.find((s) => s.slotId === slotId);
    if (!slot || !slot.available) {
      throw new DomainError('SLOT_UNAVAILABLE', NO_AVAILABILITY_MESSAGE, `slot ${slotId}`);
    }
    return slot;
  }

  /* ── Create ─────────────────────────────────────────────────────────── */

  async create(request: ReservationCreateRequest, actor: Actor): Promise<ReservationRecord> {
    requireFlag(this.ctx.flags.bookingEnabled, 'booking');
    const id = await idempotent(
      this.ctx.db,
      `reservation.create:${actor.id}`,
      request.idempotencyKey,
      request,
      nowIso(this.ctx),
      async () => {
        try {
          return await this.createOnce(request, actor);
        } catch (error) {
          this.ctx.analytics.track('reservation_failed', {
            code: error instanceof DomainError ? error.code : 'UNKNOWN',
          });
          throw error;
        }
      },
    );
    return this.ctx.db.reservations.require(id, 'booking');
  }

  private async createOnce(request: ReservationCreateRequest, actor: Actor): Promise<string> {
    const policy = this.policy();
    const contact = assertContact(request.guest);
    const children = request.children ?? 0;
    // At least one adult: children must be fewer than the whole party.
    if (children < 0 || children > policy.maxChildren || children >= request.partySize) {
      throw new DomainError('VALIDATION', 'Please check the number of children.', 'children');
    }
    const notes = {
      occasionNote: cleanNote(request.occasionNote, 200),
      dietaryNotes: cleanNote(request.dietaryNotes),
      accessibilityNotes: cleanNote(request.accessibilityNotes),
      specialRequest: cleanNote(request.specialRequest),
    };
    if (
      request.seatingPreference &&
      !policy.seatingAreas.some((a) => a.id === request.seatingPreference)
    ) {
      throw new DomainError('VALIDATION', 'Please choose a seating preference again.', 'seating');
    }

    const slot = await this.verifySlot(request.slotId, request.partySize);
    const provider = this.provider();
    const external = await provider.create(request, slot);

    const guestId = actor.role === 'guest' ? actor.id : `walkin_${contact.email}`;
    const depositCents = depositFor(policy, request.partySize, this.ctx.flags.bookingDepositEnabled);
    const now = nowIso(this.ctx);
    const status = depositCents > 0 ? 'requested' : external.status;

    const record = this.ctx.db.reservations.insert({
      id: this.ctx.ids.id('res'),
      reference: `MB-${this.ctx.ids.code(6)}`,
      externalReservationId: external.externalReservationId,
      provider: provider.id,
      status,
      venueId: policy.venueId,
      slotId: slot.slotId,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      partySize: request.partySize,
      children,
      guestId,
      guestName: contact.name,
      guestEmail: contact.email,
      guestPhone: contact.phone,
      occasion: request.occasion,
      seatingPreference: request.seatingPreference,
      ...notes,
      depositStatus: depositCents > 0 ? 'pending' : 'not_required',
      depositCents,
      createdAt: now,
      updatedAt: now,
    });

    this.log(record.id, 'created', actor, { slotId: slot.slotId, partySize: record.partySize });
    if (depositCents > 0) {
      this.log(record.id, 'deposit-requested', actor, { depositCents });
    } else if (status === 'confirmed') {
      this.log(record.id, 'confirmed', actor, {});
    }

    if (request.waitlistId) {
      const entry = this.ctx.db.waitlist.get(request.waitlistId);
      if (entry && entry.guestId === guestId) {
        this.ctx.db.waitlist.update(entry.id, { status: 'booked' });
      }
    }

    // Save the details to the profile for next time (§6 step 7).
    if (actor.role === 'guest') {
      const guest = this.ctx.db.guests.get(actor.id);
      if (guest && (!guest.phone || guest.name !== contact.name)) {
        this.ctx.db.guests.update(actor.id, {
          phone: guest.phone || contact.phone,
          name: guest.name || contact.name,
        });
      }
    }

    this.ctx.analytics.track('reservation_created', { partySize: record.partySize, status });
    this.ctx.analytics.track('booking_created', { partySize: record.partySize });
    if (status === 'confirmed') {
      this.ctx.analytics.track('booking_confirmed', { partySize: record.partySize });
      await this.ctx.bus.publish({
        type: 'reservation.confirmed',
        reservationId: record.id,
        guestId,
        startsAt: record.startsAt,
      });
    } else {
      await this.ctx.bus.publish({
        type: 'reservation.requested',
        reservationId: record.id,
        guestId,
        startsAt: record.startsAt,
      });
    }
    return record.id;
  }

  /* ── Deposits ───────────────────────────────────────────────────────── */

  async payDeposit(
    reservationId: string,
    methodToken: string,
    idempotencyKey: string,
    actor: Actor,
  ): Promise<ReservationRecord> {
    const r = this.get(reservationId, actor);
    if (r.depositStatus !== 'pending' && r.depositStatus !== 'failed') return r;
    const intent = await this.payments.charge({
      purpose: 'deposit',
      referenceId: r.id,
      amountCents: r.depositCents,
      description: `Mábu booking deposit ${r.reference}`,
      methodToken,
      idempotencyKey,
    });
    if (intent.status === 'pending') return this.ctx.db.reservations.require(r.id);
    return this.applyDepositOutcome(r, intent.status === 'succeeded');
  }

  private async applyDepositOutcome(r: ReservationRecord, paid: boolean): Promise<ReservationRecord> {
    const actor = { id: 'system', role: 'admin' as const };
    if (!paid) {
      this.log(r.id, 'deposit-failed', actor, {});
      return this.ctx.db.reservations.update(r.id, {
        depositStatus: 'failed',
        updatedAt: nowIso(this.ctx),
      });
    }
    const updated = this.ctx.db.reservations.update(r.id, {
      depositStatus: 'paid',
      status: 'confirmed',
      updatedAt: nowIso(this.ctx),
    });
    this.log(r.id, 'deposit-paid', actor, { depositCents: r.depositCents });
    this.log(r.id, 'confirmed', actor, {});
    this.ctx.analytics.track('booking_confirmed', { partySize: r.partySize });
    await this.ctx.bus.publish({
      type: 'reservation.confirmed',
      reservationId: r.id,
      guestId: r.guestId,
      startsAt: r.startsAt,
    });
    return updated;
  }

  /* ── Read ───────────────────────────────────────────────────────────── */

  get(reservationId: string, actor: Actor): ReservationRecord {
    const r = this.ctx.db.reservations.require(reservationId, 'booking');
    requireOwnerOrStaff(actor, r.guestId);
    return r;
  }

  listForGuest(guestId: string, actor: Actor): ReservationRecord[] {
    requireOwnerOrStaff(actor, guestId);
    return this.ctx.db.reservations
      .filter((r) => r.guestId === guestId)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  listForDate(date: string, actor: Actor): ReservationRecord[] {
    requireRole(actor, 'staff', 'admin');
    return this.ctx.db.reservations
      .filter((r) => venueDate(r.startsAt) === date)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  search(term: string, actor: Actor): ReservationRecord[] {
    requireRole(actor, 'staff', 'admin');
    const q = term.trim().toLowerCase();
    if (!q) return [];
    return this.ctx.db.reservations.filter(
      (r) =>
        r.reference.toLowerCase().includes(q) ||
        r.guestName.toLowerCase().includes(q) ||
        r.guestEmail.includes(q) ||
        r.guestPhone.includes(q),
    );
  }

  history(reservationId: string, actor: Actor) {
    this.get(reservationId, actor);
    return this.ctx.db.reservationEvents
      .filter((e) => e.reservationId === reservationId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  /** Whether a guest may still change this booking in the app. */
  canGuestChange(r: ReservationRecord): boolean {
    if (!isActive(r)) return false;
    const cutoff = new Date(r.startsAt).getTime() - this.policy().amendCutoffHours * 3_600_000;
    return this.ctx.clock.now().getTime() < cutoff;
  }

  private assertGuestMayChange(r: ReservationRecord, actor: Actor): void {
    if (!isActive(r)) {
      throw new DomainError('POLICY_VIOLATION', 'This booking can no longer be changed.', r.status);
    }
    if (actor.role === 'guest' && !this.canGuestChange(r)) {
      throw new DomainError(
        'POLICY_VIOLATION',
        `Changes within ${this.policy().amendCutoffHours} hours of your booking are made by our team — please call or email us.`,
        'inside amend cutoff',
      );
    }
  }

  /* ── Amend / reschedule ─────────────────────────────────────────────── */

  async amend(
    reservationId: string,
    patch: AmendPatch,
    actor: Actor,
    idempotencyKey: string,
  ): Promise<ReservationRecord> {
    const r = this.get(reservationId, actor);
    await idempotent(this.ctx.db, `reservation.amend:${r.id}`, idempotencyKey, patch, nowIso(this.ctx), async () => {
      this.assertGuestMayChange(r, actor);
      const clean: AmendPatch = {
        occasion: patch.occasion,
        occasionNote: cleanNote(patch.occasionNote, 200),
        seatingPreference: patch.seatingPreference,
        dietaryNotes: cleanNote(patch.dietaryNotes),
        accessibilityNotes: cleanNote(patch.accessibilityNotes),
        specialRequest: cleanNote(patch.specialRequest),
      };
      this.ctx.db.reservations.update(r.id, { ...clean, updatedAt: nowIso(this.ctx) });
      this.log(r.id, 'amended', actor, { fields: Object.keys(patch) });
      await this.ctx.bus.publish({ type: 'reservation.amended', reservationId: r.id, guestId: r.guestId });
      return r.id;
    });
    return this.ctx.db.reservations.require(r.id);
  }

  async reschedule(
    reservationId: string,
    slotId: string,
    actor: Actor,
    idempotencyKey: string,
    partySize?: number,
  ): Promise<ReservationRecord> {
    const r = this.get(reservationId, actor);
    await idempotent(
      this.ctx.db,
      `reservation.reschedule:${r.id}`,
      idempotencyKey,
      { slotId, partySize },
      nowIso(this.ctx),
      async () => {
        this.assertGuestMayChange(r, actor);
        const size = partySize ?? r.partySize;
        const slot = await this.verifySlot(slotId, size, r.id);
        if (r.externalReservationId) {
          await this.providers[r.provider].reschedule(r.externalReservationId, slot, size);
        }
        const previous = r.startsAt;
        const previousSlot = r.slotId;
        this.ctx.db.reservations.update(r.id, {
          slotId: slot.slotId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          partySize: size,
          status: r.status === 'requested' ? 'requested' : 'rescheduled',
          updatedAt: nowIso(this.ctx),
        });
        this.log(r.id, 'rescheduled', actor, { from: previous, to: slot.startsAt, partySize: size });
        this.ctx.analytics.track('booking_rescheduled', { partySize: size });
        await this.ctx.bus.publish({
          type: 'reservation.rescheduled',
          reservationId: r.id,
          guestId: r.guestId,
          startsAt: slot.startsAt,
          previousStartsAt: previous,
        });
        if (previousSlot !== slot.slotId) await this.matchWaitlist(parseSlotId(previousSlot).date);
        return r.id;
      },
    );
    return this.ctx.db.reservations.require(r.id);
  }

  /* ── Cancel / complete / no-show ────────────────────────────────────── */

  async cancel(
    reservationId: string,
    actor: Actor,
    idempotencyKey: string,
    reason?: string,
  ): Promise<ReservationRecord> {
    const r = this.get(reservationId, actor);
    await idempotent(this.ctx.db, `reservation.cancel:${r.id}`, idempotencyKey, {}, nowIso(this.ctx), async () => {
      if (!isActive(r)) {
        throw new DomainError('POLICY_VIOLATION', 'This booking is already closed.', r.status);
      }
      const cutoff =
        new Date(r.startsAt).getTime() - this.policy().cancellationCutoffHours * 3_600_000;
      const outcome: PolicyOutcome =
        actor.role !== 'guest'
          ? 'cancelled_by_restaurant'
          : this.ctx.clock.now().getTime() <= cutoff
            ? 'cancelled_in_time'
            : 'late_cancellation';
      if (r.externalReservationId) {
        await this.providers[r.provider].cancel(r.externalReservationId);
      }
      let depositStatus = r.depositStatus;
      if (r.depositStatus === 'paid') {
        depositStatus = outcome === 'late_cancellation' ? 'forfeited' : 'refunded';
        if (depositStatus === 'refunded') {
          const intent = this.ctx.db.payments.find(
            (p) => p.referenceId === r.id && p.status === 'succeeded',
          );
          if (intent) await this.payments.refund(intent.id);
        }
      } else if (r.depositStatus === 'pending') {
        depositStatus = 'not_required';
      }
      this.ctx.db.reservations.update(r.id, {
        status: 'cancelled',
        cancellationReason: cleanNote(reason, 200),
        policyOutcome: outcome,
        depositStatus,
        updatedAt: nowIso(this.ctx),
      });
      this.log(r.id, 'cancelled', actor, { outcome, reason: reason ? 'given' : 'none' });
      if (actor.role !== 'guest') {
        audit(this.ctx, actor, 'reservation.cancelled', 'reservation', r.id, { outcome });
      }
      this.ctx.analytics.track('reservation_cancelled', { outcome });
      this.ctx.analytics.track('booking_cancelled', { outcome });
      await this.ctx.bus.publish({
        type: 'reservation.cancelled',
        reservationId: r.id,
        guestId: r.guestId,
        startsAt: r.startsAt,
      });
      await this.matchWaitlist(parseSlotId(r.slotId).date);
      return r.id;
    });
    return this.ctx.db.reservations.require(r.id);
  }

  /** Staff marks a visit as honoured. Rewards listen for the event (§34 visit recognition). */
  async markCompleted(reservationId: string, actor: Actor): Promise<ReservationRecord> {
    requireRole(actor, 'staff', 'admin');
    const r = this.ctx.db.reservations.require(reservationId, 'booking');
    if (r.status === 'completed') return r; // exactly once, however often staff tap it
    if (!isActive(r)) {
      throw new DomainError('POLICY_VIOLATION', `A ${r.status} booking cannot be completed.`, r.status);
    }
    if (new Date(r.startsAt).getTime() > this.ctx.clock.now().getTime()) {
      throw new DomainError('POLICY_VIOLATION', 'This booking has not started yet.', 'future');
    }
    const updated = this.ctx.db.reservations.update(r.id, {
      status: 'completed',
      updatedAt: nowIso(this.ctx),
    });
    this.log(r.id, 'completed', actor, {});
    audit(this.ctx, actor, 'reservation.completed', 'reservation', r.id);
    this.ctx.analytics.track('visit_completed', { partySize: r.partySize });
    await this.ctx.bus.publish({ type: 'reservation.completed', reservationId: r.id, guestId: r.guestId });
    return updated;
  }

  async markNoShow(reservationId: string, actor: Actor): Promise<ReservationRecord> {
    requireRole(actor, 'staff', 'admin');
    const r = this.ctx.db.reservations.require(reservationId, 'booking');
    if (r.status === 'no-show') return r;
    if (!isActive(r)) {
      throw new DomainError('POLICY_VIOLATION', `A ${r.status} booking cannot be marked missed.`, r.status);
    }
    if (new Date(r.startsAt).getTime() > this.ctx.clock.now().getTime()) {
      throw new DomainError('POLICY_VIOLATION', 'This booking has not started yet.', 'future');
    }
    const updated = this.ctx.db.reservations.update(r.id, {
      status: 'no-show',
      policyOutcome: 'no_show',
      depositStatus: r.depositStatus === 'paid' ? 'forfeited' : r.depositStatus,
      updatedAt: nowIso(this.ctx),
    });
    this.log(r.id, 'no-show', actor, {});
    audit(this.ctx, actor, 'reservation.no_show', 'reservation', r.id);
    await this.ctx.bus.publish({ type: 'reservation.no_show', reservationId: r.id, guestId: r.guestId });
    return updated;
  }

  /* ── Staff notes ────────────────────────────────────────────────────── */

  addStaffNote(reservationId: string, body: string, actor: Actor): StaffNote {
    requireRole(actor, 'staff', 'admin');
    this.ctx.db.reservations.require(reservationId, 'booking');
    const text = cleanNote(body, 1000);
    if (!text) throw new DomainError('VALIDATION', 'The note is empty.', 'empty note');
    const note = this.ctx.db.staffNotes.insert({
      id: this.ctx.ids.id('note'),
      reservationId,
      authorId: actor.id,
      body: text,
      createdAt: nowIso(this.ctx),
    });
    audit(this.ctx, actor, 'reservation.staff_note', 'reservation', reservationId);
    return note;
  }

  staffNotes(reservationId: string, actor: Actor): StaffNote[] {
    requireRole(actor, 'staff', 'admin');
    return this.ctx.db.staffNotes.filter((n) => n.reservationId === reservationId);
  }

  /* ── Waitlist ───────────────────────────────────────────────────────── */

  async joinWaitlist(
    query: AvailabilityQuery & { preferredTime?: string },
    actor: Actor,
  ): Promise<{ waitlistId: string }> {
    requireFlag(this.ctx.flags.waitlistEnabled, 'waitlist');
    requireRole(actor, 'guest', 'staff', 'admin');
    assertQueryAllowed(this.policy(), query, this.ctx.clock.now());
    const existing = this.ctx.db.waitlist.find(
      (w) =>
        w.guestId === actor.id &&
        w.status === 'waiting' &&
        w.query.date === query.date &&
        w.query.partySize === query.partySize &&
        w.query.servicePeriod === query.servicePeriod,
    );
    if (existing) return { waitlistId: existing.id };
    const entry = this.ctx.db.waitlist.insert({
      id: this.ctx.ids.id('wl'),
      guestId: actor.id,
      query: { ...query },
      status: 'waiting',
      createdAt: nowIso(this.ctx),
    });
    this.ctx.analytics.track('waitlist_joined', { partySize: query.partySize });
    return { waitlistId: entry.id };
  }

  waitlistForGuest(guestId: string, actor: Actor): WaitlistEntry[] {
    requireOwnerOrStaff(actor, guestId);
    return this.ctx.db.waitlist.filter((w) => w.guestId === guestId);
  }

  async leaveWaitlist(waitlistId: string, actor: Actor): Promise<void> {
    const w = this.ctx.db.waitlist.require(waitlistId, 'waitlist entry');
    requireOwnerOrStaff(actor, w.guestId);
    if (w.status === 'waiting' || w.status === 'matched') {
      this.ctx.db.waitlist.update(w.id, { status: 'cancelled' });
    }
  }

  /**
   * Offers freed tables to waiting guests, oldest first. Each entry is matched
   * at most once; the guest then books the offered slot through the normal,
   * re-verified create() path — a match is an invitation, never a booking.
   */
  async matchWaitlist(date: string): Promise<WaitlistEntry[]> {
    if (!this.ctx.flags.waitlistEnabled) return [];
    const matched: WaitlistEntry[] = [];
    const waiting = this.ctx.db.waitlist
      .filter((w) => w.status === 'waiting' && w.query.date === date)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const entry of waiting) {
      if (date < venueDate(this.ctx.clock.now())) {
        this.ctx.db.waitlist.update(entry.id, { status: 'expired' });
        continue;
      }
      const slots = (await this.provider().search(entry.query)).filter((s) => s.available);
      if (!slots.length) continue;
      const preferred = entry.query.preferredTime;
      const pick = preferred
        ? [...slots].sort(
            (a, b) =>
              Math.abs(minutesAt(a.startsAt) - minutesOfTime(preferred)) -
              Math.abs(minutesAt(b.startsAt) - minutesOfTime(preferred)),
          )[0]!
        : slots[0]!;
      const updated = this.ctx.db.waitlist.update(entry.id, {
        status: 'matched',
        matchedAt: nowIso(this.ctx),
        matchedSlotId: pick.slotId,
        matchedStartsAt: pick.startsAt,
      });
      matched.push(updated);
      this.ctx.analytics.track('waitlist_matched', { partySize: entry.query.partySize });
      await this.ctx.bus.publish({
        type: 'waitlist.matched',
        waitlistId: entry.id,
        guestId: entry.guestId,
        slotId: pick.slotId,
        startsAt: pick.startsAt,
      });
    }
    return matched;
  }

  /* ── Provider webhooks ──────────────────────────────────────────────── */

  /**
   * Stores and de-duplicates a provider webhook (§33). Returns false for a
   * replay. The body is applied only for event types a provider contract
   * defines — none yet, so events are stored for reconciliation and audit.
   */
  ingestWebhook(
    provider: string,
    providerEventId: string,
    type: string,
    payload: Record<string, unknown>,
  ): boolean {
    const id = `${provider}:${providerEventId}`;
    if (this.ctx.db.providerWebhookEvents.has(id)) return false;
    this.ctx.db.providerWebhookEvents.insert({
      id,
      provider,
      providerEventId,
      type,
      payload,
      receivedAt: nowIso(this.ctx),
    });
    const externalId = typeof payload.externalReservationId === 'string' ? payload.externalReservationId : undefined;
    const r = externalId
      ? this.ctx.db.reservations.find((x) => x.externalReservationId === externalId)
      : undefined;
    if (r) {
      this.ctx.db.reservationEvents.insert({
        id: this.ctx.ids.id('rev'),
        reservationId: r.id,
        eventType: 'provider-webhook',
        payload: { type },
        occurredAt: nowIso(this.ctx),
        actorId: `provider:${provider}`,
        providerEventId,
      });
    }
    return true;
  }

  /* ── Internals ──────────────────────────────────────────────────────── */

  private log(
    reservationId: string,
    eventType: ReservationEventType,
    actor: Actor,
    payload: Record<string, unknown>,
  ): void {
    this.ctx.db.reservationEvents.insert({
      id: this.ctx.ids.id('rev'),
      reservationId,
      eventType,
      payload,
      occurredAt: nowIso(this.ctx),
      actorId: actor.id,
    });
  }

  activeCount(): number {
    return this.ctx.db.reservations.count((r) => ACTIVE_STATUSES.includes(r.status));
  }
}

function minutesAt(iso: string): number {
  const d = new Date(new Date(iso).getTime() + 2 * 3_600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function minutesOfTime(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}
