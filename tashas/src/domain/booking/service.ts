/**
 * Reservations (brief §5, §13.1–13.4).
 *
 * The attempt state machine is draft → availability-selected →
 * pending-payment (when a deposit applies) → requested → confirmed, with
 * reconciliation, waitlisted, failed, expired and cancelled as recovery or
 * terminal states. Provider calls happen between short transactions, never
 * inside one, and every create carries the attempt's idempotency key so a
 * retry after a timeout cannot make a second reservation.
 *
 * Guests are never told a booking failed until the provider has been asked
 * whether it actually succeeded, and a paid deposit with no table always ends
 * in the reconciliation state with staff alerted.
 */

import type { Ctx } from '../context.ts';
import { SYSTEM, audit, raiseAlert, resolveAlerts } from '../context.ts';
import { branchById, effectivePolicy } from '../content.ts';
import type { Outbox } from '../outbox.ts';
import type { PaymentService } from '../payments/service.ts';
import { isSettledSuccess, isTerminalFailure } from '../payments/stateMachine.ts';
import { authorize, can } from '../roles.ts';
import type { GuestService } from '../guests.ts';
import type {
  Actor,
  AttributionSnapshot,
  Booking,
  BookingAttempt,
  BookingPolicy,
  BookingStatus,
  GuestDetails,
  ServicePeriodId,
} from '../types.ts';
import { DAY, DomainError, MINUTE, isDomainError } from '../util/core.ts';
import { addDays, dateKeyAt, formatDateLong, isoWithOffset, minutesOf, toEpoch, weekday } from '../util/time.ts';
import type { DateKey, TimeKey } from '../util/time.ts';
import { UniqueViolation } from '../db.ts';
import { amendableUntil, cancellationTerms, depositFor } from './policy.ts';
import type { DepositQuote } from './policy.ts';
import {
  INVALID_SIGNATURE,
  PROVIDER_TIMEOUT,
  PROVIDER_UNAVAILABLE,
  SLOT_UNAVAILABLE,
} from './provider.ts';
import type { ProviderSlot, ReservationProvider } from './provider.ts';

export interface AvailabilitySlot {
  time: TimeKey;
  available: boolean;
  startsAt: number;
}

export interface AvailabilityResult {
  branchId: string;
  date: DateKey;
  partySize: number;
  closed: boolean;
  periods: { id: ServicePeriodId; label: string; deposit: DepositQuote; slots: AvailabilitySlot[] }[];
  freshUntil: number;
  waitlist: boolean;
}

export type SubmitResult =
  | { status: 'confirmed'; attemptId: string; bookingId: string }
  | { status: 'checkout'; attemptId: string; paymentId: string; checkoutUrl: string }
  | { status: 'pending'; attemptId: string }
  | { status: 'reconciliation'; attemptId: string }
  | { status: 'policy-changed'; attemptId: string }
  | { status: 'waitlisted'; attemptId: string; bookingId: string }
  | { status: 'failed'; attemptId: string; reason: string };

export type RescheduleResult =
  | { status: 'amended'; booking: Booking; refundMinor: number }
  | { status: 'checkout'; attemptId: string; paymentId: string; checkoutUrl: string; topUpMinor: number };

const ACTIVE: BookingStatus[] = ['confirmed', 'amended'];
const MAX_PROVIDER_CREATES = 3;

export class BookingService {
  private ctx: Ctx;
  private outbox: Outbox;
  private payments: PaymentService;
  private guests: GuestService;
  readonly provider: ReservationProvider;

  constructor(ctx: Ctx, outbox: Outbox, provider: ReservationProvider, payments: PaymentService, guests: GuestService) {
    this.ctx = ctx;
    this.outbox = outbox;
    this.provider = provider;
    this.payments = payments;
    this.guests = guests;
  }

  policy(branchId: string): BookingPolicy {
    return effectivePolicy(this.ctx, branchId);
  }

  attempt(id: string): BookingAttempt {
    return this.ctx.db.require('bookingAttempts', id);
  }

  booking(id: string): Booking {
    return this.ctx.db.require('bookings', id);
  }

  // ------------------------------------------------------------ discovery

  bookableDates(branchId: string): DateKey[] {
    const branch = branchById(this.ctx.content, branchId);
    const policy = this.policy(branchId);
    const today = dateKeyAt(this.ctx.clock.now(), branch.utcOffsetMinutes);
    const out: DateKey[] = [];
    for (let i = 0; i <= policy.maxDaysAhead; i++) {
      const d = addDays(today, i);
      if (!branch.closedWeekdays.includes(weekday(d))) out.push(d);
    }
    return out;
  }

  async availability(branchId: string, date: DateKey, partySize: number): Promise<AvailabilityResult> {
    const branch = branchById(this.ctx.content, branchId);
    const policy = this.policy(branchId);
    this.assertParty(policy, partySize);
    const now = this.ctx.clock.now();
    const today = dateKeyAt(now, branch.utcOffsetMinutes);
    if (date < today || date > addDays(today, policy.maxDaysAhead)) {
      throw new DomainError('outside_booking_window', `Online booking opens ${policy.maxDaysAhead} days ahead.`);
    }
    const waitlist = policy.waitlist && this.provider.capabilities.waitlist;
    if (branch.closedWeekdays.includes(weekday(date))) {
      return { branchId, date, partySize, closed: true, periods: [], freshUntil: now, waitlist };
    }
    const { slots, freshUntil } = await this.provider.availability({ branchId, date, partySize });
    const earliest = now + policy.minLeadMinutes * MINUTE;
    return {
      branchId,
      date,
      partySize,
      closed: false,
      freshUntil,
      waitlist,
      periods: branch.services.map((s) => ({
        id: s.id,
        label: s.label,
        deposit: depositFor(policy, { date, period: s.id, partySize }),
        slots: slots
          .filter((p) => p.period === s.id)
          .map((p) => {
            const startsAt = toEpoch(date, p.time, branch.utcOffsetMinutes);
            return { time: p.time, startsAt, available: p.available && startsAt >= earliest };
          }),
      })),
    };
  }

