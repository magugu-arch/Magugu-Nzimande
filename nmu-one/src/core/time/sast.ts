/**
 * South African Standard Time helpers.
 *
 * NMU runs on SAST (UTC+02:00, no daylight saving), and a student's timetable
 * must read the same whether the phone is set to Gqeberha or London. Rather
 * than lean on Intl time-zone support — which varies across Hermes builds —
 * every wall-clock calculation shifts by the fixed offset and reads UTC fields.
 */

export const SAST_OFFSET_MINUTES = 120;
const OFFSET_MS = SAST_OFFSET_MINUTES * 60_000;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface SastParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  /** 0 = Sunday */
  weekday: number;
}

const toDate = (d: Date | string): Date => (typeof d === 'string' ? new Date(d) : d);

export function sastParts(input: Date | string): SastParts {
  const shifted = new Date(toDate(input).getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** A Date for a SAST wall-clock time. */
export function sastDate(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hours, minutes) - OFFSET_MS);
}

export function startOfSastDay(input: Date | string): Date {
  const p = sastParts(input);
  return sastDate(p.year, p.month, p.day);
}

export function addMinutes(input: Date | string, minutes: number): Date {
  return new Date(toDate(input).getTime() + minutes * 60_000);
}

export function addDays(input: Date | string, days: number): Date {
  return addMinutes(input, days * 24 * 60);
}

/** Calendar days between two instants, counted on SAST dates. */
export function sastDayDiff(from: Date | string, to: Date | string): number {
  return Math.round(
    (startOfSastDay(to).getTime() - startOfSastDay(from).getTime()) / (24 * 60 * 60_000),
  );
}

export const minutesBetween = (from: Date | string, to: Date | string): number =>
  Math.round((toDate(to).getTime() - toDate(from).getTime()) / 60_000);

const pad = (n: number) => n.toString().padStart(2, '0');

/** "09:30" */
export function formatTime(input: Date | string): string {
  const p = sastParts(input);
  return `${pad(p.hours)}:${pad(p.minutes)}`;
}

/** "Tuesday 6 October" */
export function formatDayLong(input: Date | string): string {
  const p = sastParts(input);
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month - 1]}`;
}

/** "Tue 6 Oct" */
export function formatDayShort(input: Date | string): string {
  const p = sastParts(input);
  return `${WEEKDAYS[p.weekday]!.slice(0, 3)} ${p.day} ${MONTHS[p.month - 1]!.slice(0, 3)}`;
}

/** "6 October 2026" */
export function formatDateLong(input: Date | string): string {
  const p = sastParts(input);
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

/** "Today", "Tomorrow", "Thu 8 Oct" relative to `now`. */
export function formatRelativeDay(input: Date | string, now: Date): string {
  const diff = sastDayDiff(now, input);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDayShort(input);
}

/** "in 18 min", "in 2 h 5 min", "now", "12 min ago" */
export function formatCountdown(target: Date | string, now: Date): string {
  const mins = minutesBetween(now, target);
  if (mins === 0) return 'now';
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span = h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  return mins > 0 ? `in ${span}` : `${span} ago`;
}

/** "Good morning" / "Good afternoon" / "Good evening" on SAST time. */
export function greetingFor(input: Date): string {
  const { hours } = sastParts(input);
  if (hours < 12) return 'Good morning';
  if (hours < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "2 min ago", "3 h ago", "Mon 5 Oct" for notification timestamps. */
export function formatAgo(input: Date | string, now: Date): string {
  const mins = minutesBetween(input, now);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} h ago`;
  return formatDayShort(input);
}
