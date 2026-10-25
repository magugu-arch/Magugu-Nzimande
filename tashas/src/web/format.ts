import type { Booking, BookingStatus, Branch } from '../domain/types.ts';
import { sys, getDevice } from './app.ts';
import { dateKeyAt, formatDateLong, formatDateShort, timeKeyAt } from '../domain/util/time.ts';
import { HOUR, MINUTE, DAY } from '../domain/util/core.ts';

export const now = () => sys.ctx.clock.now();

export function me() {
  return sys.db.get('guests', getDevice().guestId);
}

export function branch(id: string): Branch {
  return sys.ctx.content.branches.find((b) => b.id === id)!;
}

export function greeting(): string {
  const h = Number(timeKeyAt(now(), 120).slice(0, 2));
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(): string {
  return me()?.name.split(' ')[0] ?? '';
}

export function ago(t: number): string {
  const d = now() - t;
  if (d < MINUTE) return 'Just now';
  if (d < HOUR) return `${Math.floor(d / MINUTE)} min ago`;
  if (d < DAY) return `${Math.floor(d / HOUR)} h ago`;
  if (d < 7 * DAY) return `${Math.floor(d / DAY)} d ago`;
  return formatDateLong(dateKeyAt(t, 120));
}

export function whenLabel(b: { date: string; time: string }): string {
  const today = dateKeyAt(now(), 120);
  const tomorrow = dateKeyAt(now() + DAY, 120);
  const day = b.date === today ? 'Today' : b.date === tomorrow ? 'Tomorrow' : formatDateLong(b.date);
  return `${day} at ${b.time}`;
}

export function dateParts(date: string) {
  return formatDateShort(date);
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: 'Confirming',
  confirmed: 'Confirmed',
  amended: 'Confirmed · changed',
  cancelled: 'Cancelled',
  completed: 'Visited',
  'no-show': 'Not attended',
  waitlisted: 'Waitlist',
};

export function statusTone(s: BookingStatus): 'good' | 'bad' | 'warn' | '' {
  if (s === 'confirmed' || s === 'amended') return 'good';
  if (s === 'cancelled' || s === 'no-show') return 'bad';
  if (s === 'waitlisted' || s === 'requested') return 'warn';
  return '';
}

export function myBookings(): Booking[] {
  const id = getDevice().guestId;
  return sys.db.where('bookings', (b) => b.guestId === id).sort((a, b) => a.startsAt - b.startsAt);
}

export function upcoming(): Booking[] {
  const t = now();
  return myBookings().filter((b) => ['confirmed', 'amended', 'waitlisted', 'requested'].includes(b.status) && b.startsAt > t - 2 * HOUR);
}

export function past(): Booking[] {
  const soon = new Set(upcoming().map((b) => b.id));
  return myBookings()
    .filter((b) => !soon.has(b.id))
    .sort((a, b) => b.startsAt - a.startsAt);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function pct(v: number | null): string {
  return v === null ? '–' : `${Math.round(v * 100)}%`;
}

/** Distance in km between two coordinates (haversine). */
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

export function idempotencyKey(prefix: string): string {
  return `${prefix}-${sys.ctx.ids.id('k')}`;
}
