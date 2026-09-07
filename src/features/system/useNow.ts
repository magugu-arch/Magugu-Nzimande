import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { appNow, onClockCorrected } from '@/utils/appClock';

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
  const [now, setNow] = useState(() => appNow());

  useEffect(() => {
    const tick = () => setNow(appNow());
    const timer = setInterval(tick, intervalMs);

    // A phone that was asleep comes back minutes or hours later and the
    // interval will not have fired once for any of it — which is precisely
    // the gap that let a stale schedule through.
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') tick();
    });

    /**
     * And when the clock itself is corrected, which is neither a tick nor a
     * foregrounding.
     *
     * `audit:skew` found this. On a phone thirteen hours out the schedule
     * screen mounted, built its slot grid from the device clock, and then the
     * first response arrived carrying the server's time — and nothing
     * re-rendered, so the customer sat looking at a grid for the wrong day
     * with the corrected clock already in memory. The store screen passed at
     * the same moment, because its list arrives *after* that response.
     *
     * Which is the defect this hook exists to prevent, one level up: an answer
     * derived from something the render never declared. The clock was declared
     * and the clock's own correction was not.
     */
    const unsubscribe = onClockCorrected(tick);

    return () => {
      clearInterval(timer);
      subscription.remove();
      unsubscribe();
    };
  }, [intervalMs]);

  return now;
}
