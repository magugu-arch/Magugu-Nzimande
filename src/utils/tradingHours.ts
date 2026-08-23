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
export function isStoreOpenAt(store: Store, when: Date = new Date()): boolean {
  const hours = hoursForDay(store, when.getDay());
  if (!hours) return false;

  const [openHour = 0, openMinute = 0] = hours.opensAt.split(':').map(Number);
  const [closeHour = 0, closeMinute = 0] = hours.closesAt.split(':').map(Number);
  const minutesNow = when.getHours() * 60 + when.getMinutes();

  return minutesNow >= openHour * 60 + openMinute && minutesNow < closeHour * 60 + closeMinute;
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
