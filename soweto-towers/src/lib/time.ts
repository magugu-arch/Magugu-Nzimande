/**
 * Date helpers for South African Standard Time. SAST is UTC+2 all year (no
 * daylight saving), so a calendar day is a plain 'YYYY-MM-DD' string and a
 * moment is that string plus 'HH:MM' at a fixed +02:00 offset.
 */

export const SAST_OFFSET = '+02:00';
export const TZ = 'Africa/Johannesburg';

export type Ymd = string; // 'YYYY-MM-DD'
export type Hm = string; // 'HH:MM'

const pad = (n: number) => String(n).padStart(2, '0');

/** The SAST calendar date for an instant. */
export function ymdInSast(at: Date): Ymd {
  const shifted = new Date(at.getTime() + 2 * 3600_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function hmInSast(at: Date): Hm {
  const shifted = new Date(at.getTime() + 2 * 3600_000);
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

export function sastInstant(ymd: Ymd, hm: Hm = '00:00'): Date {
  return new Date(`${ymd}T${hm}:00${SAST_OFFSET}`);
}

export function isYmd(value: unknown): value is Ymd {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

export function isHm(value: unknown): value is Hm {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** 0 = Sunday … 6 = Saturday, for a calendar date. */
export function weekday(ymd: Ymd): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

export function addDays(ymd: Ymd, days: number): Ymd {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: Ymd, b: Ymd): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export function hmToMinutes(hm: Hm): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToHm(minutes: number): Hm {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

const weekdayLong = new Intl.DateTimeFormat('en-ZA', { weekday: 'long', timeZone: 'UTC' });
const dayMonth = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const dayMonthShort = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayMonthYear = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const atNoon = (ymd: Ymd) => new Date(`${ymd}T12:00:00Z`);

/** "Friday 12 February" */
export function formatDayLong(ymd: Ymd): string {
  return `${weekdayLong.format(atNoon(ymd))} ${dayMonth.format(atNoon(ymd))}`;
}

/** "Fri 12 Feb" */
export function formatDayShort(ymd: Ymd): string {
  return `${weekdayLong.format(atNoon(ymd)).slice(0, 3)} ${dayMonthShort.format(atNoon(ymd))}`;
}

/** "28 November 2027" */
export function formatDate(ymd: Ymd): string {
  return dayMonthYear.format(atNoon(ymd));
}

export function formatMonthYear(ymd: Ymd): string {
  return monthYear.format(atNoon(ymd));
}

export function weekdayName(day: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] ?? '';
}
