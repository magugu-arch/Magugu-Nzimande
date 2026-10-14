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
