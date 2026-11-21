/**
 * Formatting helpers. Dates are shown in South African Standard Time unless a
 * service point is in another time zone, in which case both are shown.
 */
const SAST = 'Africa/Johannesburg';

const dateTime = new Intl.DateTimeFormat('en-ZA', {
  timeZone: SAST,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const dateOnly = new Intl.DateTimeFormat('en-ZA', {
  timeZone: SAST,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const dayAndDate = new Intl.DateTimeFormat('en-ZA', {
  timeZone: SAST,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeOnly = new Intl.DateTimeFormat('en-ZA', {
  timeZone: SAST,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** `21 Nov 2026, 10:42` */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** `21 November 2026` */
export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}

/** `Saturday, 21 November` */
export function formatDay(iso: string): string {
  return dayAndDate.format(new Date(iso));
}

/** `10:42` */
export function formatTime(iso: string): string {
  return timeOnly.format(new Date(iso));
}

/** Time in another zone, with its short zone name: `08:42 GMT`. */
export function formatTimeInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(new Date(iso));
}

const relative = new Intl.RelativeTimeFormat('en-ZA', { numeric: 'auto' });

/** `40 minutes ago`, `yesterday`, `in 3 days`. Falls back to a date beyond a month. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 30 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day');
  return formatDate(iso);
}

/** Sample amounts only: `R 1.00`. The prototype never shows a real fee. */
export function formatSampleAmount(amountCents: number): string {
  return `R ${(amountCents / 100).toFixed(2)}`;
}

export function greetingFor(date: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-ZA', { timeZone: SAST, hour: 'numeric', hour12: false }).format(
      date,
    ),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
