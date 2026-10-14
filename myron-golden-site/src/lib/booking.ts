import type { EventBooking, SiteEvent } from '@/content/types';
import { isUpcoming } from './events';

/**
 * Booking rules shared by the pages, the form and the server action. Pure:
 * the clock is passed in, and nothing here reads the environment.
 */

/** What the form asks for: payment, a free place, or a request while the price is unconfirmed. */
export type BookingMode = 'paid' | 'free' | 'request';

export function bookingMode(booking: Pick<EventBooking, 'priceCents'>): BookingMode {
  if (booking.priceCents === null) return 'request';
  return booking.priceCents === 0 ? 'free' : 'paid';
}

export type Availability = 'open' | 'none' | 'ended' | 'closed' | 'sold-out' | 'cutoff-passed';

/** Whether an event takes bookings on this site right now. */
export function bookingAvailability(
  event: Pick<SiteEvent, 'booking' | 'end' | 'registrationCutoff' | 'ticketUrl'>,
  now: number,
): Availability {
  if (!event.booking || event.ticketUrl) return 'none';
  if (!isUpcoming(event, now)) return 'ended';
  if (event.booking.status !== 'open') return event.booking.status;
  if (event.registrationCutoff && Date.parse(event.registrationCutoff) <= now) {
    return 'cutoff-passed';
  }
  return 'open';
}

export const availabilityMessages: Record<Exclude<Availability, 'open' | 'none'>, string> = {
  ended: 'This event has finished, so it no longer takes bookings.',
  closed: 'Booking for this event is closed.',
  'sold-out': 'This event is fully booked.',
  'cutoff-passed': 'Registration for this event has closed.',
};

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatUsd(cents: number): string {
  return usd.format(cents / 100);
}

/** Order total in cents, or null while the price is unconfirmed. */
export function orderTotal(
  booking: Pick<EventBooking, 'priceCents'>,
  quantity: number,
): number | null {
  return booking.priceCents === null ? null : booking.priceCents * quantity;
}

export function seatsLabel(quantity: number): string {
  return `${quantity} ${quantity === 1 ? 'seat' : 'seats'}`;
}

/** Short, unambiguous reference people can quote: no 0/O or 1/I. */
export function bookingReference(random: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(random() * alphabet.length)];
  return `MG-${out.slice(0, 4)}-${out.slice(4)}`;
}

export const BOOKING_REFERENCE = /^MG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
