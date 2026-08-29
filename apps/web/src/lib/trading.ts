import type { Store } from '@bbq/types';

/**
 * Trading status is computed in South African time regardless of the visitor's
 * clock, because "open now" is a fact about the store, not about the browser.
 */
const SAST_OFFSET_MINUTES = 2 * 60;

export function minutesNowInSast(now: Date = new Date()): number {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utcMinutes + SAST_OFFSET_MINUTES) % (24 * 60);
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
