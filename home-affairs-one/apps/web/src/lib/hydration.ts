'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * False while rendering on the server and during hydration, true afterwards.
 * Use it for values that only exist in the browser (the clock, storage), so the
 * first client render matches the static HTML and nothing is set in an effect.
 *
 *   const hydrated = useHydrated();
 *   const greeting = hydrated ? greetingFor() : 'Welcome';
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
