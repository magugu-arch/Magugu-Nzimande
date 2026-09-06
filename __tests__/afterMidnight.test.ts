import type { OpeningHours, Store } from '@/types';
import { buildScheduleDays } from '@/utils/datetime';
import { closureReason, isStoreOpenAt, isTradingNow, windowInForce } from '@/utils/tradingHours';
import { stores } from '@/services/data/storeData';
import { instantAtStoreTime, storeClockAt } from '@/utils/storeClock';

/**
 * A trading window that ends after midnight.
 *
 * Every window in the seed used to close before it — 22:00, and 23:00 on a
 * Friday — so `closesAt` was always a larger number of minutes past midnight
 * than `opensAt`, and the two places that compare them were only ever asked
 * the easy question. Both do the same arithmetic:
 *
 *     minutesNow >= openHour * 60 + openMinute &&
 *     minutesNow <  closeHour * 60 + closeMinute
 *
 * Give that `11:00`–`00:30` and it reads the close as **thirty minutes past
 * the start of the day**, which is before the open. The window is empty. A
 * branch trading until half past midnight is reported shut for the whole of
 * Friday and the whole of Saturday, from eleven in the morning onward — not
 * just after midnight, which is the part somebody would think to check.
 *
 * The scheduler does it too, from its own copy of the arithmetic, so the same
 * branch offers no collection or delivery slots on either day.
 *
 * Korean fried chicken is late-night food. This is a weekend, not an edge case.
 */
const LATE: OpeningHours[] = Array.from({ length: 7 }, (_, day) => ({
  day,
  opensAt: '11:00',
  closesAt: day === 5 || day === 6 ? '00:30' : '22:00',
}));

const store = (openingHours: OpeningHours[], overrides: Partial<Store> = {}): Store =>
  ({
    id: 'store-vanda',
    name: 'bb.q Chicken V&A Waterfront',
    addressLine: 'Shop 6142, Victoria Wharf',
    suburb: 'V&A Waterfront',
    city: 'Cape Town',
    province: 'Western Cape',
    phone: '021 418 9900',
    latitude: -33.9036,
    longitude: 18.4201,
    openingHours,
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    deliveryRadiusKm: 10,
    preparationMinutes: 21,
    isOpenNow: true,
    ...overrides,
  }) as Store;

/**
 * Built on the store's clock, which is what a fixture reading "Saturday 00:15"
 * has always meant.
 *
 * It used to be built in the running process's own zone, citing the note in
 * `tradingHours.test.ts` about pinning an offset testing the harness rather
 * than the rule. That note has been rewritten: it was describing a defect and
 * calling it a design. The rule now reads the kitchen's clock, so a fixture
 * that says quarter past midnight in Johannesburg says it here too.
 */
const at = (year: number, month: number, day: number, hour: number, minute = 0) =>
  instantAtStoreTime({ year, month: month - 1, date: day, hour, minute });

// 2026-09-04 is a Friday, 2026-09-05 a Saturday, 2026-09-06 a Sunday.
const FRIDAY_EVENING = at(2026, 9, 4, 20, 0);
const FRIDAY_LUNCH = at(2026, 9, 4, 12, 30);
const SATURDAY_QUARTER_PAST = at(2026, 9, 5, 0, 15);
const SATURDAY_ONE_AM = at(2026, 9, 5, 1, 0);
const SATURDAY_MORNING = at(2026, 9, 5, 9, 0);

describe('a branch that trades past midnight', () => {
  const late = store(LATE);

  it.each([
    ['Friday lunchtime', FRIDAY_LUNCH],
    ['Friday evening', FRIDAY_EVENING],
  ])('is open on %s, hours away from the wrap', (_label, when) => {
    // The part that is not about midnight at all. A branch whose Friday runs
    // 11:00–00:30 is plainly open at half past twelve, and the old arithmetic
    // said no — which is why this was a whole weekend rather than an hour of it.
    expect(isStoreOpenAt(late, when)).toBe(true);
    expect(isTradingNow(late, when)).toBe(true);
  });

  it('is open at a quarter past midnight, on the strength of the day before', () => {
    // Saturday, 00:15. Saturday's own window has not opened. Friday's is still
    // running, and the customer standing at the counter knows it.
    expect(isStoreOpenAt(late, SATURDAY_QUARTER_PAST)).toBe(true);
  });

  it('is shut at one in the morning, half an hour after last orders', () => {
    expect(isStoreOpenAt(late, SATURDAY_ONE_AM)).toBe(false);
    expect(closureReason(late, SATURDAY_ONE_AM)).toBe('hours');
  });

  it('is shut on Saturday morning, before it opens again', () => {
    expect(isStoreOpenAt(late, SATURDAY_MORNING)).toBe(false);
  });

  /**
   * The flag still wins. A branch shut by the kitchen is shut at 00:15 too,
   * and the reason is the flag rather than the clock — which is what decides
   * whether the app offers to schedule around it.
   */
  it('still answers to the kitchen', () => {
    const shut = store(LATE, { isOpenNow: false });

    expect(isTradingNow(shut, SATURDAY_QUARTER_PAST)).toBe(false);
    expect(closureReason(shut, SATURDAY_QUARTER_PAST)).toBe('unavailable');
  });

  it('leaves an ordinary window alone', () => {
    const ordinary = store(
      Array.from({ length: 7 }, (_, day) => ({ day, opensAt: '10:00', closesAt: '22:00' })),
    );

    expect(isStoreOpenAt(ordinary, at(2026, 9, 4, 14, 0))).toBe(true);
    expect(isStoreOpenAt(ordinary, at(2026, 9, 4, 23, 0))).toBe(false);
    expect(isStoreOpenAt(ordinary, at(2026, 9, 5, 0, 15))).toBe(false);
  });
});

