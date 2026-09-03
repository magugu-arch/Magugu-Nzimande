import type { Store } from '@bbq/types';

/**
 * Trading status is computed in South African time regardless of the visitor's
 * clock, because "open now" is a fact about the store, not about the browser.
 */
const SAST_OFFSET_MINUTES = 2 * 60;

const MINUTES_IN_DAY = 24 * 60;

/**
 * The SAST weekday and minute, whatever the visitor's own clock says.
 *
 * The day matters as much as the minute and is easy to get wrong: 23:00 UTC is
 * already tomorrow in Johannesburg, so anything that runs on a given day —
 * a Wednesday offer, a store's hours — has to roll the date over with the time
 * rather than take the UTC day and shift only the clock.
 */
export function sastNow(now: Date = new Date()): { day: number; minute: number } {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const shifted = utcMinutes + SAST_OFFSET_MINUTES;
  return {
    day: (now.getUTCDay() + Math.floor(shifted / MINUTES_IN_DAY)) % 7,
    minute: shifted % MINUTES_IN_DAY,
  };
}

export function minutesNowInSast(now: Date = new Date()): number {
  return sastNow(now).minute;
}

export function isOpenNow(store: Store, now: Date = new Date()): boolean {
  const minute = minutesNowInSast(now);
  const { opensMinute, closesMinute } = store.hours;
  // A closing time past midnight wraps, so the comparison has to allow for a
  // window that starts on one day and ends on the next.
  if (closesMinute > opensMinute) {
    return minute >= opensMinute && minute < closesMinute;
  }
  return minute >= opensMinute || minute < closesMinute;
}

export function formatMinute(minute: number): string {
  const hours = Math.floor(minute / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (minute % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
