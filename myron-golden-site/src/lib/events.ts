import type { EventFormat, EventType, SiteEvent } from '@/content/types';

/**
 * Event date logic. An event belongs to "upcoming" until it has *ended*, so a
 * session in progress is still listed; once the end passes it moves to the
 * archive and can never be presented as upcoming again (brief §6, Events).
 * `now` is always passed in, which keeps this pure and testable and lets the
 * page decide how fresh "now" needs to be.
 */

export function isUpcoming(event: Pick<SiteEvent, 'end'>, now: number): boolean {
  return Date.parse(event.end) > now;
}

export function splitEvents<T extends Pick<SiteEvent, 'start' | 'end'>>(
  events: readonly T[],
  now: number,
): { upcoming: T[]; past: T[] } {
  const upcoming = events
    .filter((e) => isUpcoming(e, now))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const past = events
    .filter((e) => !isUpcoming(e, now))
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  return { upcoming, past };
}

export const eventTypeLabels: Record<EventType, string> = {
  workshop: 'Workshop',
  keynote: 'Keynote',
  'live-training': 'Live training',
  networking: 'Networking',
  fireside: 'Fireside conversation',
};

export const eventFormatLabels: Record<EventFormat, string> = {
  online: 'Online',
  'in-person': 'In person',
};

/** Calendar parts of an instant, in the event's own time zone. */
export function zonedParts(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** "2026-11" — the month an event falls in, where it is held. */
export function monthKey(event: Pick<SiteEvent, 'start' | 'timezone'>): string {
  const { year, month } = zonedParts(event.start, event.timezone);
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y!, m! - 1, 1)));
}

export function formatEventDate(event: Pick<SiteEvent, 'start' | 'timezone'>): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: event.timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(event.start));
}

export function formatEventShortDate(event: Pick<SiteEvent, 'start' | 'timezone'>) {
  const d = new Date(event.start);
  const tz = event.timezone;
  return {
    month: new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short' }).format(d),
    day: new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' }).format(d),
    weekday: new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d),
  };
}

/** "6:00 – 7:30 PM CST", in the zone the event is held in. */
export function formatEventTime(event: Pick<SiteEvent, 'start' | 'end' | 'timezone'>): string {
  const fmt = (iso: string, withZone: boolean) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: event.timezone,
      hour: 'numeric',
      minute: '2-digit',
      ...(withZone ? { timeZoneName: 'short' } : {}),
    }).format(new Date(iso));
  return `${fmt(event.start, false)} – ${fmt(event.end, true)}`;
}

export interface CalendarDay {
  /** yyyy-mm-dd */
  date: string;
  day: number;
  inMonth: boolean;
}

/**
 * A Monday-first grid of weeks covering `monthKey`, padded with the trailing
 * and leading days of the neighbouring months.
 */
export function calendarGrid(key: string): CalendarDay[][] {
  const [year, month] = key.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7; // Monday = 0
  const cells: CalendarDay[] = [];
  for (let i = -leading; cells.length < leading + daysInMonth || cells.length % 7 !== 0; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 + i));
    cells.push({
      date: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month - 1,
    });
  }
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** yyyy-mm-dd of the event's start, where it is held. */
export function eventDayKey(event: Pick<SiteEvent, 'start' | 'timezone'>): string {
  const { year, month, day } = zonedParts(event.start, event.timezone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
