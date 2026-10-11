import type { BrandEvent } from './types';

/** Fixtures are announced in South African time, which has no daylight saving (UTC+2). */
export const EVENT_TIME_ZONE = 'Africa/Johannesburg';
const SAST_OFFSET_MS = 2 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** The calendar day in South Africa, as YYYY-MM-DD, for any instant. */
export function sastDayKey(at: string | Date): string {
  const d = new Date(new Date(at).getTime() + SAST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Every South African day an event touches — a weekend pop-up marks both days. */
export function eventDayKeys(event: Pick<BrandEvent, 'startsAt' | 'endsAt'>): string[] {
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  const keys: string[] = [];
  for (let t = start; t < end; t += DAY_MS) keys.push(sastDayKey(new Date(t)));
  const last = sastDayKey(new Date(end - 1));
  if (!keys.includes(last)) keys.push(last);
  return keys;
}

export function isPast(event: Pick<BrandEvent, 'endsAt'>, now: Date): boolean {
  return new Date(event.endsAt).getTime() < now.getTime();
}

export function upcoming(events: BrandEvent[], now: Date): BrandEvent[] {
  return events.filter((e) => !isPast(e, now)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * A month as calendar cells, Monday first as South African calendars are:
 * leading and trailing `null`s pad it to whole weeks.
 */
export function monthGrid(year: number, month: number): (string | null)[] {
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function eventsByDay(events: BrandEvent[]): Map<string, BrandEvent[]> {
  const map = new Map<string, BrandEvent[]>();
  for (const e of events) for (const k of eventDayKeys(e)) map.set(k, [...(map.get(k) ?? []), e]);
  return map;
}

/** The next fixture whose edit includes this piece, for "Wear it to…". */
export function nextEventFor(productId: string, events: BrandEvent[], now: Date) {
  return upcoming(events, now).find(
    (e) => e.productIds.includes(productId) && e.rsvp !== 'invite-only',
  );
}

/* ----------------------------------------------------------- calendar file */

const icsDate = (iso: string | Date) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

const icsText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/**
 * RFC 5545 folds lines at 75 octets — octets of UTF-8, not characters, and
 * never through the middle of one. Continuation lines start with a space.
 */
export function icsFold(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const c = ch.codePointAt(0)!;
    const n = c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    if (bytes + n > 75) {
      out.push(current);
      current = ' ';
      bytes = 1;
    }
    current += ch;
    bytes += n;
  }
  out.push(current);
  return out.join('\r\n');
}

/** An iCalendar file for one or more fixtures, labelled as samples while they are. */
export function buildIcs(events: BrandEvent[], now: Date): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MAXHOSA AFRICA//App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const e of events) {
    const where =
      e.city === 'Online'
        ? 'Online — link sent to confirmed guests'
        : `${e.city} — ${e.place}, details shared with confirmed guests`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}-${icsDate(e.startsAt)}@maxhosa-app`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(e.startsAt)}`,
      `DTEND:${icsDate(e.endsAt)}`,
      `SUMMARY:${icsText(e.sample ? `${e.title} (sample event)` : e.title)}`,
      `LOCATION:${icsText(where)}`,
      `DESCRIPTION:${icsText(e.sample ? `Sample event — not a real booking. ${e.summary}` : e.summary)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
