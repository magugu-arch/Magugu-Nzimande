import type { OpeningHours, Store } from '@/types';
import { instantAtStoreTime } from '@/utils/storeClock';
import { hoursForDay, isStoreOpenAt, isTradingNow } from '@/utils/tradingHours';

const HOURS: OpeningHours[] = Array.from({ length: 7 }, (_, day) => ({
  day,
  opensAt: '10:00',
  closesAt: '22:00',
}));

const store = (overrides: Partial<Store> = {}): Store =>
  ({
    id: 'rosebank',
    name: 'bb.q Chicken Rosebank',
    addressLine: '177 Oxford Rd',
    suburb: 'Rosebank',
    city: 'Johannesburg',
    province: 'Gauteng',
    phone: '011 447 2200',
    latitude: -26.1465,
    longitude: 28.0436,
    distanceKm: 1,
    openingHours: HOURS,
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    deliveryRadiusKm: 10,
    preparationMinutes: 20,
    isOpenNow: true,
    ...overrides,
  }) as Store;

/**
 * A Monday, so every fixture lands on a day the branch trades — and pinned to
 * the store's clock, which is the whole point of the fixture.
 *
 * This helper used to build its instants in the running process's own zone,
 * with a comment explaining that a fixed +02:00 offset would "test the test
 * harness's timezone rather than the rule", and noting that it had caught
 * somebody out first time: the suite runs in UTC, so a 10:00 SAST fixture read
 * as 08:00 and the branch came back shut.
 *
 * That reading was upside down, and the evidence for it was the finding. A
 * 10:00 SAST fixture is 08:00 UTC; the old `isStoreOpenAt` read `getHours()`,
 * got 8, and reported the branch shut two hours before it was. The correct
 * fixture had surfaced a real defect on the first attempt. Building it in the
 * process's own zone instead made the fixture wrong in precisely the way the
 * code was wrong, at which point they agreed and the suite went green.
 *
 * The fix went into the fixture and the defect stayed in the app — the failure
 * this file exists to catch, committed by this file.
 *
 * Built through `instantAtStoreTime` rather than a hand-written `- 2 hours`,
 * so the fixture and the rule cannot drift apart: if the offset is ever wrong
 * they are wrong together and every other test here says so.
 */
const at = (time: string) => {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return instantAtStoreTime({ year: 2026, month: 7, date: 24, hour, minute });
};

describe('hoursForDay', () => {
  it('finds the window for a day the branch trades', () => {
    expect(hoursForDay(store(), 1)).toEqual({ opensAt: '10:00', closesAt: '22:00' });
  });

  it('returns nothing for a day with no window', () => {
    const closedSundays = store({ openingHours: HOURS.filter((h) => h.day !== 0) });
    expect(hoursForDay(closedSundays, 0)).toBeNull();
  });
});

describe('isStoreOpenAt', () => {
  it('is open inside the window and shut outside it', () => {
    expect(isStoreOpenAt(store(), at('14:00'))).toBe(true);
    expect(isStoreOpenAt(store(), at('03:30'))).toBe(false);
  });

  it('opens on the minute and closes on the minute', () => {
    expect(isStoreOpenAt(store(), at('09:59'))).toBe(false);
    expect(isStoreOpenAt(store(), at('10:00'))).toBe(true);
    expect(isStoreOpenAt(store(), at('21:59'))).toBe(true);
    // Last orders are before closing time, not at it.
    expect(isStoreOpenAt(store(), at('22:00'))).toBe(false);
  });
});

/**
 * The defect this exists for: `isOpenNow` was a fact about a moment kept like
 * a fact about a place — seeded `true`, never recomputed on fetch, then
 * persisted whole into the selected-store snapshot. At 03:30 the store list
 * said "Open now" against every branch and checkout placed order BBQ-4823 with
 * a kitchen that had shut at 22:00.
 *
 * `isStoreOpenAt` was already here, already correct, and had no callers.
 */
describe('isTradingNow', () => {
  it('refuses a branch the timetable has shut, however fresh the flag looks', () => {
    expect(isTradingNow(store({ isOpenNow: true }), at('03:30'))).toBe(false);
  });

  it('agrees with the flag inside trading hours', () => {
    expect(isTradingNow(store({ isOpenNow: true }), at('14:00'))).toBe(true);
  });

  /**
   * The kitchen keeps its veto. A power cut, a burst pipe or a shift nobody
   * turned up for is something the branch knows and the timetable does not, so
   * a flag saying "shut" wins even in the middle of the published window.
   */
  it('refuses a branch that says it is shut inside its own hours', () => {
    expect(isTradingNow(store({ isOpenNow: false }), at('14:00'))).toBe(false);
  });

  /**
   * A backend that stops sending `openingHours` must not silently stop the
   * business trading. An absent timetable is a data gap, not a shut door.
   */
  it('falls back to the flag when a branch publishes no hours at all', () => {
    expect(isTradingNow(store({ openingHours: [] }), at('03:30'))).toBe(true);
    expect(isTradingNow(store({ openingHours: [], isOpenNow: false }), at('14:00'))).toBe(false);
  });

  it('is shut on a day the branch does not trade', () => {
    const closedSundays = store({ openingHours: HOURS.filter((h) => h.day !== 0) });
    // 23 August 2026 is a Sunday.
    expect(
      isTradingNow(closedSundays, instantAtStoreTime({ year: 2026, month: 7, date: 23, hour: 14 })),
    ).toBe(false);
  });
});
