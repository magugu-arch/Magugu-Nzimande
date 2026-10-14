import { cacheLife } from 'next/cache';
import { getEvents } from './content';
import { splitEvents } from './events';

/**
 * Upcoming vs past, decided against the clock. Cached for an hour, so an
 * event drops out of "upcoming" within the hour after it ends without the
 * page having to render on every request.
 */
export async function getEventBuckets() {
  'use cache';
  cacheLife('hours');
  return splitEvents(getEvents(), Date.now());
}

/**
 * "Now" for booking pages, on the same hourly cache as the buckets above. The
 * booking action checks against the real clock, so a page an hour stale can
 * only ever show a form that then explains the event has closed.
 */
export async function getBookingClock(): Promise<number> {
  'use cache';
  cacheLife('hours');
  return Date.now();
}
