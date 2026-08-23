import type { OpeningHours, Store } from '@/types';
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
 * A Monday, so every fixture lands on a day the branch trades.
 *
 * Built in the running process's own zone rather than pinned to +02:00, on
 * purpose: `isStoreOpenAt` compares published wall-clock hours against the
 * device's wall clock, so a fixed offset here would test the test harness's
 * timezone rather than the rule. (It caught me out first time — the suite runs
 * in UTC, so a "10:00 SAST" fixture read as 08:00 and the branch was shut.)
 */
const at = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return new Date(2026, 7, 24, hour, minute);
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
    expect(isTradingNow(closedSundays, new Date(2026, 7, 23, 14, 0))).toBe(false);
  });
});
