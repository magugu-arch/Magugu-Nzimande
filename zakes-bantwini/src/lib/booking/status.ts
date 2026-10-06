import type { AvailabilityState, BookingStatus } from './types';

/** Brief §05 status table: internal meaning and what the client sees. */
export const STATUS_META: Record<BookingStatus, { label: string; meaning: string; client: string }> = {
  NEW: { label: 'New', meaning: 'Request received', client: 'Request received' },
  IN_REVIEW: { label: 'In review', meaning: 'Management is reviewing', client: 'Under review' },
  QUOTE_SENT: { label: 'Quote sent', meaning: 'Formal quotation issued', client: 'Quote ready' },
  ON_HOLD: { label: 'On hold', meaning: 'Temporary date hold', client: 'Date on hold' },
  AWAITING_DEPOSIT: { label: 'Awaiting deposit', meaning: 'Accepted, payment outstanding', client: 'Secure your date' },
  CONFIRMED: { label: 'Confirmed', meaning: 'Payment and requirements complete', client: 'Booking confirmed' },
  COMPLETED: { label: 'Completed', meaning: 'Event delivered', client: 'Completed' },
  CANCELLED: { label: 'Cancelled', meaning: 'Booking cancelled', client: 'Cancelled' },
};

/**
 * Allowed moves. Anything not listed is refused by the service layer, so a
 * booking cannot skip from NEW to CONFIRMED by a mis-click.
 */
export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  NEW: ['IN_REVIEW', 'ON_HOLD', 'CANCELLED'],
  IN_REVIEW: ['ON_HOLD', 'QUOTE_SENT', 'CANCELLED'],
  ON_HOLD: ['IN_REVIEW', 'QUOTE_SENT', 'CANCELLED'],
  QUOTE_SENT: ['AWAITING_DEPOSIT', 'IN_REVIEW', 'ON_HOLD', 'CANCELLED'],
  AWAITING_DEPOSIT: ['CONFIRMED', 'QUOTE_SENT', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The client's timeline — the brief's twelve-step process, collapsed to what they act on. */
export const CLIENT_TIMELINE: { status: BookingStatus; title: string; detail: string }[] = [
  { status: 'NEW', title: 'Request received', detail: 'Your reference is issued and the booking team is notified.' },
  { status: 'IN_REVIEW', title: 'Management review', detail: 'Date, format and requirements are checked against the calendar.' },
  { status: 'QUOTE_SENT', title: 'Quote', detail: 'A formal quotation with deposit, balance and terms.' },
  { status: 'AWAITING_DEPOSIT', title: 'Agreement and deposit', detail: 'Accept the quote, sign the agreement and pay the deposit.' },
  { status: 'CONFIRMED', title: 'Confirmed', detail: 'The date is secured and event planning begins.' },
  { status: 'COMPLETED', title: 'Event delivered', detail: 'Thank you.' },
];

const ORDER: BookingStatus[] = ['NEW', 'IN_REVIEW', 'QUOTE_SENT', 'AWAITING_DEPOSIT', 'CONFIRMED', 'COMPLETED'];

/** Index of the furthest timeline step a status has reached (ON_HOLD sits at review). */
export function timelineIndex(status: BookingStatus): number {
  if (status === 'ON_HOLD') return 1;
  if (status === 'CANCELLED') return -1;
  return ORDER.indexOf(status);
}

/** Which calendar state a booking status implies for its event date, if any. */
export function availabilityFor(status: BookingStatus): AvailabilityState | null {
  switch (status) {
    case 'ON_HOLD':
    case 'QUOTE_SENT':
    case 'AWAITING_DEPOSIT':
      return 'ON_HOLD';
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'CONFIRMED';
    default:
      return null;
  }
}
