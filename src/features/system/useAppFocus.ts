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
    /*
      On web the focus manager already listens for `visibilitychange` itself,
      and AppState never reports anything but 'active'.

      That first clause was an assertion about a third-party library, on the
      one platform where nothing tested it — and the web build is every
      preview, every demo and every desktop customer. If it had been wrong,
      the defect this hook exists to fix would still have been live there, and
      this comment would have been the reason nobody looked.

      `npm run audit:away` now counts it against a stub backend, over three
      forty-second phases on the live tracking screen:

          watched        2 requests
          hidden         0
          watched again  3

      The zero is a measurement rather than an absence: the same sweep run with
      `refetchIntervalInBackground: true` reports 3 while hidden, so it can see
      a poll that keeps running. The claim holds, and it is no longer only a
      claim.
    */
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
}
