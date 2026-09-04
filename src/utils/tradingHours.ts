import type { OpeningHours, Store } from '@/types';

/**
 * Whether a branch is trading, worked out from its hours rather than read off
 * a stored flag.
 *
 * `Store.isOpenNow` is a fact about a moment, and the app kept it like a fact
 * about a place: seeded `true` on every branch, never recomputed on fetch, and
 * then persisted whole into the selected-store snapshot, where it survived
 * until the customer cleared the app. At half past three in the morning the
 * store list said "Open now" against all seven branches and checkout took the
 * order — verified end to end, order BBQ-4823, to a kitchen that had shut five
 * hours earlier.
 *
 * The hours were already here and already right. `isStoreOpenAt` had a passing
 * test and not one caller. Nothing was wrong with the answer; nothing asked
 * for it.
 *
 * Pure and dependency-free on purpose: the service needs it at fetch time and
 * the fulfilment store needs it again at decision time, and neither should
 * have to import the other to get it.
 */

/** Trading window for a given weekday, or null when closed that day. */
export function hoursForDay(
  store: Store,
  day: number,
): { opensAt: string; closesAt: string } | null {
  const entry = store.openingHours.find((hours: OpeningHours) => hours.day === day);
  return entry ? { opensAt: entry.opensAt, closesAt: entry.closesAt } : null;
}

/**
 * Published hours are store-local wall-clock strings ("10:00"), and this compares
 * them against the device's wall clock. For a South African chain on a South
 * African customer's phone those are the same clock, which is the case worth
 * getting right first.
 *
 * They come apart for a customer whose phone is set to another timezone, who
 * would be told a Johannesburg branch is open on their own local hours. Left
 * alone deliberately: scheduling, the ETA windows and the order timeline all
 * read the device clock too, so converting openness alone would trade one
 * wrong answer for an inconsistent app. Worth revisiting as one piece — SAST
 * is UTC+2 with no daylight saving, so it is fixed-offset arithmetic and does
 * not need `Intl`, which Hermes ships without.
 */
const MINUTES_IN_A_DAY = 24 * 60;

/**
 * A published window as minutes from the start of its own day, unwrapped.
 *
 * The rule that needs to exist exactly once: **a closing time at or before the
 * opening time means the kitchen shuts after midnight.** Two places compare
 * these strings — this file and the scheduler in `utils/datetime` — and both
 * had their own copy of the arithmetic, both reading `closesAt` as a plain
 * count of minutes from midnight. Handed `11:00`–`00:30` that makes the close
 * *thirty minutes* and the open *six hundred and sixty*, so the window is
 * empty and the branch is shut for the entire day — not merely after midnight,
 * which is the part somebody would think to check.
 *
 * So the close is pushed past 1440 rather than left to sort itself out at each
 * call site. `close` may therefore exceed a day, and callers have to say what
 * they mean by "now" in the same terms; that is the point of returning it this
 * way rather than a boolean.
 *
 * Equal times read as a full 24 hours, which is the only sensible reading of
 * "10:00 to 10:00" and costs nothing to allow.
 */
export function tradingWindow(hours: { opensAt: string; closesAt: string }): {
  open: number;
  close: number;
} {
  const [openHour = 0, openMinute = 0] = hours.opensAt.split(':').map(Number);
  const [closeHour = 0, closeMinute = 0] = hours.closesAt.split(':').map(Number);

  const open = openHour * 60 + openMinute;
  const close = closeHour * 60 + closeMinute;

  return { open, close: close <= open ? close + MINUTES_IN_A_DAY : close };
}

export function isStoreOpenAt(store: Store, when: Date = new Date()): boolean {
  const minutesNow = when.getHours() * 60 + when.getMinutes();
  const day = when.getDay();

  const today = hoursForDay(store, day);
  if (today) {
    const { open, close } = tradingWindow(today);
    if (minutesNow >= open && minutesNow < close) return true;
  }

  /**
   * Yesterday's window may still be running.
   *
   * At a quarter past midnight on a Saturday the branch is open on the
   * strength of *Friday's* entry, and Saturday's own has not started. Checking
   * only today's row is why the naive fix — clamping the close to the end of
   * the day — would still have turned the customer away at the counter at
   * 00:15 with the lights on.
   */
  const yesterday = hoursForDay(store, (day + 6) % 7);
  if (yesterday) {
    const { close } = tradingWindow(yesterday);
    if (close > MINUTES_IN_A_DAY && minutesNow + MINUTES_IN_A_DAY < close) return true;
  }

  return false;
}

/**
 * The window a card should print: the one actually running, not today's row.
 *
 * Found in the browser rather than in a test, at a quarter past midnight on a
 * Sunday. The V&A branch trades to 00:30 on a Saturday night, so it was open —
 * correctly — and the card printed Sunday's row beside the badge: **"Open now ·
 * 11:00 – 22:00"**, fifteen minutes before last orders. Both halves were
 * true of some day and the pair was a lie, which is the same shape as the
 * defect this card's own notes describe: the badge reading one source and the
 * hours row another.
 *
 * Outside a spill this is just today's row, so nothing changes for the six
 * branches that shut before midnight.
 */
export function windowInForce(
  store: Store,
  now: Date = new Date(),
): { opensAt: string; closesAt: string } | null {
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  const yesterday = hoursForDay(store, (now.getDay() + 6) % 7);
  if (yesterday) {
    const { close } = tradingWindow(yesterday);
    if (close > MINUTES_IN_A_DAY && minutesNow + MINUTES_IN_A_DAY < close) return yesterday;
  }

  return hoursForDay(store, now.getDay());
}

/**
 * The question every caller actually wants answered: can this branch cook
 * right now?
 *
 * Both sources get a veto, and neither gets to override the other. The flag
 * can shut a branch the published hours say is open — a power cut, a burst
 * pipe, a shift nobody turned up for, all of which the kitchen knows and the
 * timetable does not. The hours can shut a branch whose flag has gone stale,
 * which is the common case, because the flag is only as fresh as the last
 * fetch and the snapshot in storage may be days old.
 *
 * A branch that publishes no hours at all falls back to the flag. Treating an
 * absent timetable as "closed" would be the tidier rule and the wrong one: a
 * backend that stops sending `openingHours` would silently stop the business
 * from taking orders, and a data gap should not read as a shut door.
 */
export function isTradingNow(store: Store, now: Date = new Date()): boolean {
  if (!store.isOpenNow) return false;
  if (store.openingHours.length === 0) return true;
  return isStoreOpenAt(store, now);
}

/**
 * *Why* a branch is not trading, which decides what a customer can do about it.
 *
 * The two closures above are not the same kind of fact and the app treated
 * them as one. A branch shut by its timetable reopens at a time everybody can
 * read off the card, so "schedule for later" is exactly the right offer. A
 * branch shut by its own flag — the power cut, the burst pipe, the shift
 * nobody turned up for — has no known reopening at all, and offering to
 * schedule around it is offering something nobody can honour.
 *
 * `'unavailable'` is deliberately narrow: only when the flag is the thing
 * doing the shutting. A branch that is flag-closed at three in the morning is
 * reported as `'hours'`, because it is shut either way and the timetable is
 * the more useful answer — it reopens at ten.
 */
export type ClosureReason = 'hours' | 'unavailable';

export function closureReason(store: Store, now: Date = new Date()): ClosureReason | null {
  if (isTradingNow(store, now)) return null;

  // Its published hours would have it open, and it is shut anyway.
  const timetableSaysOpen = store.openingHours.length === 0 || isStoreOpenAt(store, now);
  return !store.isOpenNow && timetableSaysOpen ? 'unavailable' : 'hours';
}
