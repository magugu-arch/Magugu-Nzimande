import { createBackend, seedConfiguration, type Backend } from '@/domain/backend';
import type { FeatureFlags } from '@/domain/flags';
import type { Actor } from '@/domain/guests/types';
import { fixedClock } from '@/domain/shared/clock';
import { newIdempotencyKey, sequentialIds } from '@/domain/shared/ids';
import { slotIdOf } from '@/domain/reservations/slots';
import type { ReservationCreateRequest } from '@/domain/reservations/types';

/** Thursday 1 October 2026, 09:00 at the venue. */
export const NOW = '2026-10-01T09:00:00+02:00';
export const VENUE = 'mabu-waterfall';

export function makeBackend(flags: Partial<FeatureFlags> = {}, now = NOW) {
  const clock = fixedClock(now);
  const backend = createBackend({ clock, ids: sequentialIds(), flags });
  seedConfiguration(backend);
  backend.ctx.bus.onError = (error) => {
    throw error;
  };
  return { ...backend, clock };
}

export type TestBackend = ReturnType<typeof makeBackend>;

export function addGuest(b: Backend, email = 'lerato@example.com', name = 'Lerato Mokoena'): Actor {
  const g = b.guests.findOrCreate({ email, name, phone: '082 555 0101' });
  return { id: g.id, role: 'guest' };
}

export const STAFF: Actor = { id: 'staff_1', role: 'staff' };
export const ADMIN: Actor = { id: 'admin_1', role: 'admin' };

export function bookingRequest(
  date: string,
  time: string,
  partySize = 2,
  extra: Partial<ReservationCreateRequest> = {},
): ReservationCreateRequest {
  return {
    venueId: VENUE,
    slotId: slotIdOf(VENUE, date, time),
    partySize,
    guest: { name: 'Lerato Mokoena', email: 'lerato@example.com', phone: '082 555 0101' },
    idempotencyKey: newIdempotencyKey(),
    ...extra,
  };
}

/** Sum of ledger lines, and sum of unspent lots, for an account. */
export function ledgerTotals(b: Backend, accountId: string) {
  const lines = b.db.rewardTransactions.filter((t) => t.accountId === accountId);
  return {
    sum: lines.reduce((s, t) => s + t.points, 0),
    lots: lines.reduce((s, t) => s + (t.remainingPoints ?? 0), 0),
  };
}
