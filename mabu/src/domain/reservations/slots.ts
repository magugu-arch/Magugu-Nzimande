import type { BookingPolicy } from './policy';
import { tableDurationFor } from './policy';
import type { AvailabilityQuery, ServicePeriod } from './types';
import { addDays, minutesOf, timeOf, venueDate, venueIso, venueWeekday } from '../shared/time';
import { DomainError } from '../shared/errors';

/** A slot id encodes what it is, so any provider can resolve it without a lookup. */
export function slotIdOf(venueId: string, date: string, time: string): string {
  return `${venueId}|${date}|${time}`;
}

export function parseSlotId(slotId: string): { venueId: string; date: string; time: string } {
  const [venueId, date, time] = slotId.split('|');
  if (!venueId || !date || !time) {
    throw new DomainError('VALIDATION', 'Please choose a time again.', `bad slot id ${slotId}`);
  }
  return { venueId, date, time };
}

export interface CandidateTime {
  time: string;
  startsAt: string;
  endsAt: string;
  servicePeriod: ServicePeriod;
}

/** The seatings the policy offers on a date, before any inventory is considered. */
export function candidateTimes(
  policy: BookingPolicy,
  date: string,
  partySize: number,
  servicePeriod?: ServicePeriod,
): CandidateTime[] {
  if (policy.closedDates.includes(date)) return [];
  const weekday = venueWeekday(date);
  const duration = tableDurationFor(policy, partySize);
  const out: CandidateTime[] = [];
  for (const period of policy.servicePeriods) {
    if (servicePeriod && period.id !== servicePeriod) continue;
    if (!period.days.includes(weekday)) continue;
    for (
      let m = minutesOf(period.firstSeating);
      m <= minutesOf(period.lastSeating);
      m += policy.slotIntervalMinutes
    ) {
      const time = timeOf(m);
      const startsAt = venueIso(date, time);
      out.push({
        time,
        startsAt,
        endsAt: new Date(new Date(startsAt).getTime() + duration * 60_000).toISOString(),
        servicePeriod: period.id,
      });
    }
  }
  return out;
}

/** Whether the venue trades at all on a date under the policy. */
export function isOpenOn(policy: BookingPolicy, date: string): boolean {
  if (policy.closedDates.includes(date)) return false;
  const weekday = venueWeekday(date);
  return policy.servicePeriods.some((p) => p.days.includes(weekday));
}

/** Throws a guest-readable VALIDATION error when a query breaks the policy. */
export function assertQueryAllowed(
  policy: BookingPolicy,
  query: AvailabilityQuery,
  now: Date,
): void {
  if (!Number.isInteger(query.partySize) || query.partySize < policy.minPartySize) {
    throw new DomainError('VALIDATION', 'Please choose how many guests are joining.', 'party size');
  }
  if (query.partySize > policy.maxPartySize) {
    throw new DomainError(
      'POLICY_VIOLATION',
      `For parties larger than ${policy.maxPartySize}, our events team will plan it with you — please enquire about Private Functions.`,
      'party too large',
    );
  }
  const today = venueDate(now);
  if (query.date < today) {
    throw new DomainError('VALIDATION', 'Please choose a date from today onwards.', 'past date');
  }
  if (query.date > addDays(today, policy.maxAdvanceDays)) {
    throw new DomainError(
      'POLICY_VIOLATION',
      `We take bookings up to ${policy.maxAdvanceDays} days ahead. Please choose an earlier date.`,
      'beyond window',
    );
  }
}
