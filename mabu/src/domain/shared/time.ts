/**
 * Mábu trades in Africa/Johannesburg, which has had no daylight saving since
 * 1944, so SAST is a fixed UTC+02:00. Every booking time is stored as an ISO
 * string with that offset, which keeps "18:30" meaning 18:30 at the venue no
 * matter which zone the guest's phone is set to.
 */
export const VENUE_UTC_OFFSET = '+02:00';
const OFFSET_MS = 2 * 60 * 60 * 1000;

/** '2026-10-27' + '18:30' → '2026-10-27T18:30:00+02:00' */
export function venueIso(date: string, time: string): string {
  return `${date}T${time}:00${VENUE_UTC_OFFSET}`;
}

/** The venue-local calendar date of an instant, as YYYY-MM-DD. */
export function venueDate(instant: Date | string): string {
  const d = new Date(new Date(instant).getTime() + OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

/** The venue-local wall-clock time of an instant, as HH:mm. */
export function venueTime(instant: Date | string): string {
  const d = new Date(new Date(instant).getTime() + OFFSET_MS);
  return d.toISOString().slice(11, 16);
}

/** 0 = Sunday … 6 = Saturday, at the venue. */
export function venueWeekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function minutesOf(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return Number(h) * 60 + Number(m);
}

export function timeOf(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
