/**
 * Calendar-day helpers. Bookings are for days in South Africa, so "today" is
 * computed in Africa/Johannesburg and days are handled as YYYY-MM-DD strings,
 * never as Date objects that drift across timezones.
 */
export const TIMEZONE = 'Africa/Johannesburg';

export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Monday-first weeks covering the month, padded with neighbouring days. */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = addDays(first.toISOString().slice(0, 10), -offset);
  const weeks: string[][] = [];
  let cursor = start;
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  } while (Number(cursor.slice(5, 7)) === month);
  return weeks;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

const LONG = new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const MEDIUM = new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const MONTH = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function formatDayLong(iso: string): string {
  return LONG.format(new Date(`${iso}T00:00:00Z`));
}
export function formatDay(iso: string): string {
  return MEDIUM.format(new Date(`${iso}T00:00:00Z`));
}
export function formatMonth(iso: string): string {
  return MONTH.format(new Date(`${iso.slice(0, 7)}-01T00:00:00Z`));
}
export function formatMoment(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short', timeZone: TIMEZONE }).format(new Date(isoTimestamp));
}