  private assertParty(policy: BookingPolicy, partySize: number): void {
    if (!Number.isInteger(partySize) || partySize < 1) {
      throw new DomainError('invalid_party', 'Choose how many guests.');
    }
    if (partySize > policy.maxOnlinePartySize) {
      throw new DomainError(
        'party_too_large',
        `For more than ${policy.maxOnlinePartySize} guests, contact the café directly.`,
      );
    }
  }

  private alternatives(slots: ProviderSlot[], around: TimeKey, branchUtcOffset: number, date: DateKey, policy: BookingPolicy): TimeKey[] {
    const earliest = this.ctx.clock.now() + policy.minLeadMinutes * MINUTE;
    const target = minutesOf(around);
    return slots
      .filter((s) => s.available && toEpoch(date, s.time, branchUtcOffset) >= earliest && s.time !== around)
      .sort((a, b) => Math.abs(minutesOf(a.time) - target) - Math.abs(minutesOf(b.time) - target))
      .slice(0, 3)
      .map((s) => s.time)
      .sort();
  }

  // ------------------------------------------------------------- attempts

  startAttempt(input: {
    guestId: string | null;
    branchId: string;
    idempotencyKey: string;
    attribution: AttributionSnapshot | null;
  }): BookingAttempt {
    const { db, ids, clock } = this.ctx;
    branchById(this.ctx.content, input.branchId);
    const existing = db.byUnique('bookingAttempts', 'idempotencyKey', input.idempotencyKey);
    if (existing) return existing;
    const now = clock.now();
    return db.transaction(() => {
      const attempt = db.insert('bookingAttempts', {
        id: ids.id('att'),
        guestId: input.guestId,
        branchId: input.branchId,
        selectedSlot: null,
        state: 'draft',
        holdId: null,
        expiryAt: null,
        idempotencyKey: input.idempotencyKey,
        correlationId: ids.id('cor'),
        guestDetails: null,
        depositAmountMinor: 0,
        policyVersion: null,
        policyAcceptedAt: null,
        paymentId: null,
        bookingId: null,
        failureReason: null,
        providerCreateAttempts: 0,
        attribution: input.attribution,
        amendsBookingId: null,
        createdAt: now,
        updatedAt: now,
      });
      this.outbox.publish(
        { type: 'booking.started', attemptId: attempt.id, branchId: attempt.branchId },
        attempt.correlationId,
      );
      return attempt;
    });
  }

  private touch(attemptId: string, patch: Partial<BookingAttempt>): BookingAttempt {
    return this.ctx.db.update('bookingAttempts', attemptId, { ...patch, updatedAt: this.ctx.clock.now() });
  }

  /** Revalidates the slot with the provider and holds it where holds exist. */
  async selectSlot(
    attemptId: string,
    slot: { date: DateKey; time: TimeKey; partySize: number },
  ): Promise<BookingAttempt> {
    const attempt = this.attempt(attemptId);
    if (!['draft', 'availability-selected', 'expired', 'failed'].includes(attempt.state)) {
      throw new DomainError('invalid_state', `Cannot change the time of a ${attempt.state} booking.`);
    }
    const branch = branchById(this.ctx.content, attempt.branchId);
    const policy = this.policy(branch.id);
    this.assertParty(policy, slot.partySize);
    const startsAt = toEpoch(slot.date, slot.time, branch.utcOffsetMinutes);
    if (startsAt < this.ctx.clock.now() + policy.minLeadMinutes * MINUTE) {
      throw new DomainError('too_soon', `Online bookings need at least ${policy.minLeadMinutes} minutes’ notice.`);
    }
    if (attempt.holdId) await this.provider.releaseHold(attempt.holdId);

    const { slots } = await this.provider.availability({ branchId: branch.id, date: slot.date, partySize: slot.partySize });
    const match = slots.find((s) => s.time === slot.time);
    if (!match) throw new DomainError('invalid_slot', 'That time is not offered at this café.');
    if (!match.available) {
      throw new DomainError(SLOT_UNAVAILABLE, 'That time has just been taken.', {
        alternatives: this.alternatives(slots, slot.time, branch.utcOffsetMinutes, slot.date, policy),
      });
    }

    let holdId: string | null = null;
    let expiryAt: number | null = null;
    if (this.provider.capabilities.holds) {
      const hold = await this.provider.hold({
        branchId: branch.id,
        date: slot.date,
        time: slot.time,
        partySize: slot.partySize,
        ttlMs: policy.holdMinutes * MINUTE,
      });
      holdId = hold.holdId;
      expiryAt = hold.expiresAt;
    }
    const deposit = depositFor(policy, { date: slot.date, period: match.period, partySize: slot.partySize });
    return this.touch(attemptId, {
      selectedSlot: { ...slot, period: match.period, startsAt },
      holdId,
      expiryAt,
      state: 'availability-selected',
      depositAmountMinor: deposit.amountMinor,
      policyVersion: policy.version,
      failureReason: null,
    });
  }

