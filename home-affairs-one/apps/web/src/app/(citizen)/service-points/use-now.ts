'use client';

import { useSyncExternalStore } from 'react';

/** Re-check the clock often enough that a minute never shows late for long. */
function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(timer);
}

/** The current minute. Stable between ticks, so React only re-renders when it changes. */
function currentMinute(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

function noClock(): number {
  return 0;
}

/**
 * The current time as an ISO string, to the minute, kept up to date in the
 * browser. `null` in the static HTML and during hydration, because the clock
 * only exists on the person's device.
 */
export function useNowIso(): string | null {
  const minute = useSyncExternalStore(subscribe, currentMinute, noClock);
  return minute === 0 ? null : new Date(minute).toISOString();
}
