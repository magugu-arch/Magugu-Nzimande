/**
 * Branch-local calendar arithmetic.
 *
 * A booking is made for a wall-clock time at a café, so dates are carried as
 * `YYYY-MM-DD` and times as `HH:MM` in the branch's zone, alongside the UTC
 * instant they resolve to. South Africa has no daylight saving, so a fixed
 * offset per branch is exact; a branch abroad gets its own offset in content.
 */

export type DateKey = string; // YYYY-MM-DD
export type TimeKey = string; // HH:MM

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKeyAt(epochMs: number, utcOffsetMinutes: number): DateKey {
  const d = new Date(epochMs + utcOffsetMinutes * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function timeKeyAt(epochMs: number, utcOffsetMinutes: number): TimeKey {
  const d = new Date(epochMs + utcOffsetMinutes * 60_000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function toEpoch(date: DateKey, time: TimeKey, utcOffsetMinutes: number): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  return Date.UTC(y, m - 1, d, hh, mm) - utcOffsetMinutes * 60_000;
}

export function addDays(date: DateKey, days: number): DateKey {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: DateKey): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function minutesOf(time: TimeKey): number {
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  return hh * 60 + mm;
}

export function timeOf(minutes: number): TimeKey {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** ISO 8601 with the branch's own offset, e.g. 2026-11-02T09:30:00+02:00. */
export function isoWithOffset(epochMs: number, utcOffsetMinutes: number): string {
  const sign = utcOffsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(utcOffsetMinutes);
  return `${dateKeyAt(epochMs, utcOffsetMinutes)}T${timeKeyAt(epochMs, utcOffsetMinutes)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateLong(date: DateKey): string {
  const [, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${WEEKDAYS[weekday(date)]} ${d} ${MONTHS[m - 1]}`;
}

export function formatDateShort(date: DateKey): { weekday: string; day: number; month: string } {
  const [, m, d] = date.split('-').map(Number) as [number, number, number];
  return { weekday: WEEKDAYS[weekday(date)]!.slice(0, 3), day: d, month: MONTHS[m - 1]! };
}
