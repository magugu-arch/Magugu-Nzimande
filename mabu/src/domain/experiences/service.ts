import type { ServiceContext } from '../context';
import { audit, nowIso, requireFlag, requireOwnerOrStaff, requireRole } from '../context';
import type { Actor } from '../guests/types';
import type { PaymentsService } from '../payments/service';
import { DomainError } from '../shared/errors';
import { idempotent } from '../shared/idempotency';
import type { Experience, ExperienceBooking } from './types';

/** Guests may cancel an event booking for a refund until this long before it starts. */
export const EVENT_REFUND_CUTOFF_HOURS = 48;

/**
 * Events as a first-class commercial section (§11): capacity, price, seats,
 * waitlist, payment and attendance, all CMS-driven.
 */
export class ExperiencesService {
  constructor(
    private readonly ctx: ServiceContext,
    private readonly payments: PaymentsService,
  ) {
    payments.onSettled('event', async (intent) => {
      const booking = this.ctx.db.experienceBookings.find((b) => b.paymentId === intent.id);
      if (!booking || booking.status !== 'pending_payment') return;
      if (intent.status === 'succeeded') await this.confirm(booking);
      else this.release(booking, 'cancelled');
    });
  }

  list(options: { includePast?: boolean; includeUnpublished?: boolean } = {}): Experience[] {
    const now = this.ctx.clock.now().getTime();
    return this.ctx.db.experiences
      .filter(
        (e) =>
          (options.includeUnpublished || e.published) &&
          (options.includePast || new Date(e.endsAt).getTime() > now),
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  get(id: string): Experience {
    const e = this.ctx.db.experiences.require(id, 'event');
    if (!e.published) throw new DomainError('NOT_FOUND', 'We could not find that event.', id);
    return e;
  }

  async book(
    input: { eventId: string; seats: number; methodToken?: string; idempotencyKey: string },
    actor: Actor,
  ): Promise<ExperienceBooking> {
    requireFlag(this.ctx.flags.eventsEnabled, 'events');
    requireRole(actor, 'guest', 'staff', 'admin');
    const id = await idempotent(
      this.ctx.db,
      `event.book:${actor.id}`,
      input.idempotencyKey,
      { eventId: input.eventId, seats: input.seats },
      nowIso(this.ctx),
      async () => {
        const event = this.get(input.eventId);
        if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > event.maxSeatsPerBooking) {
          throw new DomainError(
            'VALIDATION',
            `Please choose between 1 and ${event.maxSeatsPerBooking} places.`,
            'seats',
          );
        }
        if (new Date(event.startsAt) <= this.ctx.clock.now()) {
          throw new DomainError('POLICY_VIOLATION', 'This event has already begun.', 'past');
        }
        this.ctx.analytics.track('event_booking_started', { seats: input.seats });
        const left = event.capacity - event.seatsBooked;
        const now = nowIso(this.ctx);
        const base = {
          id: this.ctx.ids.id('evb'),
          reference: `EV-${this.ctx.ids.code(6)}`,
          eventId: event.id,
          guestId: actor.id,
          seats: input.seats,
          createdAt: now,
          updatedAt: now,
        };

        if (left < input.seats) {
          if (!event.waitlistEnabled) {
            throw new DomainError('SOLD_OUT', 'This event is fully booked.', 'sold out');
          }
          const waitlisted = this.ctx.db.experienceBookings.insert({
            ...base,
            status: 'waitlisted',
            amountCents: 0,
          });
          return waitlisted.id;
        }

        const amountCents = (event.priceCents ?? 0) * input.seats;
        // Hold the seats before taking money, so two guests cannot pay for the last place.
        this.ctx.db.experiences.update(event.id, { seatsBooked: event.seatsBooked + input.seats });
        const booking = this.ctx.db.experienceBookings.insert({
          ...base,
          status: amountCents > 0 ? 'pending_payment' : 'confirmed',
          amountCents,
        });

        if (amountCents === 0) {
          await this.confirm(booking);
          return booking.id;
        }
        if (!input.methodToken) {
          this.release(booking, 'cancelled');
          throw new DomainError('VALIDATION', 'Please complete payment to reserve.', 'no method');
        }
        let intent;
        try {
          intent = await this.payments.charge({
            purpose: 'event',
            referenceId: booking.id,
            amountCents,
            description: `${event.title} × ${input.seats}`,
            methodToken: input.methodToken,
            idempotencyKey: `${input.idempotencyKey}:pay`,
          });
        } catch (error) {
          this.release(booking, 'cancelled');
          throw error;
        }
        this.ctx.db.experienceBookings.update(booking.id, { paymentId: intent.id });
        if (intent.status === 'failed') {
          this.release(booking, 'cancelled');
          throw new DomainError(
            'PAYMENT_DECLINED',
            intent.failureReason ?? 'The payment did not go through. No money was taken.',
            'declined',
          );
        }
        if (intent.status === 'succeeded') await this.confirm(this.ctx.db.experienceBookings.require(booking.id));
        return booking.id;
      },
    );
    return this.ctx.db.experienceBookings.require(id, 'event booking');
  }

  private async confirm(booking: ExperienceBooking): Promise<void> {
    const event = this.ctx.db.experiences.require(booking.eventId);
    this.ctx.db.experienceBookings.update(booking.id, { status: 'confirmed', updatedAt: nowIso(this.ctx) });
    this.ctx.analytics.track('event_booking_completed', { seats: booking.seats });
    await this.ctx.bus.publish({
      type: 'event.booked',
      bookingId: booking.id,
      eventId: event.id,
      guestId: booking.guestId,
      startsAt: event.startsAt,
    });
  }

  private release(booking: ExperienceBooking, status: 'cancelled'): void {
    const event = this.ctx.db.experiences.require(booking.eventId);
    this.ctx.db.experiences.update(event.id, { seatsBooked: Math.max(0, event.seatsBooked - booking.seats) });
    this.ctx.db.experienceBookings.update(booking.id, { status, updatedAt: nowIso(this.ctx) });
  }

  bookingsForGuest(guestId: string, actor: Actor): (ExperienceBooking & { event: Experience })[] {
    requireOwnerOrStaff(actor, guestId);
    return this.ctx.db.experienceBookings
      .filter((b) => b.guestId === guestId && b.status !== 'cancelled')
      .map((b) => ({ ...b, event: this.ctx.db.experiences.require(b.eventId) }))
      .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
  }

  async cancelBooking(bookingId: string, actor: Actor): Promise<ExperienceBooking> {
    const booking = this.ctx.db.experienceBookings.require(bookingId, 'event booking');
    requireOwnerOrStaff(actor, booking.guestId);
    if (booking.status === 'cancelled') return booking;
    const event = this.ctx.db.experiences.require(booking.eventId);
    if (booking.status === 'waitlisted') {
      return this.ctx.db.experienceBookings.update(booking.id, { status: 'cancelled', updatedAt: nowIso(this.ctx) });
    }
    if (booking.status !== 'confirmed' && booking.status !== 'pending_payment') {
      throw new DomainError('POLICY_VIOLATION', 'This booking can no longer be cancelled.', booking.status);
    }
    const cutoff = new Date(event.startsAt).getTime() - EVENT_REFUND_CUTOFF_HOURS * 3_600_000;
    if (actor.role === 'guest' && this.ctx.clock.now().getTime() > cutoff && booking.amountCents > 0) {
      throw new DomainError(
        'POLICY_VIOLATION',
        `Event bookings can be cancelled in the app until ${EVENT_REFUND_CUTOFF_HOURS} hours before. Please contact us.`,
        'inside cutoff',
      );
    }
    if (booking.paymentId) await this.payments.refund(booking.paymentId);
    this.release(booking, 'cancelled');
    if (actor.role !== 'guest') audit(this.ctx, actor, 'event_booking.cancelled', 'event_booking', booking.id);
    return this.ctx.db.experienceBookings.require(booking.id);
  }

  /** Staff check a guest in. Publishes event.attended exactly once. */
  async markAttended(bookingId: string, actor: Actor): Promise<ExperienceBooking> {
    requireRole(actor, 'staff', 'admin');
    const booking = this.ctx.db.experienceBookings.require(bookingId, 'event booking');
    if (booking.status === 'attended') return booking;
    if (booking.status !== 'confirmed') {
      throw new DomainError('POLICY_VIOLATION', `A ${booking.status} booking cannot be checked in.`, booking.status);
    }
    const updated = this.ctx.db.experienceBookings.update(booking.id, {
      status: 'attended',
      updatedAt: nowIso(this.ctx),
    });
    audit(this.ctx, actor, 'event_booking.attended', 'event_booking', booking.id);
    await this.ctx.bus.publish({
      type: 'event.attended',
      eventId: booking.eventId,
      guestId: booking.guestId,
      bookingId: booking.id,
    });
    return updated;
  }

  /* ── Admin (CMS) ────────────────────────────────────────────────────── */

  save(experience: Experience, actor: Actor): Experience {
    requireRole(actor, 'admin');
    if (!experience.title.trim()) throw new DomainError('VALIDATION', 'An event needs a title.', 'title');
    if (experience.endsAt <= experience.startsAt) {
      throw new DomainError('VALIDATION', 'The event must end after it starts.', 'times');
    }
    if (experience.capacity < experience.seatsBooked) {
      throw new DomainError('VALIDATION', 'Capacity cannot be below places already booked.', 'capacity');
    }
    const saved = this.ctx.db.experiences.upsert({ ...experience, updatedAt: nowIso(this.ctx) });
    audit(this.ctx, actor, 'event.saved', 'event', saved.id, { published: saved.published });
    return saved;
  }

  bookingsForEvent(eventId: string, actor: Actor): ExperienceBooking[] {
    requireRole(actor, 'staff', 'admin');
    return this.ctx.db.experienceBookings.filter((b) => b.eventId === eventId);
  }
}
