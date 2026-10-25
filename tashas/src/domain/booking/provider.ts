/**
 * Reservation provider contract.
 *
 * Tashas has not yet named its reservation provider, so the services depend
 * only on this interface. A real adapter is written once the provider's API,
 * webhook security and capabilities are confirmed (brief §13.16); until then
 * the clearly labelled SandboxReservationProvider stands in. Capabilities are
 * declared, never assumed: the UI offers holds, waitlists and amendments only
 * where the provider says it supports them.
 */

import type { DateKey, TimeKey } from '../util/time.ts';
import type { ServicePeriodId } from '../types.ts';

export interface ProviderCapabilities {
  holds: boolean;
  waitlist: boolean;
  amend: boolean;
  revalidate: boolean;
  signedWebhooks: boolean;
}

export interface ProviderSlot {
  time: TimeKey;
  period: ServicePeriodId;
  remainingCovers: number;
  available: boolean;
}

export interface AvailabilityQuery {
  branchId: string;
  date: DateKey;
  partySize: number;
}

export interface ProviderReservation {
  externalId: string;
  status: 'booked' | 'cancelled' | 'seated' | 'completed' | 'no-show';
  date: DateKey;
  time: TimeKey;
  partySize: number;
}

export interface ProviderWebhookEvent {
  eventId: string;
  externalId: string;
  status: ProviderReservation['status'];
  occurredAt: number;
}

export interface ReservationProvider {
  readonly name: string;
  readonly label: string;
  readonly isSandbox: boolean;
  readonly capabilities: ProviderCapabilities;

  availability(query: AvailabilityQuery): Promise<{ slots: ProviderSlot[]; freshUntil: number }>;

  hold(request: AvailabilityQuery & { time: TimeKey; ttlMs: number }): Promise<{
    holdId: string;
    expiresAt: number;
  }>;

  releaseHold(holdId: string): Promise<void>;

  /** Idempotent on `idempotencyKey`: a retry returns the reservation already made. */
  create(request: AvailabilityQuery & {
    time: TimeKey;
    holdId: string | null;
    idempotencyKey: string;
  }): Promise<ProviderReservation>;

  /** Finds a reservation by the idempotency key, after a timeout. */
  lookup(idempotencyKey: string): Promise<ProviderReservation | null>;

  amend(
    externalId: string,
    change: { date: DateKey; time: TimeKey; partySize: number },
    idempotencyKey: string,
  ): Promise<ProviderReservation>;

  cancel(externalId: string, idempotencyKey: string): Promise<ProviderReservation>;

  joinWaitlist(request: AvailabilityQuery & { time: TimeKey; idempotencyKey: string }): Promise<ProviderReservation>;

  verifyWebhook(rawBody: Uint8Array, headers: Record<string, string>): ProviderWebhookEvent;
}

/** Thrown when the provider accepted a request but the answer never came back. */
export const PROVIDER_TIMEOUT = 'provider_timeout';
export const SLOT_UNAVAILABLE = 'slot_unavailable';
export const PROVIDER_UNAVAILABLE = 'provider_unavailable';
export const HOLD_EXPIRED = 'hold_expired';
export const INVALID_SIGNATURE = 'invalid_signature';