  setGuestDetails(attemptId: string, details: GuestDetails): BookingAttempt {
    const attempt = this.attempt(attemptId);
    const policy = this.policy(attempt.branchId);
    if (details.seating && !policy.seatingOptions.includes(details.seating)) {
      throw new DomainError('invalid_seating', 'That seating option is not offered at this café.');
    }
    if (details.accessibilityNote && !policy.acceptsAccessibilityNotes) {
      throw new DomainError('notes_unsupported', 'This café cannot take access notes online; please call.');
    }
    if ((details.specialRequest ?? '').length > 300 || (details.accessibilityNote ?? '').length > 300) {
      throw new DomainError('note_too_long', 'Keep notes under 300 characters.');
    }
    return this.ctx.db.transaction(() => {
      const guest = this.guests.upsertFromDetails({
        guestId: attempt.guestId,
        name: details.name,
        email: details.email,
        phone: details.phone,
      });
      const clean = (s?: string) => (s && s.trim() ? s.trim() : undefined);
      const stored: GuestDetails = { name: guest.name, email: guest.email!, phone: guest.phone! };
      const occasion = clean(details.occasion);
      const specialRequest = clean(details.specialRequest);
      const seating = clean(details.seating);
      const accessibilityNote = clean(details.accessibilityNote);
      if (occasion) stored.occasion = occasion;
      if (specialRequest) stored.specialRequest = specialRequest;
      if (seating) stored.seating = seating;
      if (accessibilityNote) stored.accessibilityNote = accessibilityNote;
      return this.touch(attemptId, { guestId: guest.id, guestDetails: stored });
    });
  }

  async submit(attemptId: string, input: { policyAccepted: boolean }): Promise<SubmitResult> {
    let attempt = this.attempt(attemptId);
    const done = this.resultFor(attempt);
    if (done) return done;

    if (attempt.state === 'pending-payment' && attempt.paymentId) {
      const payment = this.payments.get(attempt.paymentId);
      if (!isTerminalFailure(payment.status)) return this.resultFor(attempt)!;
      attempt = this.touch(attemptId, { state: 'availability-selected', paymentId: null });
    }
    if (attempt.state !== 'availability-selected' || !attempt.selectedSlot) {
      throw new DomainError('no_slot', 'Choose a time first.');
    }
    if (!attempt.guestDetails || !attempt.guestId) throw new DomainError('no_details', 'Add your details first.');
    if (!input.policyAccepted) {
      throw new DomainError('policy_not_accepted', 'Please confirm you have read the booking terms.');
    }

    const branch = branchById(this.ctx.content, attempt.branchId);
    const policy = this.policy(branch.id);
    const slot = attempt.selectedSlot;
    const now = this.ctx.clock.now();

    // A hold that lapsed while the guest was typing is renewed if the table is still free.
    if (attempt.holdId && attempt.expiryAt !== null && attempt.expiryAt <= now) {
      try {
        const hold = await this.provider.hold({ ...slot, branchId: branch.id, ttlMs: policy.holdMinutes * MINUTE });
        attempt = this.touch(attemptId, { holdId: hold.holdId, expiryAt: hold.expiresAt });
      } catch (err) {
        if (!isDomainError(err, SLOT_UNAVAILABLE)) throw err;
        this.touch(attemptId, { state: 'expired', failureReason: 'hold_expired' });
        return { status: 'failed', attemptId, reason: 'hold_expired' };
      }
    }

    // The deposit is recomputed now, from the policy in force now.
    const deposit = depositFor(policy, slot);
    if (deposit.amountMinor !== attempt.depositAmountMinor || policy.version !== attempt.policyVersion) {
      this.touch(attemptId, { depositAmountMinor: deposit.amountMinor, policyVersion: policy.version });
      return { status: 'policy-changed', attemptId };
    }
    attempt = this.touch(attemptId, { policyAcceptedAt: now });

    if (deposit.amountMinor === 0) return this.finalize(attemptId);

    const previous = this.ctx.db.where('payments', (p) => p.bookingAttemptId === attemptId).length;
    const payment = await this.payments.createCheckout({
      guestId: attempt.guestId!,
      bookingAttemptId: attemptId,
      purpose: 'reservation-deposit',
      referenceId: attemptId,
      amountMinor: deposit.amountMinor,
      currency: 'ZAR',
      description: `Table deposit · ${branch.name} · ${formatDateLong(slot.date)} at ${slot.time} · ${slot.partySize} guests`,
      returnUrl: `/book/return?attempt=${attemptId}`,
      cancelUrl: `/book/return?attempt=${attemptId}&cancelled=1`,
      idempotencyKey: `${attempt.idempotencyKey}:deposit:${previous}`,
      metadata: {
        branchId: branch.id,
        campaign: attempt.attribution?.lastTouch?.utm.campaign ?? '',
        source: attempt.attribution?.lastTouch?.utm.source ?? '',
      },
    });
    this.touch(attemptId, { state: 'pending-payment', paymentId: payment.id });
    return { status: 'checkout', attemptId, paymentId: payment.id, checkoutUrl: payment.checkoutUrl ?? '' };
  }

  /** The current outcome of an attempt that has moved past selection, if any. */
  resultFor(attempt: BookingAttempt): SubmitResult | null {
    switch (attempt.state) {
      case 'confirmed':
        return { status: 'confirmed', attemptId: attempt.id, bookingId: attempt.bookingId! };
      case 'waitlisted':
        return { status: 'waitlisted', attemptId: attempt.id, bookingId: attempt.bookingId! };
      case 'requested':
        return { status: 'pending', attemptId: attempt.id };
      case 'reconciliation':
        return { status: 'reconciliation', attemptId: attempt.id };
      case 'failed':
      case 'expired':
      case 'cancelled':
        return { status: 'failed', attemptId: attempt.id, reason: attempt.failureReason ?? attempt.state };
      case 'pending-payment': {
        const payment = attempt.paymentId ? this.payments.get(attempt.paymentId) : null;
        if (payment && !isTerminalFailure(payment.status) && !isSettledSuccess(payment.status)) {
          return { status: 'checkout', attemptId: attempt.id, paymentId: payment.id, checkoutUrl: payment.checkoutUrl ?? '' };
        }
        if (payment && isSettledSuccess(payment.status)) return { status: 'pending', attemptId: attempt.id };
        return null;
      }
      default:
        return null;
    }
  }

