import { useCallback, useRef } from 'react';

/**
 * A handler that ignores the second tap while the first one is still running.
 *
 * A phone that is thinking looks exactly like a phone that missed the tap, so
 * people tap again. It is the commonest thing a customer does that nobody
 * draws, and until this existed one control in the app was protected against
 * it: checkout kept a ref and returned early, with a comment explaining why the
 * button's own disabled state was not enough.
 *
 * It is not enough because `loading={mutation.isPending}` is a *rendered*
 * guard. It refuses the second tap only once React has committed and painted
 * the first one, and between the tap and that paint there is a window. Driven
 * rather than reasoned about: `npm run audit:double-tap` presses four controls
 * twice and counts what the server is asked for. Two taps in one tick sent two
 * requests every time —
 *
 *     redeeming a reward        2 × POST /v1/loyalty/redeem
 *     saving a new address      2 × POST /v1/account/addresses
 *     sending a support message 2 × POST /v1/support/messages
 *     rating an order           2 × POST /v1/orders/:id/rating
 *
 * — while the same taps 70ms apart sent one. So the rendered guard does catch a
 * human double-tap on this hardware, on this build, on a good day. That is not
 * a property to rely on for a control that spends points.
 *
 * One hook rather than five copies of a ref, and the reason is in checkout's
 * own history: it had to release the ref by hand on every early return, missed
 * one, and a blocked tap left the button dead for the life of the screen — a
 * customer told "the branch is closed", picking a later slot, and finding that
 * nothing responded. Found by a security review as a functional note. A
 * `finally` around the whole handler cannot make that mistake, because there is
 * no path out of the function that skips it.
 *
 * Re-entry only. This is not a lock against a second tap *after* the first has
 * finished: somebody who redeems, sees it land, and deliberately does it again
 * is entitled to. Nor does it replace the button's `loading` state, which is
 * what tells the customer anything is happening at all — the two do different
 * jobs and the app keeps both.
 */
export function useOnce<Args extends unknown[]>(
  action: (...args: Args) => Promise<void> | void,
): (...args: Args) => Promise<void> {
  // A ref, not state, because this has to be true the instant the first tap
  // lands rather than one render later — which is the entire point.
  const running = useRef(false);

  return useCallback(
    async (...args: Args) => {
      if (running.current) return;
      running.current = true;
      try {
        await action(...args);
      } finally {
        running.current = false;
      }
    },
    [action],
  );
}
