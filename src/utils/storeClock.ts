/**
 * The kitchen's clock, which is the only one this app has any business
 * reading.
 *
 * Everything the customer is told about time here is a claim about a South
 * African kitchen: the hours a branch trades, the fifteen-minute slot they
 * picked, the day an order was placed, the window it should arrive in. None of
 * those are facts about where the customer's phone thinks it is. They were all
 * being computed from the device's wall clock anyway — `getHours`, `getDay`,
 * `new Date(y, m, d, …)` — because for a South African chain on a South
 * African customer's phone the two clocks are the same and the difference is
 * invisible.
 *
 * `utils/tradingHours` has carried a note about this since it was written,
 * saying the openness check reads the device clock and that fixing openness
 * alone would trade one wrong answer for an inconsistent app — that it was
 * worth revisiting as one piece. This is that piece.
 *
 * Two things made it worth doing rather than deferring again:
 *
 * 1. It is not only a travelling customer. **The test suite runs in UTC.**
 *    Every assertion in this repository about a formatted time, a trading
 *    window or a schedule slot has been checking the app against a clock two
 *    hours behind the kitchen's, and passing, because the code under test read
 *    the same wrong clock as the test. A shared mistake between a function and
 *    its test is not a check; it is the two of them agreeing.
 *
 * 2. The consequence is not cosmetic. A customer whose phone is behind SAST
 *    picks a slot labelled `18:00`, the app builds that instant from *their*
 *    wall clock, and the kitchen receives an order due at some other hour —
 *    possibly after it has shut. The label and the instant disagreed, and the
 *    disagreement was invisible on both ends.
 *
 * ## Why arithmetic and not `Intl`
 *
 * South African Standard Time is UTC+02:00 and has no daylight saving — the
 * country tried it twice in the 1940s and has not since. So the conversion is
 * a fixed offset, and none of this needs a timezone database. That matters
 * because Hermes ships without full ICU on some builds, which is already why
 * `formatTime`, `formatShortDate` and `groupDigits` are hand-rolled here
 * rather than handed to `toLocaleString`. A store clock that depended on
 * `Intl.DateTimeFormat` with a `timeZone` option would be the one piece of
 * date handling in the app that quietly did something else on a device without
 * ICU, and it would do it to the times that decide whether an order can be
 * cooked.
 *
 * ## Components, not a shifted Date
 *
 * The usual trick is to add the offset to a `Date` and read its local getters.
 * That yields an object whose *displayed* fields are right and whose epoch is
 * two hours wrong, and nothing in the type system says which of those a caller
 * is holding. Given that this codebase already has instants flowing through it
 * — `scheduledFor`, `placedAt`, ETA arithmetic — handing one more `Date` around
 * with a different meaning is how the next defect gets written.
 *
 * So the conversion returns plain numbers, and the inverse takes plain numbers
 * and returns a real instant. A `Date` in this app always means an instant.
 */

/** SAST. Fixed: no daylight saving, and none since 1944. */
export const STORE_UTC_OFFSET_MINUTES = 2 * 60;

/** The store's wall clock, broken into the fields the rules actually ask for. */
export interface StoreClock {
  year: number;
  /** 0-11, matching `Date`. */
  month: number;
  /** Day of the month, 1-31. */
  date: number;
  /** 0 = Sunday, matching `Date.getDay`. */
  day: number;
  hour: number;
  minute: number;
  /** `hour * 60 + minute` — what every trading-window comparison wants. */
  minutesIntoDay: number;
  /**
   * Days since the epoch in store time, for comparing two moments by the day
   * they fell on. Cheaper and safer than building midnight Dates to subtract.
   */
  dayNumber: number;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/**
 * Read an instant on the store's clock.
 *
 * Via the UTC getters rather than the local ones, so the answer does not
 * depend on where this code is running — which is the entire point, and is why
 * a version of this that used `getHours` would pass its tests in UTC and be
 * wrong on a phone in Johannesburg.
 */
export function storeClockAt(now: Date = new Date()): StoreClock {
  const shifted = new Date(now.getTime() + STORE_UTC_OFFSET_MINUTES * MS_PER_MINUTE);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    day: shifted.getUTCDay(),
    hour,
    minute,
    minutesIntoDay: hour * 60 + minute,
    dayNumber: Math.floor(shifted.getTime() / MS_PER_DAY),
  };
}

/**
 * The inverse: the instant at which the store's clock reads these fields.
 *
 * Overflow is deliberate and load-bearing. `Date.UTC` normalises out-of-range
 * arguments, so `{ hour: 24, minute: 15 }` is a quarter past midnight the next
 * morning and `{ date: 32 }` is the first of the next month. The scheduler
 * needs the first of those: a branch trading to 00:30 has a window whose close
 * is past 1440 minutes, and the slots after midnight belong to the night
 * before them, which is how anybody ordering at eleven on a Friday thinks
 * about it.
 */
export function instantAtStoreTime(parts: {
  year: number;
  month: number;
  date: number;
  hour?: number;
  minute?: number;
}): Date {
  const utcMs = Date.UTC(parts.year, parts.month, parts.date, parts.hour ?? 0, parts.minute ?? 0);
  return new Date(utcMs - STORE_UTC_OFFSET_MINUTES * MS_PER_MINUTE);
}

/**
 * Whether the phone and the kitchen are reading the same clock.
 *
 * Used to decide whether to say so on screen, and nothing else. The app's
 * answers do not change with this — every time it shows is store time either
 * way — but a customer in London being shown `18:00` when their own phone says
 * `17:00` deserves the one line that explains it, and a customer in Cape Town
 * should never see that line.
 *
 * `getTimezoneOffset` is read at the given instant rather than once, because a
 * device in a zone that observes daylight saving has two different answers
 * depending on the date, and the note should be right on both sides of the
 * change.
 */
export function deviceIsOnStoreTime(now: Date = new Date()): boolean {
  return -now.getTimezoneOffset() === STORE_UTC_OFFSET_MINUTES;
}

/**
 * The one sentence shown when they are not, or null when they are.
 *
 * Kept here beside the rule rather than written into a screen, because more
 * than one surface needs it — the scheduler and the order timeline both show
 * times a customer might otherwise check against their own phone — and two
 * copies of a sentence like this drift into saying different things about the
 * same fact.
 */
export function clockNotice(now: Date = new Date()): string | null {
  return deviceIsOnStoreTime(now)
    ? null
    : 'Times shown are South African time (SAST), not your device’s.';
}
