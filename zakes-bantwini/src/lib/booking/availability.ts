import type { AvailabilityEntry, AvailabilityState } from './types';

/**
 * What the public calendar may say about a day. Confirmed shows, travel days
 * and blackouts all read as "unavailable" so the calendar never reveals that
 * a private booking exists — only whether a date can be requested.
 */
export type PublicAvailability = 'available' | 'limited' | 'unavailable' | 'past';

export function publicState(state: AvailabilityState | undefined): Exclude<PublicAvailability, 'past'> {
  switch (state) {
    case undefined:
    case 'AVAILABLE':
      return 'available';
    case 'ON_HOLD':
      return 'limited';
    case 'CONFIRMED':
    case 'TRAVEL':
    case 'UNAVAILABLE':
      return 'unavailable';
  }
}

export const PUBLIC_LABEL: Record<PublicAvailability, string> = {
  available: 'Available to request',
  limited: 'Limited — a provisional hold exists; you may still request',
  unavailable: 'Unavailable',
  past: 'Past date',
};

/** Minimum notice for a request, in days. */
export const LEAD_DAYS = 14;

export function toPublicCalendar(
  entries: Pick<AvailabilityEntry, 'date' | 'state'>[],
  days: string[],
  today: string,
): Record<string, PublicAvailability> {
  const byDate = new Map(entries.map((e) => [e.date, e.state]));
  const out: Record<string, PublicAvailability> = {};
  for (const day of days) {
    out[day] = day < today ? 'past' : publicState(byDate.get(day));
  }
  return out;
}
