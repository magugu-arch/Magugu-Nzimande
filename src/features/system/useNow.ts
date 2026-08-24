import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * A clock the render tree can depend on.
 *
 * Screens that decide something about *now* had no way to notice that now had
 * moved. Checkout computed its blocker in a `useMemo` over state — store,
 * address, cart, scheduled time — and time is not state, so nothing ever
 * invalidated it. Verified in a browser: schedule for 18:00 at five o'clock,
 * leave the screen sitting, place the order at half past seven and it went
 * through, confirmed as "Scheduled for Mon, 24 Aug · 18:00".
 *
 * That is the same failure already written up inside
 * `missingFulfilmentRequirement` — a memo caching an answer derived from
 * something it never declared — with the clock in place of the store.
 *
 * A minute is the right cadence: scheduling slots are fifteen minutes apart
 * and trading hours turn on the minute, so a finer tick would re-render for
 * nothing. This is for keeping a screen honest while someone looks at it; the
 * decision that actually moves money re-reads the clock itself at the moment
 * it is made, and does not rely on a render having happened.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, intervalMs);

    // A phone that was asleep comes back minutes or hours later and the
    // interval will not have fired once for any of it — which is precisely
    // the gap that let a stale schedule through.
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') tick();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
