import type { ServicePeriod } from './types';

/**
 * Booking rules as data (§33: "provider-specific rules must be configurable
 * and not hard-coded into UI components"). Admin edits this document; the UI
 * and the service both read it.
 *
 * Every number here is a placeholder until Mábu confirms its real rules
 * (brief §50: table durations, deposit rules, cancellation and no-show
 * policy, seating zones, party-size rules).
 */
export interface ServicePeriodRule {
  id: ServicePeriod;
  label: string;
  /** First and last seating, venue-local HH:mm. */
  firstSeating: string;
  lastSeating: string;
  /** Weekdays this service runs: 0 = Sunday … 6 = Saturday. */
  days: number[];
}

export interface SeatingArea {
  id: string;
  label: string;
  description: string;
}

export interface BookingPolicy {
  id: 'booking-policy';
  version: number;
  venueId: string;
  minPartySize: number;
  /** Larger parties are routed to Private Functions rather than refused. */
  maxPartySize: number;
  maxChildren: number;
  slotIntervalMinutes: number;
  tableDurationMinutes: number;
  largeTableDurationMinutes: number;
  largeTableFromPartySize: number;
  leadTimeMinutes: number;
  maxAdvanceDays: number;
  /** Cancelling later than this is recorded as a late cancellation. */
  cancellationCutoffHours: number;
  /** Guests may amend or reschedule in the app until this many hours before. */
  amendCutoffHours: number;
  /** Reminders before a booking, in hours (§41: 24h, plus a configurable extra). */
  reminderHoursBefore: number[];
  /** Mock inventory only: covers the mock provider can seat per slot. */
  coversPerSlot: number;
  servicePeriods: ServicePeriodRule[];
  closedDates: string[];
  seatingAreas: SeatingArea[];
  deposit: {
    enabled: boolean;
    perPersonCents: number;
    appliesFromPartySize: number;
  };
  /** Guest-facing policy copy, shown on review and confirmation. */
  cancellationPolicyText: string;
  noShowPolicyText: string;
  updatedAt: string;
}

export const DEFAULT_BOOKING_POLICY: BookingPolicy = {
  id: 'booking-policy',
  version: 1,
  venueId: 'mabu-waterfall',
  minPartySize: 1,
  maxPartySize: 10,
  maxChildren: 6,
  slotIntervalMinutes: 30,
  tableDurationMinutes: 120,
  largeTableDurationMinutes: 150,
  largeTableFromPartySize: 6,
  leadTimeMinutes: 60,
  maxAdvanceDays: 90,
  cancellationCutoffHours: 24,
  amendCutoffHours: 4,
  reminderHoursBefore: [24, 3],
  coversPerSlot: 36,
  servicePeriods: [
    {
      id: 'lunch',
      label: 'Lunch',
      firstSeating: '12:00',
      lastSeating: '15:00',
      days: [0, 2, 3, 4, 5, 6],
    },
    {
      id: 'dinner',
      label: 'Dinner',
      firstSeating: '18:00',
      lastSeating: '21:30',
      days: [2, 3, 4, 5, 6],
    },
  ],
  closedDates: [],
  seatingAreas: [
    { id: 'main', label: 'Main Dining Room', description: 'Beneath the timber chandeliers.' },
    { id: 'banquette', label: 'Velvet Banquette', description: 'Forest-green booths, more intimate.' },
    { id: 'bar', label: 'Bar Lounge', description: 'Relaxed seating by the bar.' },
    { id: 'terrace', label: 'Terrace', description: 'Outdoor, weather permitting.' },
  ],
  deposit: { enabled: false, perPersonCents: 25000, appliesFromPartySize: 8 },
  cancellationPolicyText:
    'Plans change — we understand. Please cancel or amend at least 24 hours before your booking so we can offer the table to another guest.',
  noShowPolicyText:
    'If you are running late, please call us: tables are held for 15 minutes. Bookings not honoured are recorded as a no-show.',
  updatedAt: '2026-09-01T00:00:00+02:00',
};

export function tableDurationFor(policy: BookingPolicy, partySize: number): number {
  return partySize >= policy.largeTableFromPartySize
    ? policy.largeTableDurationMinutes
    : policy.tableDurationMinutes;
}

export function depositFor(
  policy: BookingPolicy,
  partySize: number,
  depositFlag: boolean,
): number {
  if (!depositFlag || !policy.deposit.enabled) return 0;
  if (partySize < policy.deposit.appliesFromPartySize) return 0;
  return policy.deposit.perPersonCents * partySize;
}
