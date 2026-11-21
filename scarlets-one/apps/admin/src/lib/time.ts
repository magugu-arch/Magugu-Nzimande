/** Times are stored in UTC and typed in UK time, the venue's zone. */
export const CONSOLE_TIME_ZONE = 'Europe/London';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

function wallClockParts(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

/** How far the zone's wall clock is ahead of UTC at an instant, in ms. */
function offsetAt(instant: number, timeZone: string): number {
  const p = wallClockParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(instant / MINUTE) * MINUTE;
}

/**
 * Turn the value of a `datetime-local` field ("2026-11-23T12:00"), read as
 * wall-clock time in `timeZone`, into an ISO UTC instant. Null when the text
 * is not a real date and time.
 */
export function zonedInputToUtc(local: string, timeZone = CONSOLE_TIME_ZONE): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(local.trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(naive);
  // Date.UTC rolls 31 February over into March: reject anything that moved.
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) {
    return null;
  }
  let utc = naive - offsetAt(naive, timeZone);
  // Near a clock change the first guess can land on the wrong side of it.
  const corrected = naive - offsetAt(utc, timeZone);
  if (corrected !== utc) utc = corrected;
  return new Date(utc).toISOString();
}

/** The reverse: an ISO instant as a `datetime-local` value in `timeZone`. */
export function utcToZonedInput(iso: string, timeZone = CONSOLE_TIME_ZONE): string {
  const p = wallClockParts(new Date(iso).getTime(), timeZone);
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
