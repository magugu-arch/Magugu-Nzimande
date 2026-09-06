import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Order, Store } from '@/types';
import { stores } from '@/services/data/storeData';
import { fetchStores, fetchStoresForFulfilment } from '@/services/storeService';
import { fetchMenu } from '@/services/menuService';
import { fetchOrders } from '@/services/orderService';
import { hoursForDay, isStoreOpenAt } from '@/utils/tradingHours';
import { buildScheduleDays } from '@/utils/datetime';
import { isDiallable } from '@/utils/linking';
import { isSoldOut } from '@/features/menu/availability';
import { runningLate, RUNNING_LATE_LABEL, liveStatusCopy } from '@/features/orders/liveStatus';
import { instantAtStoreTime, storeClockAt } from '@/utils/storeClock';

const code = (file: string) =>
  readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const bryanston = (): Store => {
  const store = stores.find((candidate) => candidate.id === 'store-bryanston');
  if (!store) throw new Error('store-bryanston is not seeded');
  return store;
};

/**
 * 2026-09-06 is a Sunday; 2026-09-07 a Monday — on the store's calendar, which
 * is the only one these rules read. See `utils/storeClock`.
 */
const sast = (year: number, month: number, date: number, hour = 0, minute = 0) =>
  instantAtStoreTime({ year, month, date, hour, minute });

const sundayNoon = sast(2026, 8, 6, 12, 0);
const mondayNoon = sast(2026, 8, 7, 12, 0);

/**
 * FIXTURE 1 — a branch that does not trade on Sundays.
 *
 * `OpeningHours` is a row per day and every branch had all seven, built by
 * `Array.from({ length: 7 })` with identical times. A timetable with a gap in
 * it had never existed, so three rules that read the array by day each had a
 * "no entry for this day" path that had never run.
 */
