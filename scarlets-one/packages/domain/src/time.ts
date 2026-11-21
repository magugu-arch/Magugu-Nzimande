import type { Locale } from './i18n';

const intlLocale = (locale: Locale) => (locale === 'cy' ? 'cy-GB' : 'en-GB');

function formatter(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), options);
  } catch {
    // An engine without Welsh locale data still gets the right time in English.
    return new Intl.DateTimeFormat('en-GB', options);
  }
}

export interface VenueTime {
  /** "Sat 5 Dec" */
  date: string;
  /** "Saturday 5 December 2026" */
  longDate: string;
  /** "17:00" in the venue's own time zone */
  time: string;
  /** "GMT", "BST" */
  zone: string;
  day: string;
  month: string;
  weekday: string;
}

/**
 * Timestamps are stored in UTC and shown in venue-local time, with the zone
 * named, so a supporter abroad never reads the kick-off in their own time by
 * mistake.
 */
export function formatVenueTime(iso: string, timeZone: string, locale: Locale): VenueTime {
  const date = new Date(iso);
  const part = (options: Intl.DateTimeFormatOptions) =>
    formatter(locale, { timeZone, ...options }).format(date);
  const zone =
    formatter('en', { timeZone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
  // Assembled from single fields: a combined pattern punctuates differently
  // from one JavaScript engine to the next ("Saturday, 5 December" on some).
  const day = part({ day: 'numeric' });
  const weekday = part({ weekday: 'short' });
  const month = part({ month: 'short' });
  return {
    date: `${weekday} ${day} ${month}`,
    longDate: `${part({ weekday: 'long' })} ${day} ${part({ month: 'long' })} ${part({ year: 'numeric' })}`,
    time: part({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    zone,
    day,
    month,
    weekday,
  };
}

/** Calendar day at the venue, as YYYY-MM-DD. */
export function venueDayKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export interface Countdown {
  past: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export function countdownTo(targetIso: string, now: Date): Countdown {
  const totalMs = new Date(targetIso).getTime() - now.getTime();
  const remaining = Math.max(0, totalMs);
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    past: totalMs <= 0,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
  };
}

/** "10:02" in venue time: used for "Updated at" stamps. */
export function formatStamp(iso: string, timeZone: string, locale: Locale): string {
  return formatter(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export function formatShortDate(iso: string, timeZone: string, locale: Locale): string {
  return formatter(locale, { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  );
}
