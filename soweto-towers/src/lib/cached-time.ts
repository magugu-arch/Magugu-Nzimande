import { cacheLife } from 'next/cache';
import { ymdInSast } from './time';

/**
 * Cache Components treats the current time as request data. These helpers give
 * prerendered pages a clock that is allowed to be a little stale.
 */

export async function currentYear(): Promise<number> {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}

/** Today's SAST date, refreshed hourly in the static shell. */
export async function todaySast(): Promise<string> {
  'use cache';
  cacheLife('hours');
  return ymdInSast(new Date());
}
