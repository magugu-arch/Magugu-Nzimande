import type { BrandEvent, Rsvp } from '@/domain/types';

export type RsvpRequest = {
  eventId: string;
  guests: 1 | 2;
  name: string;
  email: string;
  /** Updates about this event. Marketing consent is separate (notification preferences). */
  updates: boolean;
};

/**
 * Events and fixtures. Capacity, the waitlist and invitations belong to
 * MAXHOSA's event system: the provider says going, waitlist or requested, and
 * the app shows exactly that. It never receives a head-count, so it cannot
 * invent urgency, and it never publishes a venue — that goes to confirmed
 * guests.
 */
export interface EventsProvider {
  readonly id: string;
  readonly isMock: boolean;
  readonly timeZone: string;

  listEvents(): Promise<BrandEvent[]>;
  getEvent(id: string): Promise<BrandEvent | undefined>;
  listRsvps(): Promise<Rsvp[]>;

  /** Same idempotency key, same RSVP: a double tap cannot take two places. */
  rsvp(request: RsvpRequest, idempotencyKey: string): Promise<Rsvp>;
  /** Releases the place (or leaves the waitlist) so someone else can have it. */
  cancelRsvp(eventId: string): Promise<void>;
}
