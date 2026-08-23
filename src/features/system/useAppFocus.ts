import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { focusManager } from '@tanstack/react-query';

/**
 * Tells TanStack Query when the app is actually in front of the customer.
 *
 * Query's focus tracking was written for the browser: with nothing wired up,
 * `focusManager.isFocused()` falls back to
 * `globalThis.document?.visibilityState !== 'hidden'`. React Native has no
 * `document`, so that reads `undefined !== 'hidden'` — true, always, forever.
 *
 * The cost of that lands on polling. `refetchIntervalInBackground` defaults to
 * false, and the observer decides "background" by asking the focus manager
 * (queryObserver.js: `refetchIntervalInBackground || focusManager.isFocused()`).
 * Believing itself permanently focused, the app kept refetching live order
 * tracking every 15 seconds and the active order every 30 — while backgrounded,
 * on the customer's mobile data, indefinitely.
 *
 * Note this does not start refetching on return: `refetchOnWindowFocus` stays
 * false, which is a deliberate call about metered connections. The only thing
 * that changes is that the polls now stop when nobody is looking.
 */
export function handleAppStateChange(status: AppStateStatus): void {
  // 'inactive' is the iOS state during an incoming call or the app switcher.
  // It is not in front of the customer, so it counts as unfocused.
  focusManager.setFocused(status === 'active');
}

export function useAppFocus(): void {
  useEffect(() => {
    // On web the focus manager already listens for visibilitychange itself,
    // and AppState never reports anything but 'active'.
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
}