describe('a branch with a six-day trading week', () => {
  it('is seeded with a gap rather than a seventh row', () => {
    const hours = bryanston().openingHours;

    expect(hours).toHaveLength(6);
    expect(hours.map((entry) => entry.day).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('has no hours to give for the day it is shut', () => {
    expect(hoursForDay(bryanston(), 0)).toBeNull();
    expect(hoursForDay(bryanston(), 1)).toEqual({ opensAt: '10:00', closesAt: '22:00' });
  });

  it('is closed all Sunday and open on Monday', () => {
    expect(isStoreOpenAt(bryanston(), sundayNoon)).toBe(false);
    expect(isStoreOpenAt(bryanston(), mondayNoon)).toBe(true);
  });

  /**
   * Saturday's window closes at 22:00, so it does not spill into Sunday — the
   * "yesterday may still be running" path must not rescue a shut day. That
   * path exists for the V&A branch, which closes at 00:30.
   */
  it('is not held open by Saturday spilling over', () => {
    expect(isStoreOpenAt(bryanston(), sast(2026, 8, 6, 0, 15))).toBe(false);
  });

  /**
   * The scheduler skips the day rather than offering a grid of times nobody
   * will be there for. Every other branch trades seven days, so `windowForDay`
   * returning null had never happened against seeded data.
   */
  it('offers no slots on the day it is shut', () => {
    const days = buildScheduleDays(sast(2026, 8, 4, 12, 0), bryanston());
    const sunday = days.find((day) => storeClockAt(new Date(day.dateIso)).day === 0);
    const monday = days.find((day) => storeClockAt(new Date(day.dateIso)).day === 1);

    expect(sunday).toBeUndefined();
    expect(monday?.slots.length).toBeGreaterThan(0);
  });

  it('still offers slots on the six days it does trade', () => {
    const days = buildScheduleDays(sast(2026, 8, 4, 12, 0), bryanston());

    expect(days.length).toBeGreaterThan(0);
    expect(days.every((day) => storeClockAt(new Date(day.dateIso)).day !== 0)).toBe(true);
  });

  it('leaves every other branch on a seven-day week', () => {
    const partial = stores.filter((store) => store.openingHours.length !== 7);

    expect(partial.map((store) => store.id)).toEqual(['store-bryanston']);
  });
});

/**
 * FIXTURE 2 — a branch that takes delivery and nothing else.
 *
 * `supportsCollection` was `true` on all seven branches, so the collection
 * list had never had to leave one out.
 */
describe('a delivery-only kitchen', () => {
  it('is the only branch that refuses collection', () => {
    const noCounter = stores.filter((store) => !store.supportsCollection);

    expect(noCounter.map((store) => store.id)).toEqual(['store-bryanston']);
  });

  it('is offered for delivery and withheld from collection and dine-in', async () => {
    const [delivery, collection, dinein] = await Promise.all([
      fetchStoresForFulfilment('delivery'),
      fetchStoresForFulfilment('collection'),
      fetchStoresForFulfilment('dinein'),
    ]);
    const has = (list: Store[]) => list.some((store) => store.id === 'store-bryanston');

    expect(has(delivery)).toBe(true);
    expect(has(collection)).toBe(false);
    expect(has(dinein)).toBe(false);
  });

  it('is still in the full network', async () => {
    const all = await fetchStores();

    expect(all.some((store) => store.id === 'store-bryanston')).toBe(true);
  });
});

/**
 * FIXTURE 3 — a branch with no published phone number.
 *
 * Every branch carried one, so `isDiallable` had only ever been given a real
 * number. A delivery-only kitchen has no front desk to answer a call, which
 * makes the empty string a fact about the site rather than a gap in the data.
 */
describe('a branch nobody can phone', () => {
  it('publishes no number', () => {
    expect(bryanston().phone).toBe('');
    expect(isDiallable(bryanston().phone)).toBe(false);
  });

  it('is the only one, so the row still renders everywhere else', () => {
    const silent = stores.filter((store) => !isDiallable(store.phone));

    expect(silent.map((store) => store.id)).toEqual(['store-bryanston']);
  });

  /**
   * The receipt hides "Call the store" rather than offering a dead button —
   * and "Need help with this order?" is still there, which is why the absence
   * is a gap in the data rather than a dead end.
   */
  it('leaves the order carrying an empty number rather than an invented one', async () => {
    const orders = await fetchOrders();
    const order = orders.find((candidate) => candidate.reference === 'BBQ-4848');

    expect(order?.storePhone).toBe('');
  });

  it('the receipt gates the call row on isDiallable', () => {
    expect(code('src/app/order/[id]/index.tsx')).toMatch(/isDiallable\(data\.storePhone\)/);
  });
});

/**
 * FIXTURE 4 — dishes already hearted.
 *
 * Nothing had ever put anything in the favourites list, and three surfaces are
 * hidden until it is non-empty: Home's carousel, the Menu tab's filter and the
 * filled heart on every row.
 */
describe('a customer with favourites', () => {
  const seeded = (): string[] => {
    const source = code('src/store/favouritesStore.ts');
    const line = source.match(/const SEEDED_FAVOURITES = \[([^\]]+)\]/);
    return [...(line?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]!);
  };

  it('is seeded on a demo build only', () => {
    const source = code('src/store/favouritesStore.ts');

    expect(seeded().length).toBeGreaterThan(0);
    expect(source).toMatch(/productIds: config\.useMockApi \? \[\.\.\.SEEDED_FAVOURITES\] : \[\]/);
  });

  /** Ids, not names — a heart pointing at nothing shows an empty carousel. */
  it('hearts products that are actually on the menu', async () => {
    const menu = await fetchMenu();

    for (const id of seeded()) {
      expect(menu.products.some((product) => product.id === id)).toBe(true);
    }
  });

  /**
   * Deliberate. A favourites list reaches this state within a week, and the
   * carousel had never been asked to draw a card for something nobody can
   * order. Verified in Chromium: the card reads "Sold out".
   */
  it('includes one that cannot currently be ordered', async () => {
    const menu = await fetchMenu();
    const hearted = seeded()
      .map((id) => menu.products.find((product) => product.id === id))
      .filter((product): product is NonNullable<typeof product> => Boolean(product));

    // Unorderable because its required Size group has emptied, not because the
    // product itself was withdrawn — the flag still reads `available: true`,
    // which is exactly why `isSoldOut` has to ask the groups as well.
    expect(hearted.some((product) => isSoldOut(product))).toBe(true);
    expect(hearted.every((product) => product.available)).toBe(true);
  });
});

/**
 * FIXTURE 5 — an order the kitchen is behind on.
 *
 * `advance` is a pure function of elapsed time, so every seeded order arrived
 * exactly when the estimate said it would and backdating a fixture just walked
 * it to `completed` before anybody looked. A mock kinder than the world hides
 * the defects it was built to catch, and this one had a kitchen that was never
 * late.
 */
describe('an order past its estimate', () => {
  const late = async (): Promise<Order> => {
    const orders = await fetchOrders();
    const order = orders.find((candidate) => candidate.reference === 'BBQ-4848');
    if (!order) throw new Error('BBQ-4848 is not seeded');
    return order;
  };

  it('is held at preparing rather than walked on by the clock', async () => {
    const order = await late();

    expect(order.status).toBe('preparing');
    expect(order.delivery).toBeUndefined();
  });

  /**
   * The defect, seen in Chromium: twenty-three minutes past the estimate, the
   * screen showed the same status sentence and the same progress bar as an
   * order two minutes old, and said nothing about the wait. Dropping the
   * countdown is right; leaving nothing in its place is not.
   */
  it('is described as late', async () => {
    expect(runningLate(await late())).toBe(true);
    expect(RUNNING_LATE_LABEL).toBe('Taking longer than expected');
  });

  it('says the fact and nothing more', () => {
    const source = code('src/features/orders/liveStatus.ts');

    expect(source).not.toMatch(/refund|compensat|voucher|sorry/i);
  });

  it('is not called late while it is still inside the estimate', async () => {
    const order = await late();
    const justPlaced = { ...order, placedAt: new Date().toISOString() };

    expect(runningLate(justPlaced)).toBe(false);
  });

  it('is not called late once it is finished or cancelled', async () => {
    const order = await late();

    expect(runningLate({ ...order, status: 'completed' })).toBe(false);
    expect(runningLate({ ...order, status: 'cancelled' })).toBe(false);
  });

  /** A failed delivery has its own sentence; it must not also be "late". */
  it('does not overrule a delivery that failed', async () => {
    const orders = await fetchOrders();
    const failed = orders.find((candidate) => candidate.reference === 'BBQ-4840');

    expect(runningLate(failed!)).toBe(false);
    expect(liveStatusCopy(failed!).label).toBe('Delivery unsuccessful');
  });

  it.each(['src/app/order/[id]/index.tsx', 'src/app/(tabs)/orders.tsx'])(
    '%s prints it where the countdown was',
    (file) => {
      expect(code(file)).toMatch(/runningLate\(/);
      expect(code(file)).toMatch(/RUNNING_LATE_LABEL/);
    },
  );

  it('sends the policy to audit:launch rather than promising anything', () => {
    expect(code('scripts/audit-launch-readiness.mjs')).toMatch(/'Late orders'/);
  });
});