  /** Asks the provider for the table. Safe to call again: the create is idempotent. */
  async finalize(attemptId: string): Promise<SubmitResult> {
    let attempt = this.attempt(attemptId);
    if (attempt.state === 'confirmed') return this.resultFor(attempt)!;
    if (!['availability-selected', 'pending-payment', 'requested', 'reconciliation'].includes(attempt.state)) {
      throw new DomainError('invalid_state', `Cannot finalise a ${attempt.state} booking.`);
    }
    const slot = attempt.selectedSlot!;
    attempt = this.touch(attemptId, {
      state: 'requested',
      providerCreateAttempts: attempt.providerCreateAttempts + 1,
    });
    try {
      const reservation = await this.provider.create({
        branchId: attempt.branchId,
        date: slot.date,
        time: slot.time,
        partySize: slot.partySize,
        holdId: attempt.holdId,
        idempotencyKey: attempt.idempotencyKey,
      });
      return this.confirm(attemptId, reservation.externalId);
    } catch (err) {
      return this.handleCreateFailure(attemptId, err);
    }
  }

  private handleCreateFailure(attemptId: string, err: unknown): SubmitResult {
    if (!isDomainError(err)) throw err;
    const attempt = this.attempt(attemptId);
    if (err.code === PROVIDER_TIMEOUT || err.code === PROVIDER_UNAVAILABLE) {
      if (attempt.providerCreateAttempts < MAX_PROVIDER_CREATES) {
        // Unknown outcome: stay "requested" and reconcile before saying anything.
        this.touch(attemptId, { failureReason: 'awaiting_provider' });
        audit(this.ctx, SYSTEM, 'booking.provider-timeout', 'attempt', attemptId, { code: err.code });
        return { status: 'pending', attemptId };
      }
    }
    const paid = attempt.paymentId ? isSettledSuccess(this.payments.get(attempt.paymentId).status) : false;
    if (paid) return this.enterReconciliation(attemptId, err.code);

    this.ctx.db.transaction(() => {
      this.touch(attemptId, { state: 'failed', failureReason: err.code });
      this.outbox.publish(
        { type: 'booking.failed', attemptId, guestId: attempt.guestId, reason: err.code },
        attempt.correlationId,
      );
    });
    if (attempt.holdId) void this.provider.releaseHold(attempt.holdId);
    return { status: 'failed', attemptId, reason: err.code };
  }

  private enterReconciliation(attemptId: string, reason: string): SubmitResult {
    const attempt = this.attempt(attemptId);
    this.ctx.db.transaction(() => {
      this.touch(attemptId, { state: 'reconciliation', failureReason: reason });
      raiseAlert(this.ctx, {
        severity: 'critical',
        title: 'Deposit paid but table not confirmed',
        body: `Attempt ${attemptId} at ${attempt.branchId}: the deposit succeeded but the reservation failed (${reason}). Retry the reservation or refund the guest.`,
        entityType: 'attempt',
        entityId: attemptId,
      });
      this.outbox.publish(
        { type: 'booking.reconciliation-required', attemptId, guestId: attempt.guestId, reason },
        attempt.correlationId,
      );
    });
    return { status: 'reconciliation', attemptId };
  }

