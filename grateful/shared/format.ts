/**
 * Formatting shared by the UI and the emails, so a booking reads the same in
 * the browser, in the inbox and on the receipt.
 *
 * All dates and times are Africa/Johannesburg wall-clock values. South Africa
 * has observed a fixed UTC+02:00 with no daylight saving since 1944, which is
 * why the offset can be written down rather than looked up.
 */

export const TIME_ZONE = 'Africa/Johannesburg';
export const SAST_OFFSET = '+02:00';

export function formatRand(cents: number): string {
  const rands = cents / 100;
  return `R ${rands.toLocaleString('en-ZA', {
    minimumFractionDigits: rands % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`.replace(/\u00a0/g, ' ');
}

export function formatPriceState(priceCents: number | null): string {
  return priceCents == null ? 'Quote required' : `From ${formatRand(priceCents)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** The instant a SAST wall-clock date + time refers to. */
export function sastToDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${SAST_OFFSET}`);
}

/** "Saturday 4 October 2026" */
export function formatLongDate(date: string): string {
  return sastToDate(date, '12:00').toLocaleDateString('en-ZA', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "10:30" → "10:30" in 24h, which is how South Africans read a booking. */
export function formatTime(time: string): string {
  return time;
}

/** Today's date in Johannesburg as YYYY-MM-DD, whatever the server's zone. */
export function todayInSast(now: Date = new Date()): string {
  return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMinutes(time: string, minutes: number): string {
  const total = toMinutes(time) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
