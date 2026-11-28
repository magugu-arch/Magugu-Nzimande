'use client';

import { useSyncExternalStore } from 'react';
import { ymdInSast } from '@/lib/time';

const noSubscribe = () => () => {};

/**
 * A value only the browser knows (today's date, device features), read without
 * a hydration mismatch and without setting state in an effect: the server and
 * the hydration pass see `serverValue`, then React re-renders with `read()`.
 * `read` must return the same value each call while nothing has changed
 * (a string, number or boolean is safest).
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noSubscribe, read, () => serverValue);
}

/** Today's date in South Africa ("YYYY-MM-DD"), or null before hydration. */
export function useTodaySast(): string | null {
  return useClientValue<string | null>(() => ymdInSast(new Date()), null);
}

/** True once the component is running in the browser after hydration. */
export function useHydrated(): boolean {
  return useClientValue(() => true, false);
}
