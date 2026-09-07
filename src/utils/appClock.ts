/**
 * Which instant it is — as opposed to `utils/storeClock`, which answers what
 * the kitchen's wall clock reads at a given instant.
 *
 * Two different questions, and last round only settled the second. Every rule
 * in this app that decides something still starts from `new Date()`, which is
 * the *device's* answer, and a phone's clock is not a fact — it is a setting.
 * It resets when the battery dies, it can be set by hand, and a device that
 * has lost its network time source drifts. Every sweep in this repository pins
 * the clock to a chosen instant, which to the app is indistinguishable from a
 * correct one, so a wrong clock is a state the code has always supported and
 * nothing has ever produced.
 *
 * What it costs, on a phone whose clock is out:
 *
 *   - `cardHasExpired` refuses a good card, or accepts a dead one. A year
 *     slow and 09/26 still looks current.
 *   - `voucherExpired` and `rewardExpired` take a benefit away from somebody
 *     entitled to it, quietly, with no way to argue.
 *   - `isTradingNow` puts an order into a shut kitchen — order BBQ-4823 for
 *     the third time, through a third door.
 *   - `hasPassed` tells a customer "that time has passed" about a slot that
 *     has not.
 *
 * ## The signal was already on the wire
 *
 * Every HTTP response carries a `Date` header. It is the server's own clock,
 * it costs nothing, it needs no credential, no contract and no third-party
 * service, and this app was throwing it away on every request. So the fix is
 * to read it: the server's clock is the authority for anything the kitchen or
 * the money depends on, because the server is what the kitchen reads.
 *
 * **It only ever corrects from something observed.** With no response seen
 * yet, the offset is zero and `appNow()` is exactly `new Date()` — the app
 * falls back to the device rather than guessing, which is the honest failure
 * and also the one that keeps the whole thing working offline.
 */

/** Milliseconds to add to the device clock to get the server's. */
let offsetMs = 0;

/**
 * Screens holding a `now`, so they can be told when it moves under them.
 *
 * Learned rather than designed in. The first version of this had no
 * notification at all, and `audit:skew` caught what that costs: the schedule
 * screen computes its slot grid in a `useMemo` over the `now` from `useNow`,
 * `useNow` ticks on an interval and on app foreground, and the correction is
 * neither — so a phone thirteen hours out rendered its grid from the device
 * clock, the correction landed a moment later, and nothing re-rendered. The
 * store screen passed at the same time, because its list arrives *after* the
 * response that carries the correction.
 *
 * That is the same defect `useNow` itself was written to fix — a memo caching
 * an answer derived from something it never declared — with the clock offset
 * in place of the clock.
 */
const listeners = new Set<() => void>();

/** Told when the offset changes, which is at most a handful of times a session. */
export function onClockCorrected(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The round trip of the sample that produced it.
 *
 * Kept so a later, worse sample cannot replace a better one. Half the round
 * trip is the error bar on a single measurement — a response that took four
 * seconds tells you the server's time to within two — so the fastest exchange
 * seen is the most trustworthy, which is the one rule NTP and this file share.
 */
let bestRoundTripMs = Number.POSITIVE_INFINITY;

/**
 * Below this, an apparent difference is measurement rather than skew.
 *
 * `Date` headers have one-second resolution and the round trip adds more, so a
 * few seconds of apparent offset is noise. Nothing in this app turns on a few
 * seconds: slots are fifteen minutes apart, trading hours turn on the minute,
 * card expiry on the month. Correcting inside the noise would trade a
 * measurable error for an unmeasurable one.
 */
const NOISE_FLOOR_MS = 30_000;

/**
 * Above this, the customer is told. Below it, the app corrects and says
 * nothing — because there is nothing a customer could usefully do about
 * ninety seconds, and a notice that fires constantly is one nobody reads.
 */
const WORTH_SAYING_MS = 5 * 60_000;

/**
 * Record what the server said the time was.
 *
 * `sentAt` and `receivedAt` are the device's own readings either side of the
 * request, and the midpoint between them is the device's best guess at the
 * moment the server stamped its header. Comparing against `receivedAt` alone
 * would fold the whole round trip into the offset and report every slow
 * connection as a broken clock.
 */
export function noteServerTime(header: string | null, sentAt: number, receivedAt: number): void {
  if (!header) return;

  const serverMs = Date.parse(header);
  if (Number.isNaN(serverMs)) return;

  const roundTrip = receivedAt - sentAt;
  // A negative round trip means the device clock moved under us mid-request,
  // which is exactly the condition this file exists for and also makes the
  // sample worthless. Drop it; the next one will be clean.
  if (roundTrip < 0) return;
  if (roundTrip > bestRoundTripMs) return;

  bestRoundTripMs = roundTrip;
  const observed = serverMs - (sentAt + receivedAt) / 2;
  const corrected = Math.abs(observed) < NOISE_FLOOR_MS ? 0 : observed;

  // Only on a real change, so an app that talks to the server every few
  // seconds does not re-render every screen holding a clock for nothing.
  if (corrected === offsetMs) return;
  offsetMs = corrected;
  for (const listener of listeners) listener();
}

/**
 * The instant every decision in this app should start from.
 *
 * Named for what it is rather than `now()`, because the point is that it is
 * *not* automatically the device's now, and a caller reading `now()` would
 * have no reason to wonder.
 */
export function appNow(): Date {
  return new Date(Date.now() + offsetMs);
}

/** How far out the device is, in minutes, or null when nothing has been observed. */
export function clockSkewMinutes(): number | null {
  if (bestRoundTripMs === Number.POSITIVE_INFINITY) return null;
  return Math.round(offsetMs / 60_000);
}

/**
 * The sentence shown when the difference is big enough to confuse somebody.
 *
 * Says which way and roughly how far, because "your clock is wrong" is not
 * actionable and "about two hours slow" is — it is enough for a customer to
 * recognise the cause, and it explains why the times on screen do not match
 * the ones on their lock screen.
 *
 * Deliberately not an error and not a blocker. The app has the right time and
 * is using it; this is an explanation, not a refusal. Refusing to take an
 * order because a customer's phone clock is wrong would be punishing them for
 * something the app has already worked around.
 */
export function skewNotice(): string | null {
  if (Math.abs(offsetMs) < WORTH_SAYING_MS) return null;

  const minutes = Math.abs(Math.round(offsetMs / 60_000));
  const direction = offsetMs > 0 ? 'slow' : 'fast';
  const rough =
    minutes >= 2880
      ? `${Math.round(minutes / 1440)} days`
      : minutes >= 120
        ? `${Math.round(minutes / 60)} hours`
        : `${minutes} minutes`;

  return `Your device’s clock is about ${rough} ${direction}, so times here are set from ours.`;
}

/**
 * Forget everything observed — a test seam, and the same shape as
 * `resetSessionState` in the API client.
 *
 * Not exported for the app to call. A sign-out does not make the server's
 * clock less true, and clearing the offset there would hand the next customer
 * on a shared phone the broken clock the previous one had already worked past.
 */
export function resetAppClock(): void {
  offsetMs = 0;
  bestRoundTripMs = Number.POSITIVE_INFINITY;
  listeners.clear();
}
