/**
 * Reservation contracts — brief §7 and §32, merged. §32 is the newer and
 * fuller of the two, so where they differ it wins: availability is searched
 * with an `AvailabilityQuery` and a booking is made against a `slotId` the
 * provider returned, never against a free-typed time.
 */
import type { ReservationProviderId } from '../flags';

export type { ReservationProviderId };

export type ReservationStatus =
  | 'requested'
  | 'confirmed'
  | 'waitlisted'
  | 'rescheduled'
  | 'cancelled'
  | 'completed'
  | 'no-show'
  | 'failed';

export type ServicePeriod = 'lunch' | 'dinner';

export interface AvailabilityQuery {
  venueId: string;
  date: string;
  partySize: number;
  servicePeriod?: ServicePeriod;
  seatingArea?: string;
}

export interface ReservationSlot {
  slotId: string;
  startsAt: string;
  endsAt?: string;
  available: boolean;
  provider: ReservationProviderId;
  servicePeriod: ServicePeriod;
  /** Areas that can still seat this party at this time, where the provider says. */
  seatingAreas?: string[];
}

export type Occasion =
  'birthday' | 'anniversary' | 'business' | 'date-night' | 'celebration' | 'other';

export interface ReservationCreateRequest {
  venueId: string;
  slotId: string;
  partySize: number;
  children?: number;
  guest: {
    name: string;
    email: string;
    phone: string;
  };
  occasion?: Occasion;
  occasionNote?: string;
  seatingPreference?: string;
  dietaryNotes?: string;
  accessibilityNotes?: string;
  specialRequest?: string;
  /** Set when booking a slot offered by a waitlist match. */
  waitlistId?: string;
  idempotencyKey: string;
}

export type DepositStatus =
  'not_required' | 'pending' | 'paid' | 'failed' | 'refunded' | 'forfeited';

/** The outcome of a cancellation or no-show under the policy in force at the time. */
export type PolicyOutcome =
  'cancelled_in_time' | 'late_cancellation' | 'no_show' | 'cancelled_by_restaurant';

export interface ReservationRecord {
  id: string;
  /** Short code a guest can read over the phone. */
  reference: string;
  externalReservationId?: string;
  provider: ReservationProviderId;
  status: ReservationStatus;
  venueId: string;
  slotId: string;
  startsAt: string;
  endsAt?: string;
  partySize: number;
  children: number;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  occasion?: Occasion;
  occasionNote?: string;
  seatingPreference?: string;
  dietaryNotes?: string;
  accessibilityNotes?: string;
  specialRequest?: string;
  depositStatus: DepositStatus;
  depositCents: number;
  cancellationReason?: string;
  policyOutcome?: PolicyOutcome;
  createdAt: string;
  updatedAt: string;
}

/**
 * §30 "Staff notes: keep internal notes separate from guest-visible notes."
 * They live in their own table and never travel on a ReservationRecord, so no
 * guest-facing endpoint can leak them by forgetting to strip a field.
 */
export interface StaffNote {
  id: string;
  reservationId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export type ReservationEventType =
  | 'created'
  | 'confirmed'
  | 'amended'
  | 'rescheduled'
  | 'cancelled'
  | 'completed'
  | 'no-show'
  | 'waitlist-joined'
  | 'waitlist-matched'
  | 'deposit-requested'
  | 'deposit-paid'
  | 'deposit-failed'
  | 'provider-webhook';

/** §46 ReservationEvent — the audit trail §30 asks for. */
export interface ReservationEvent {
  id: string;
  reservationId: string;
  eventType: ReservationEventType;
  payload: Record<string, unknown>;
  occurredAt: string;
  actorId: string;
  providerEventId?: string;
}

export type WaitlistStatus = 'waiting' | 'matched' | 'booked' | 'expired' | 'cancelled';

export interface WaitlistEntry {
  id: string;
  guestId: string;
  query: AvailabilityQuery & { preferredTime?: string };
  status: WaitlistStatus;
  createdAt: string;
  matchedAt?: string;
  matchedSlotId?: string;
  matchedStartsAt?: string;
}

/** §33: provider webhook events are stored and de-duplicated. */
export interface ProviderWebhookEvent {
  id: string;
  provider: string;
  providerEventId: string;
  type: string;
  payload: Record<string, unknown>;
  receivedAt: string;
  processedAt?: string;
}

/**
 * The adapter boundary. A provider knows how to talk to one booking system;
 * everything else — idempotency, persistence, policy, events — lives in the
 * service so a new provider cannot bypass it.
 */
export interface ReservationProvider {
  id: ReservationProviderId;
  search(query: AvailabilityQuery): Promise<ReservationSlot[]>;
  create(
    request: ReservationCreateRequest,
    slot: ReservationSlot,
  ): Promise<{
    externalReservationId: string;
    status: 'confirmed' | 'requested';
  }>;
  reschedule(
    externalReservationId: string,
    slot: ReservationSlot,
    partySize: number,
  ): Promise<void>;
  cancel(externalReservationId: string): Promise<void>;
}

/** §32 ReservationService, with the lifecycle operations §44 requires. */
export interface ReservationService {
  searchAvailability(query: AvailabilityQuery): Promise<ReservationSlot[]>;
  create(request: ReservationCreateRequest): Promise<ReservationRecord>;
  reschedule(reservationId: string, slotId: string): Promise<ReservationRecord>;
  cancel(reservationId: string, reason?: string): Promise<void>;
  joinWaitlist(query: AvailabilityQuery): Promise<{ waitlistId: string }>;
}
