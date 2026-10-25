/**
 * Paid event places (brief §13.3 "approved event/ticket payments").
 * A place is held while the guest pays and confirmed only on a verified
 * payment; if the event filled up meanwhile, the payment is refunded.
 */

import type { Ctx } from '../context.ts';
import { SYSTEM, audit } from '../context.ts';
import { branchById } from '../content.ts';
import type { Consumer, Outbox } from '../outbox.ts';
import type { PaymentService } from '../payments/service.ts';
import type { AttributionSnapshot, EventBooking, EventListing, TashasDomainEvent } from '../types.ts';
import { DAY, DomainError, MINUTE } from '../util/core.ts';
import { addDays, dateKeyAt, formatDateLong, toEpoch } from '../util/time.ts';

const PAYMENT_HOLD_MS = 15 * MINUTE;

export class EventTicketService {
  private ctx: Ctx;
  private outbox: Outbox;
  private payments: PaymentService;

  constructor(ctx: Ctx, outbox: Outbox, payments: PaymentService) {
    this.ctx = ctx;
    this.outbox = outbox;
    this.payments = payments;
  }

  listing(eventId: string): EventListing {
    const e = this.ctx.content.events.find((x) => x.id === eventId);
    if (!e) throw new DomainError('unknown_event', 'That event is not published.');
    return e;
  }

  /** Event dates are stored relative to today so sample content never goes stale. */
  startsAt(listing: EventListing): { date: string; epoch: number } {
    const branch = branchById(this.ctx.content, listing.branchId);
    const today = dateKeyAt(this.ctx.clock.now(), branch.utcOffsetMinutes);
    const date = addDays(today, listing.dayOffset);
    return { date, epoch: toEpoch(date, listing.time, branch.utcOffsetMinutes) };
  }

  placesTaken(eventId: string, except?: string): number {
    const now = this.ctx.clock.now();
    return this.ctx.db
      .where(
        'eventBookings',
        (b) =>
          b.eventId === eventId &&
          b.id !== except &&
          (b.status === 'confirmed' || (b.status === 'pending-payment' && now - b.createdAt < PAYMENT_HOLD_MS)),
      )
      .reduce((n, b) => n + b.partySize, 0);
  }

  placesLeft(eventId: string): number {
    return Math.max(0, this.listing(eventId).capacity - this.placesTaken(eventId));
  }

  async reserve(input: {
    eventId: string;
    guestId: string;
    partySize: number;
    idempotencyKey: string;
    attribution: AttributionSnapshot | null;
  }): Promise<{ booking: EventBooking; checkoutUrl: string }> {
    const { db, ids, clock } = this.ctx;
    const existing = db.byUnique('eventBookings', 'idempotencyKey', input.idempotencyKey);
    if (existing) {
      const p = existing.paymentId ? this.payments.get(existing.paymentId) : null;
      return { booking: existing, checkoutUrl: p?.checkoutUrl ?? '' };
    }
    const listing = this.listing(input.eventId);
    if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 6) {
      throw new DomainError('invalid_party', 'Book between 1 and 6 places.');
    }
    if (this.startsAt(listing).epoch < clock.now()) throw new DomainError('event_past', 'This event has already started.');
    if (this.placesLeft(listing.id) < input.partySize) {
      throw new DomainError('event_full', 'There are not enough places left.');
    }
    const amount = listing.priceMinorPerGuest * input.partySize;
    const now = clock.now();
    const booking = db.insert('eventBookings', {
      id: ids.id('evb'),
      reference: ids.reference('TSE'),
      eventId: listing.id,
      guestId: input.guestId,
      partySize: input.partySize,
      status: 'pending-payment',
      amountMinor: amount,
      paymentId: null,
      idempotencyKey: input.idempotencyKey,
      attribution: input.attribution,
      createdAt: now,
      updatedAt: now,
    });
    const branch = branchById(this.ctx.content, listing.branchId);
    const payment = await this.payments.createCheckout({
      guestId: input.guestId,
      purpose: 'event',
      referenceId: booking.id,
      amountMinor: amount,
      currency: 'ZAR',
      description: `${listing.title} · ${branch.name} · ${formatDateLong(this.startsAt(listing).date)} · ${input.partySize} ${input.partySize === 1 ? 'place' : 'places'}`,
      returnUrl: `/events/return?booking=${booking.id}`,
      cancelUrl: `/events/return?booking=${booking.id}&cancelled=1`,
      idempotencyKey: `${input.idempotencyKey}:payment`,
      metadata: { eventId: listing.id, campaign: input.attribution?.lastTouch?.utm.campaign ?? '' },
    });
    const updated = db.update('eventBookings', booking.id, { paymentId: payment.id, updatedAt: clock.now() });
    return { booking: updated, checkoutUrl: payment.checkoutUrl ?? '' };
  }

  readonly consumer: Consumer = {
    name: 'event-tickets',
    handle: (event: TashasDomainEvent) => {
      if (event.type !== 'payment.succeeded' && event.type !== 'payment.failed' && event.type !== 'payment.cancelled') return;
      const payment = this.ctx.db.require('payments', event.paymentId);
      if (payment.purpose !== 'event') return;
      const booking = this.ctx.db.get('eventBookings', payment.referenceId);
      if (!booking || booking.status !== 'pending-payment') return;
      if (event.type !== 'payment.succeeded') {
        this.ctx.db.update('eventBookings', booking.id, { status: 'failed', updatedAt: this.ctx.clock.now() });
        return;
      }
      const listing = this.listing(booking.eventId);
      if (this.placesTaken(listing.id, booking.id) + booking.partySize > listing.capacity) {
        // Full while paying: the refund is issued by work(), outside this transaction.
        this.ctx.db.update('eventBookings', booking.id, { status: 'failed', updatedAt: this.ctx.clock.now() });
        return;
      }
      this.ctx.db.update('eventBookings', booking.id, { status: 'confirmed', updatedAt: this.ctx.clock.now() });
      this.outbox.publish({ type: 'event-booking.confirmed', eventBookingId: booking.id, guestId: booking.guestId, eventId: listing.id }, booking.id);
      const touch = booking.attribution?.lastTouch;
      if (touch?.campaignId && this.ctx.clock.now() - touch.at <= 7 * DAY) {
        this.outbox.publish({ type: 'campaign.conversion', campaignId: touch.campaignId, conversionType: 'event', referenceId: booking.id }, booking.id);
      }
    },
  };

  /** Refunds payments for places that could not be confirmed. */
  async work(): Promise<void> {
    for (const b of this.ctx.db.where('eventBookings', (x) => x.status === 'failed' && x.paymentId !== null)) {
      const p = this.payments.get(b.paymentId!);
      if (p.status === 'succeeded' && this.payments.refundable(p) > 0) {
        await this.payments.refund({
          paymentId: p.id,
          reason: 'Event was full by the time payment completed',
          actor: SYSTEM,
          idempotencyKey: `${b.id}:full-refund`,
        });
        audit(this.ctx, SYSTEM, 'event.refunded-full', 'eventBooking', b.id);
      }
    }
  }
}
