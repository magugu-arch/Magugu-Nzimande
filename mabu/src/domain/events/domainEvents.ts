/**
 * Typed domain events — brief §43. Booking, rewards, experiences, vouchers and
 * notifications talk only through these, so a completed reservation can earn
 * points and send a message without reservation code knowing either exists.
 *
 * The brief's union is the floor; the extra members below are the triggers
 * §41 needs (reschedules, waitlist matches, event bookings, voucher purchases,
 * tier changes).
 */
export type DomainEvent =
  | { type: 'reservation.confirmed'; reservationId: string; guestId: string; startsAt: string }
  | { type: 'reservation.requested'; reservationId: string; guestId: string; startsAt: string }
  | {
      type: 'reservation.rescheduled';
      reservationId: string;
      guestId: string;
      startsAt: string;
      previousStartsAt: string;
    }
  | { type: 'reservation.amended'; reservationId: string; guestId: string }
  | { type: 'reservation.completed'; reservationId: string; guestId: string }
  | { type: 'reservation.no_show'; reservationId: string; guestId: string }
  | { type: 'reservation.cancelled'; reservationId: string; guestId: string; startsAt: string }
  | {
      type: 'waitlist.matched';
      waitlistId: string;
      guestId: string;
      slotId: string;
      startsAt: string;
    }
  | { type: 'event.booked'; bookingId: string; eventId: string; guestId: string; startsAt: string }
  | { type: 'event.attended'; eventId: string; guestId: string; bookingId: string }
  | { type: 'voucher.purchased'; voucherId: string; guestId: string; amountCents: number }
  | { type: 'voucher.redeemed'; voucherId: string; guestId: string; amountCents: number }
  | { type: 'reward.earned'; guestId: string; points: number; referenceId: string }
  | { type: 'reward.redeemed'; guestId: string; rewardId: string; redemptionId: string }
  | { type: 'reward.tier_changed'; guestId: string; fromTierId: string; toTierId: string }
  | { type: 'notification.requested'; notificationId: string; guestId: string };

export type DomainEventType = DomainEvent['type'];
export type EventOf<K extends DomainEventType> = Extract<DomainEvent, { type: K }>;

export interface DomainEventBus {
  publish(event: DomainEvent): Promise<void>;
}

type Handler<K extends DomainEventType> = (event: EventOf<K>) => Promise<void> | void;

/**
 * In-process bus. Handlers run sequentially in subscription order; one
 * handler failing is logged and never stops the others or the publisher —
 * a notification outage must not undo a confirmed booking (§48: "services
 * continue to work if analytics temporarily fails").
 */
export class InMemoryEventBus implements DomainEventBus {
  private handlers = new Map<DomainEventType, Handler<DomainEventType>[]>();
  readonly published: DomainEvent[] = [];
  onError: (error: unknown, event: DomainEvent) => void = (error, event) =>
    console.warn(`[bus] handler for ${event.type} failed`, error);

  subscribe<K extends DomainEventType>(type: K, handler: Handler<K>): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as unknown as Handler<DomainEventType>);
    this.handlers.set(type, list);
    return () => {
      const current = this.handlers.get(type) ?? [];
      this.handlers.set(
        type,
        current.filter((h) => h !== (handler as unknown as Handler<DomainEventType>)),
      );
    };
  }

  async publish(event: DomainEvent): Promise<void> {
    this.published.push(event);
    for (const handler of this.handlers.get(event.type) ?? []) {
      try {
        await handler(event as EventOf<DomainEventType>);
      } catch (error) {
        this.onError(error, event);
      }
    }
  }
}