  private confirm(attemptId: string, externalId: string): SubmitResult {
    const { db, ids, clock } = this.ctx;
    return db.transaction(() => {
      const attempt = this.attempt(attemptId);
      if (attempt.bookingId) return { status: 'confirmed' as const, attemptId, bookingId: attempt.bookingId };
      const branch = branchById(this.ctx.content, attempt.branchId);
      const slot = attempt.selectedSlot!;
      const payment = attempt.paymentId ? this.payments.get(attempt.paymentId) : null;
      const paid = payment && isSettledSuccess(payment.status) ? payment.amountMinor : 0;
      const now = clock.now();
      const booking = db.insert('bookings', {
        id: ids.id('bkg'),
        reference: ids.reference('TSH'),
        guestId: attempt.guestId!,
        branchId: attempt.branchId,
        provider: this.provider.name,
        externalId,
        status: 'confirmed',
        date: slot.date,
        time: slot.time,
        period: slot.period,
        startsAt: slot.startsAt,
        partySize: slot.partySize,
        policyVersion: attempt.policyVersion ?? this.policy(attempt.branchId).version,
        depositAmountMinor: attempt.depositAmountMinor,
        depositPaidMinor: paid,
        depositRefundedMinor: 0,
        paymentIds: payment ? [payment.id] : [],
        occasion: attempt.guestDetails?.occasion ?? null,
        specialRequest: attempt.guestDetails?.specialRequest ?? null,
        seating: attempt.guestDetails?.seating ?? null,
        attemptId,
        attribution: attempt.attribution,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      this.touch(attemptId, { state: 'confirmed', bookingId: booking.id, failureReason: null });
      this.outbox.publish(
        {
          type: 'booking.confirmed',
          bookingId: booking.id,
          guestId: booking.guestId,
          startsAt: isoWithOffset(booking.startsAt, branch.utcOffsetMinutes),
        },
        attempt.correlationId,
      );
      const touch = attempt.attribution?.lastTouch;
      if (touch?.campaignId) {
        const campaign = db.get('campaigns', touch.campaignId);
        const window = (campaign?.attributionWindowDays ?? 7) * DAY;
        if (now - touch.at <= window) {
          this.outbox.publish(
            { type: 'campaign.conversion', campaignId: touch.campaignId, conversionType: 'booking', referenceId: booking.id },
            attempt.correlationId,
          );
        }
      }
      resolveAlerts(this.ctx, attemptId, 'system');
      audit(this.ctx, SYSTEM, 'booking.confirmed', 'booking', booking.id, {
        reference: booking.reference,
        externalId,
        depositPaidMinor: paid,
      });
      return { status: 'confirmed' as const, attemptId, bookingId: booking.id };
    });
  }

  // ------------------------------------------------------- background work

  /** Advances attempts that are waiting on payments, providers or the clock. */
  async work(): Promise<void> {
    const { db, clock } = this.ctx;
    const now = clock.now();
    const settings = db.require('settings', 'global');

    for (const attempt of db.where('bookingAttempts', (a) => a.state === 'pending-payment')) {
      const payment = attempt.paymentId ? this.payments.get(attempt.paymentId) : null;
      if (!payment) continue;
      if (isSettledSuccess(payment.status)) {
        if (attempt.amendsBookingId) await this.applyPaidAmendment(attempt.id);
        else await this.afterDeposit(attempt.id);
      } else if (isTerminalFailure(payment.status)) {
        const holdValid = attempt.expiryAt === null || attempt.expiryAt > now;
        this.touch(attempt.id, holdValid ? { state: 'availability-selected' } : { state: 'expired', failureReason: 'payment_not_completed' });
      }
    }

    for (const attempt of db.where('bookingAttempts', (a) => a.state === 'requested')) {
      await this.reconcile(attempt.id);
    }

    if (settings.autoRefundOnBookingFailure) {
      for (const attempt of db.where('bookingAttempts', (a) => a.state === 'reconciliation')) {
        await this.refundReconciliation(attempt.id, SYSTEM);
      }
    }

    for (const attempt of db.where(
      'bookingAttempts',
      (a) => a.state === 'availability-selected' && a.expiryAt !== null && a.expiryAt < now - 30 * MINUTE,
    )) {
      if (attempt.holdId) await this.provider.releaseHold(attempt.holdId);
      this.touch(attempt.id, { state: 'expired', failureReason: 'abandoned' });
    }
  }

  /**
   * The deposit is verified. If the hold lapsed during payment and the table
   * has gone, the guest is refunded rather than charged for nothing (§13.2).
   */
  private async afterDeposit(attemptId: string): Promise<void> {
    let attempt = this.attempt(attemptId);
    const now = this.ctx.clock.now();
    if (attempt.holdId && attempt.expiryAt !== null && attempt.expiryAt <= now) {
      const policy = this.policy(attempt.branchId);
      try {
        const hold = await this.provider.hold({
          ...attempt.selectedSlot!,
          branchId: attempt.branchId,
          ttlMs: policy.holdMinutes * MINUTE,
        });
        attempt = this.touch(attemptId, { holdId: hold.holdId, expiryAt: hold.expiresAt });
      } catch (err) {
        if (!isDomainError(err, SLOT_UNAVAILABLE)) throw err;
        await this.refundAndFail(attemptId, 'slot_expired_during_payment', 'The table was released while payment was in progress.');
        return;
      }
    }
    await this.finalize(attemptId);
  }

  private async refundAndFail(attemptId: string, reason: string, refundReason: string): Promise<void> {
    const attempt = this.attempt(attemptId);
    if (attempt.paymentId) {
      const payment = this.payments.get(attempt.paymentId);
      if (this.payments.refundable(payment) > 0) {
        await this.payments.refund({
          paymentId: payment.id,
          reason: refundReason,
          actor: SYSTEM,
          idempotencyKey: `${attemptId}:refund:${reason}`,
        });
      }
    }
    this.ctx.db.transaction(() => {
      this.touch(attemptId, { state: 'failed', failureReason: reason });
      this.outbox.publish(
        { type: 'booking.failed', attemptId, guestId: attempt.guestId, reason },
        attempt.correlationId,
      );
      resolveAlerts(this.ctx, attemptId, 'system');
    });
  }

  /** After a timeout: did the provider make the reservation? Ask before retrying. */
  async reconcile(attemptId: string): Promise<SubmitResult> {
    const attempt = this.attempt(attemptId);
    if (attempt.state !== 'requested') return this.resultFor(attempt) ?? { status: 'pending', attemptId };
    try {
      const found = await this.provider.lookup(attempt.idempotencyKey);
      if (found && found.status !== 'cancelled') return this.confirm(attemptId, found.externalId);
    } catch (err) {
      if (isDomainError(err, PROVIDER_UNAVAILABLE)) return { status: 'pending', attemptId };
      throw err;
    }
    if (attempt.providerCreateAttempts >= MAX_PROVIDER_CREATES) {
      return this.handleCreateFailure(attemptId, new DomainError('provider_unconfirmed', 'The provider could not confirm the reservation.'));
    }
    return this.finalize(attemptId);
  }

  async retryReconciliation(attemptId: string, actor: Actor): Promise<SubmitResult> {
    authorize(actor, 'booking.reconcile');
    const attempt = this.attempt(attemptId);
    if (attempt.state !== 'reconciliation') throw new DomainError('invalid_state', 'Nothing to reconcile.');
    audit(this.ctx, actor, 'booking.reconcile-retry', 'attempt', attemptId);
    // The original hold is gone; the provider re-checks capacity on create.
    this.touch(attemptId, { holdId: null, providerCreateAttempts: 0 });
    const result = await this.finalize(attemptId);
    return result.status === 'failed' ? this.enterReconciliation(attemptId, result.reason) : result;
  }

  async refundReconciliation(attemptId: string, actor: Actor): Promise<void> {
    authorize(actor, 'booking.reconcile');
    const attempt = this.attempt(attemptId);
    if (attempt.state !== 'reconciliation') throw new DomainError('invalid_state', 'Nothing to reconcile.');
    audit(this.ctx, actor, 'booking.reconcile-refund', 'attempt', attemptId);
    await this.refundAndFail(attemptId, 'refunded_after_booking_failure', 'Table could not be confirmed after payment');
  }

  // ------------------------------------------------------------ waitlist

  async joinWaitlist(
    attemptId: string,
    slot: { date: DateKey; time: TimeKey; partySize: number },
  ): Promise<SubmitResult> {
    const attempt = this.attempt(attemptId);
    const done = this.resultFor(attempt);
    if (done && done.status === 'waitlisted') return done;
    const branch = branchById(this.ctx.content, attempt.branchId);
    const policy = this.policy(branch.id);
    if (!policy.waitlist || !this.provider.capabilities.waitlist) {
      throw new DomainError('waitlist_unavailable', 'This café does not run a waitlist online.');
    }
    if (!attempt.guestDetails || !attempt.guestId) throw new DomainError('no_details', 'Add your details first.');
    this.assertParty(policy, slot.partySize);
    const period = branch.services.find(
      (s) => minutesOf(slot.time) >= minutesOf(s.firstSeating) && minutesOf(slot.time) <= minutesOf(s.lastSeating),
    )?.id ?? 'breakfast';
    const startsAt = toEpoch(slot.date, slot.time, branch.utcOffsetMinutes);
    const reservation = await this.provider.joinWaitlist({
      branchId: branch.id,
      date: slot.date,
      time: slot.time,
      partySize: slot.partySize,
      idempotencyKey: `${attempt.idempotencyKey}:waitlist`,
    });
    const { db, ids, clock } = this.ctx;
    return db.transaction(() => {
      const now = clock.now();
      const booking = db.insert('bookings', {
        id: ids.id('bkg'),
        reference: ids.reference('TSW'),
        guestId: attempt.guestId!,
        branchId: branch.id,
        provider: this.provider.name,
        externalId: reservation.externalId,
        status: 'waitlisted',
        date: slot.date,
        time: slot.time,
        period,
        startsAt,
        partySize: slot.partySize,
        policyVersion: policy.version,
        depositAmountMinor: 0,
        depositPaidMinor: 0,
        depositRefundedMinor: 0,
        paymentIds: [],
        occasion: attempt.guestDetails?.occasion ?? null,
        specialRequest: attempt.guestDetails?.specialRequest ?? null,
        seating: null,
        attemptId,
        attribution: attempt.attribution,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      if (attempt.holdId) void this.provider.releaseHold(attempt.holdId);
      this.touch(attemptId, {
        state: 'waitlisted',
        bookingId: booking.id,
        selectedSlot: { ...slot, period, startsAt },
        holdId: null,
      });
      this.outbox.publish({ type: 'booking.waitlisted', bookingId: booking.id, guestId: booking.guestId }, attempt.correlationId);
      return { status: 'waitlisted' as const, attemptId, bookingId: booking.id };
    });
  }

  // ------------------------------------------------------- manage booking

  private assertCanManage(booking: Booking, actor: Actor): void {
    const own = actor.kind === 'guest' && actor.id === booking.guestId;
    if (!own && !can(actor, 'booking.view-all') && actor.kind !== 'system') {
      throw new DomainError('forbidden', 'You can only manage your own bookings.');
    }
  }

  cancellationQuote(bookingId: string, actor: Actor) {
    const booking = this.booking(bookingId);
    const policy = this.policy(booking.branchId);
    const refundable = booking.depositPaidMinor - booking.depositRefundedMinor;
    if (actor.kind === 'staff') {
      return { refundMinor: refundable, forfeitMinor: 0, withinFreeWindow: true, freeUntil: booking.startsAt };
    }
    return cancellationTerms(policy, booking.startsAt, this.ctx.clock.now(), refundable);
  }

  async cancel(
    bookingId: string,
    input: { actor: Actor; reason?: string; idempotencyKey: string },
  ): Promise<{ booking: Booking; refundMinor: number }> {
    let booking = this.booking(bookingId);
    this.assertCanManage(booking, input.actor);
    if (booking.status === 'cancelled') return { booking, refundMinor: 0 };
    if (![...ACTIVE, 'waitlisted', 'requested'].includes(booking.status)) {
      throw new DomainError('invalid_state', `A ${booking.status} booking cannot be cancelled.`);
    }
    const terms = this.cancellationQuote(bookingId, input.actor);
    if (booking.externalId) await this.provider.cancel(booking.externalId, input.idempotencyKey);

    booking = this.ctx.db.transaction(() => {
      const updated = this.ctx.db.update('bookings', bookingId, {
        status: 'cancelled',
        depositRefundedMinor: booking.depositRefundedMinor + terms.refundMinor,
        updatedAt: this.ctx.clock.now(),
      });
      this.outbox.publish(
        { type: 'booking.cancelled', bookingId, guestId: updated.guestId, reason: input.reason ?? 'guest-request' },
        updated.attemptId ?? bookingId,
      );
      audit(this.ctx, input.actor, 'booking.cancelled', 'booking', bookingId, {
        refundMinor: terms.refundMinor,
        forfeitMinor: terms.forfeitMinor,
        reason: input.reason ?? 'guest-request',
      });
      return updated;
    });

    if (terms.refundMinor > 0) await this.refundDeposit(booking, terms.refundMinor, 'Cancelled within the refund window', 'cancel');
    return { booking, refundMinor: terms.refundMinor };
  }

  private async refundDeposit(booking: Booking, amountMinor: number, reason: string, tag: string): Promise<void> {
    let remaining = amountMinor;
    for (const paymentId of [...booking.paymentIds].reverse()) {
      if (remaining <= 0) break;
      const payment = this.payments.get(paymentId);
      const available = this.payments.refundable(payment);
      if (available <= 0) continue;
      const amount = Math.min(available, remaining);
      await this.payments.refund({
        paymentId,
        amountMinor: amount,
        reason,
        actor: SYSTEM,
        idempotencyKey: `${booking.id}:${tag}:v${booking.version}:${paymentId}`,
      });
      remaining -= amount;
    }
  }

  amendableUntil(bookingId: string): number {
    const booking = this.booking(bookingId);
    return amendableUntil(this.policy(booking.branchId), booking.startsAt);
  }

  async reschedule(
    bookingId: string,
    change: { date: DateKey; time: TimeKey; partySize: number },
    input: { actor: Actor; idempotencyKey: string },
  ): Promise<RescheduleResult> {
    const booking = this.booking(bookingId);
    this.assertCanManage(booking, input.actor);
    if (!ACTIVE.includes(booking.status)) throw new DomainError('invalid_state', `A ${booking.status} booking cannot be changed.`);
    if (!this.provider.capabilities.amend) throw new DomainError('amend_unsupported', 'Changes need a call to the café.');
    const policy = this.policy(booking.branchId);
    const branch = branchById(this.ctx.content, booking.branchId);
    const now = this.ctx.clock.now();
    if (now > amendableUntil(policy, booking.startsAt)) {
      throw new DomainError('amend_cutoff', `Changes close ${policy.amendCutoffHours} hours before the booking.`);
    }
    this.assertParty(policy, change.partySize);

    const { slots } = await this.provider.availability({ branchId: branch.id, date: change.date, partySize: change.partySize });
    const match = slots.find((s) => s.time === change.time);
    const sameSlot = change.date === booking.date && change.time === booking.time;
    const freedBySelf = sameSlot ? booking.partySize : 0;
    if (!match || (match.remainingCovers + freedBySelf < change.partySize)) {
      throw new DomainError(SLOT_UNAVAILABLE, 'That time is not available.', {
        alternatives: this.alternatives(slots, change.time, branch.utcOffsetMinutes, change.date, policy),
      });
    }
    const startsAt = toEpoch(change.date, change.time, branch.utcOffsetMinutes);
    if (startsAt < now + policy.minLeadMinutes * MINUTE) throw new DomainError('too_soon', 'That time is too soon to book online.');

    const newDeposit = depositFor(policy, { date: change.date, period: match.period, partySize: change.partySize }).amountMinor;
    const held = booking.depositPaidMinor - booking.depositRefundedMinor;
    const diff = newDeposit - held;

    if (diff > 0) {
      const attempt = this.startAttempt({
        guestId: booking.guestId,
        branchId: booking.branchId,
        idempotencyKey: `amend:${input.idempotencyKey}`,
        attribution: booking.attribution,
      });
      const guest = this.guests.get(booking.guestId);
      this.touch(attempt.id, {
        selectedSlot: { ...change, period: match.period, startsAt },
        state: 'availability-selected',
        depositAmountMinor: diff,
        policyVersion: policy.version,
        amendsBookingId: booking.id,
        guestDetails: { name: guest.name, email: guest.email ?? '', phone: guest.phone ?? '' },
        policyAcceptedAt: now,
      });
      const payment = await this.payments.createCheckout({
        guestId: booking.guestId,
        bookingAttemptId: attempt.id,
        purpose: 'reservation-deposit',
        referenceId: attempt.id,
        amountMinor: diff,
        currency: 'ZAR',
        description: `Deposit top-up · ${branch.name} · ${formatDateLong(change.date)} at ${change.time}`,
        returnUrl: `/book/return?attempt=${attempt.id}`,
        cancelUrl: `/book/return?attempt=${attempt.id}&cancelled=1`,
        idempotencyKey: `amend:${input.idempotencyKey}:topup`,
        metadata: { branchId: branch.id, amends: booking.id },
      });
      this.touch(attempt.id, { state: 'pending-payment', paymentId: payment.id });
      return { status: 'checkout', attemptId: attempt.id, paymentId: payment.id, checkoutUrl: payment.checkoutUrl ?? '', topUpMinor: diff };
    }

    const updated = await this.applyAmendment(booking.id, change, match.period, startsAt, newDeposit, null, input.actor);
    const refundMinor = diff < 0 ? -diff : 0;
    if (refundMinor > 0) {
      const after = this.ctx.db.update('bookings', updated.id, { depositRefundedMinor: updated.depositRefundedMinor + refundMinor });
      await this.refundDeposit(after, refundMinor, 'Deposit difference after a change to the booking', 'amend');
      return { status: 'amended', booking: this.booking(updated.id), refundMinor };
    }
    return { status: 'amended', booking: updated, refundMinor: 0 };
  }

  private async applyAmendment(
    bookingId: string,
    change: { date: DateKey; time: TimeKey; partySize: number },
    period: ServicePeriodId,
    startsAt: number,
    depositAmountMinor: number,
    topUpPaymentId: string | null,
    actor: Actor,
  ): Promise<Booking> {
    const booking = this.booking(bookingId);
    if (booking.externalId) {
      await this.provider.amend(booking.externalId, change, `${bookingId}:v${booking.version + 1}`);
    }
    return this.ctx.db.transaction(() => {
      const topUp = topUpPaymentId ? this.payments.get(topUpPaymentId).amountMinor : 0;
      const updated = this.ctx.db.update('bookings', bookingId, (b) => ({
        ...b,
        ...change,
        period,
        startsAt,
        status: 'amended',
        version: b.version + 1,
        depositAmountMinor,
        depositPaidMinor: b.depositPaidMinor + topUp,
        paymentIds: topUpPaymentId ? [...b.paymentIds, topUpPaymentId] : b.paymentIds,
        updatedAt: this.ctx.clock.now(),
      }));
      const branch = branchById(this.ctx.content, updated.branchId);
      this.outbox.publish(
        {
          type: 'booking.amended',
          bookingId,
          guestId: updated.guestId,
          startsAt: isoWithOffset(updated.startsAt, branch.utcOffsetMinutes),
        },
        updated.attemptId ?? bookingId,
      );
      audit(this.ctx, actor, 'booking.amended', 'booking', bookingId, {
        date: change.date,
        time: change.time,
        partySize: change.partySize,
        version: updated.version,
      });
      return updated;
    });
  }

  private async applyPaidAmendment(attemptId: string): Promise<void> {
    const attempt = this.attempt(attemptId);
    const booking = this.booking(attempt.amendsBookingId!);
    const slot = attempt.selectedSlot!;
    try {
      await this.applyAmendment(
        booking.id,
        { date: slot.date, time: slot.time, partySize: slot.partySize },
        slot.period,
        slot.startsAt,
        booking.depositPaidMinor - booking.depositRefundedMinor + attempt.depositAmountMinor,
        attempt.paymentId,
        { kind: 'guest', id: booking.guestId },
      );
      this.touch(attemptId, { state: 'confirmed', bookingId: booking.id });
    } catch (err) {
      if (!isDomainError(err)) throw err;
      // The original booking stands; the top-up goes back.
      await this.refundAndFail(attemptId, 'amendment_unavailable', 'The new time could not be booked; your original booking stands.');
    }
  }

  // -------------------------------------------------- provider webhooks

  async handleProviderWebhook(
    rawBody: Uint8Array,
    headers: Record<string, string>,
  ): Promise<{ httpStatus: 200 | 401; outcome: string }> {
    const { db, ids, clock } = this.ctx;
    let event;
    try {
      event = this.provider.verifyWebhook(rawBody, headers);
    } catch (err) {
      if (!isDomainError(err, INVALID_SIGNATURE)) throw err;
      db.insert('bookingEvents', {
        id: ids.id('bev'),
        bookingId: null,
        providerEventId: null,
        eventType: 'unverified',
        payloadRedacted: { bytes: rawBody.length },
        signatureVerified: false,
        receivedAt: clock.now(),
        processedAt: null,
        outcome: 'rejected',
      });
      return { httpStatus: 401, outcome: 'rejected' };
    }
    if (db.byUnique('bookingEvents', 'providerEventId', event.eventId)) return { httpStatus: 200, outcome: 'duplicate' };

    const booking = db.where('bookings', (b) => b.externalId === event.externalId)[0];
    let cafeCancelled: Booking | null = null;
    try {
      const outcome = db.transaction(() => {
        const row = db.insert('bookingEvents', {
          id: ids.id('bev'),
          bookingId: booking?.id ?? null,
          providerEventId: event.eventId,
          eventType: `reservation.${event.status}`,
          payloadRedacted: { status: event.status },
          signatureVerified: true,
          receivedAt: clock.now(),
          processedAt: clock.now(),
          outcome: 'processed',
        });
        if (!booking) {
          db.update('bookingEvents', row.id, { outcome: 'ignored' });
          return 'unknown-booking';
        }
        const provider: Actor = { kind: 'provider', id: this.provider.name };
        const set = (status: BookingStatus) =>
          db.update('bookings', booking.id, { status, updatedAt: clock.now() });
        if (event.status === 'completed' && (ACTIVE.includes(booking.status) || booking.status === 'requested')) {
          set('completed');
          this.outbox.publish(
            { type: 'booking.completed', bookingId: booking.id, guestId: booking.guestId, branchId: booking.branchId },
            booking.attemptId ?? booking.id,
          );
        } else if (event.status === 'no-show' && ACTIVE.includes(booking.status)) {
          set('no-show');
          this.outbox.publish({ type: 'booking.no-show', bookingId: booking.id, guestId: booking.guestId }, booking.attemptId ?? booking.id);
        } else if (event.status === 'cancelled' && booking.status !== 'cancelled') {
          cafeCancelled = set('cancelled');
          this.outbox.publish(
            { type: 'booking.cancelled', bookingId: booking.id, guestId: booking.guestId, reason: 'cancelled-by-cafe' },
            booking.attemptId ?? booking.id,
          );
        } else {
          db.update('bookingEvents', row.id, { outcome: 'ignored' });
          return 'ignored';
        }
        audit(this.ctx, provider, `booking.${event.status}`, 'booking', booking.id, { providerEventId: event.eventId });
        return 'processed';
      });
      if (cafeCancelled) {
        const b = cafeCancelled as Booking;
        const refundable = b.depositPaidMinor - b.depositRefundedMinor;
        if (refundable > 0) {
          const after = db.update('bookings', b.id, { depositRefundedMinor: b.depositPaidMinor });
          await this.refundDeposit(after, refundable, 'Cancelled by the café', 'cafe-cancel');
        }
      }
      return { httpStatus: 200, outcome };
    } catch (err) {
      if (err instanceof UniqueViolation && err.field === 'providerEventId') return { httpStatus: 200, outcome: 'duplicate' };
      throw err;
    }
  }

  /** Sandbox stand-in for the provider's own staff tool (seat, complete, no-show). */
  staffMarkOutcome(bookingId: string, outcome: 'seated' | 'completed' | 'no-show', actor: Actor): void {
    authorize(actor, 'booking.mark-outcome');
    const booking = this.booking(bookingId);
    if (!booking.externalId) throw new DomainError('no_external', 'This booking has no provider record.');
    const sandbox = this.provider as ReservationProvider & {
      staffUpdate?: (id: string, s: 'seated' | 'completed' | 'no-show' | 'cancelled') => void;
    };
    if (!sandbox.staffUpdate) {
      throw new DomainError('provider_owned', 'Visit outcomes are recorded in the reservation provider.');
    }
    audit(this.ctx, actor, 'booking.outcome-requested', 'booking', bookingId, { outcome });
    sandbox.staffUpdate(booking.externalId, outcome);
  }
}