describe('scheduling against a window that wraps', () => {
  const late = store(LATE);

  it('offers slots on the day the branch is open', () => {
    const days = buildScheduleDays(FRIDAY_LUNCH, late);
    const today = days[0];

    expect(today).toBeDefined();
    expect(today!.slots.length).toBeGreaterThan(0);
  });

  it('runs the last slots past midnight rather than stopping at 22:00', () => {
    const days = buildScheduleDays(FRIDAY_LUNCH, late);
    const friday = days[0]!;
    const latest = new Date(friday.slots[friday.slots.length - 1]!.iso);

    // The window ends at 00:30 on Saturday and last orders are a step before
    // it, so the final slot is 00:15 the next calendar day.
    // Read on the kitchen's clock, not the process's. These assertions used to
    // call `getHours()` on the instant directly, which is the device reading
    // again — under a UTC test runner the correct 00:15 SAST slot comes back as
    // 22:15 the day before, and the assertion that caught this was the fixture
    // agreeing with the bug rather than the bug being absent.
    const at15 = storeClockAt(latest);
    expect(at15.hour).toBe(0);
    expect(at15.minute).toBe(15);
    expect(at15.date).toBe(5);
  });

  it('never offers a slot the branch would be shut for', () => {
    for (const day of buildScheduleDays(FRIDAY_LUNCH, late)) {
      for (const slot of day.slots) {
        expect(isStoreOpenAt(late, new Date(slot.iso))).toBe(true);
      }
    }
  });

  it('leaves an ordinary branch last orders at 21:45', () => {
    const ordinary = store(
      Array.from({ length: 7 }, (_, day) => ({ day, opensAt: '10:00', closesAt: '22:00' })),
    );
    const days = buildScheduleDays(at(2026, 9, 4, 12, 0), ordinary);
    const latest = new Date(days[0]!.slots[days[0]!.slots.length - 1]!.iso);

    expect(storeClockAt(latest).hour).toBe(21);
    expect(storeClockAt(latest).minute).toBe(45);
  });
});

/**
 * What the store card prints beside the badge.
 *
 * Found in Chromium with the clock pinned, not here: at a quarter past
 * midnight on a Sunday the V&A card read **"Open now · 11:00 – 22:00"**. Both
 * halves were true of some day — it was open, on Saturday night's window, and
 * Sunday does run 11:00 to 22:00 — and the pair told a customer they had until
 * ten at night when last orders were fifteen minutes away.
 */
describe('the window a card should print', () => {
  const late = store(LATE);

  it('shows the late window still running, not the new day\u2019s row', () => {
    // Sunday 00:15. Saturday's 11:00–00:30 is what the kitchen is working to.
    expect(windowInForce(late, at(2026, 9, 6, 0, 15))).toEqual({
      opensAt: '11:00',
      closesAt: '00:30',
    });
  });

  it('shows today once the spill has ended', () => {
    expect(windowInForce(late, at(2026, 9, 6, 1, 0))).toEqual({
      opensAt: '11:00',
      closesAt: '22:00',
    });
  });

  it('shows today for an ordinary branch, unchanged', () => {
    const ordinary = store(
      Array.from({ length: 7 }, (_, day) => ({ day, opensAt: '10:00', closesAt: '22:00' })),
    );

    expect(windowInForce(ordinary, at(2026, 9, 6, 0, 15))).toEqual({
      opensAt: '10:00',
      closesAt: '22:00',
    });
  });

  it('has nothing to print for a day the branch is shut', () => {
    const weekdaysOnly = store([
      { day: 1, opensAt: '10:00', closesAt: '22:00' },
      { day: 2, opensAt: '10:00', closesAt: '22:00' },
    ]);

    // A Sunday, which has no entry at all.
    expect(windowInForce(weekdaysOnly, at(2026, 9, 6, 12, 0))).toBeNull();
  });
});

/**
 * And the seed carries one, or none of the above is reachable from the app.
 */
describe('the store network', () => {
  it('has a branch whose window crosses midnight', () => {
    const wrapping = stores.filter((candidate) =>
      candidate.openingHours.some((hours) => hours.closesAt < hours.opensAt),
    );

    expect(wrapping.length).toBeGreaterThan(0);
  });
});
