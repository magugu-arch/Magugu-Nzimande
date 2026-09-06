import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Order } from '@/types';
import { fetchOrders, seedOrderLedger } from '@/services/orderService';
import { fetchLoyaltyAccount } from '@/services/rewardsService';
import { fetchMenu } from '@/services/menuService';
import { notifications } from '@/services/data/accountData';
import { stores } from '@/services/data/storeData';
import { STANDING_RAILS } from '@/features/checkout/paymentOptions';
import { describePaymentMethod } from '@/services/paymentService';
import { describeOptions } from '@/utils/cart';
import { directionsTargetFor } from '@/features/orders/directions';
import { isDiallable } from '@/utils/linking';

const code = (file: string) =>
  readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const orderNamed = async (reference: string): Promise<Order> => {
  const orders = await fetchOrders();
  const order = orders.find((candidate) => candidate.reference === reference);
  if (!order) throw new Error(`${reference} is not seeded`);
  return order;
};

/**
 * 1 and 2 — the two rails no order had ever been settled with.
 *
 * `paymentMethodLabel` had only ever read "Visa ending 4821", "Mastercard
 * ending 7702" or "SnapScan", so `describePaymentMethod`'s cash and EFT
 * branches — the ones that stop a receipt saying "Paid with: Card" for money
 * handed over at a front door — had no seeded example.
 */
describe('every rail the app offers has been used', () => {
  it('covers all three standing rails across the seeded orders', async () => {
    const orders = await fetchOrders();
    const labels = new Set(orders.map((order) => order.paymentMethodLabel));

    for (const rail of STANDING_RAILS) {
      expect(labels.has(describePaymentMethod(rail.type))).toBe(true);
    }
  });

  it('names cash and EFT through the helper rather than typing them out', () => {
    const seed = code('src/services/orderService.ts');

    expect(seed).toMatch(/paymentMethodLabel: describePaymentMethod\('cash'\)/);
    expect(seed).toMatch(/paymentMethodLabel: describePaymentMethod\('eft'\)/);
  });

  /**
   * The defect these two found. `paymentMethodLabel` is written onto every
   * order at placement, and drawn on exactly one screen: the confirmation,
   * seen once immediately after paying. The receipt — what somebody checks a
   * week later — never said how the money left.
   */
  it('is on the receipt, not only the confirmation', () => {
    expect(code('src/app/order/[id]/index.tsx')).toMatch(/Paid with \{data\.paymentMethodLabel\}/);
  });
});

/** 3 — the first order anybody was unhappy with. */
describe('an order rated one star', () => {
  it('is seeded with words to match', async () => {
    const order = await orderNamed('BBQ-4862');

    expect(order.rating).toBe(1);
    expect(order.ratingComment).toMatch(/Arrived cold/);
  });

  it('is the low end of a spread that still has happy orders in it', async () => {
    const orders = await fetchOrders();
    const ratings = orders
      .map((order) => order.rating)
      .filter((rating): rating is number => rating !== undefined);

    expect(Math.min(...ratings)).toBe(1);
    expect(Math.max(...ratings)).toBe(5);
  });

  /** The rating screen's unhappy half was reachable only by tapping a star. */
  it('is what the rating screen asks a different question about', () => {
    const screen = code('src/app/order/[id]/rate.tsx');

    expect(screen).toMatch(/rating >= 4 \? POSITIVE_TAGS : rating > 0 \? NEGATIVE_TAGS/);
    expect(screen).toMatch(/What went wrong\?/);
  });
});

/**
 * 4 — a line with nothing chosen on it.
 *
 * Every seeded line carried at least one selected option, so `describeOptions`
 * returning an empty string — and every screen having to hide its caption
 * rather than print a stray separator — had never happened.
 */
describe('a line nobody chose an option on', () => {
  it('is seeded, on a product whose only group is optional', async () => {
    const [order, menu] = await Promise.all([orderNamed('BBQ-4864'), fetchMenu()]);
    const line = order.lines[0]!;
    const product = menu.products.find((candidate) => candidate.id === line.productId);

    expect(line.selectedOptions).toEqual([]);
    expect(product?.optionGroups.every((group) => group.minSelect === 0)).toBe(true);
  });

  it('describes as nothing rather than as a stray separator', async () => {
    const order = await orderNamed('BBQ-4864');

    expect(describeOptions(order.lines[0]!)).toBe('');
  });
});

/** 5 — dine-in ordered at the counter, with no table to bring it to. */
describe('a dine-in order with no table number', () => {
  it('is seeded', async () => {
    const order = await orderNamed('BBQ-4866');

    expect(order.fulfilmentType).toBe('dinein');
    expect(order.tableNumber).toBeUndefined();
  });

  it('leaves the other dine-in orders carrying one', async () => {
    const orders = await fetchOrders();
    const dinein = orders.filter((order) => order.fulfilmentType === 'dinein');

    expect(dinein.length).toBeGreaterThan(1);
    expect(dinein.some((order) => order.tableNumber)).toBe(true);
  });
});

/**
 * 6 — an order placed at a branch that has since closed.
 *
 * The reason an order carries a snapshot of the store rather than an id: the
 * name, phone and address are copied at placement so a receipt survives the
 * branch. Every seeded order had named a branch still in the network, so that
 * had never been demonstrated.
 */
describe('an order whose branch has closed', () => {
  it('names a branch the network no longer has', async () => {
    const order = await orderNamed('BBQ-4870');

    expect(order.storeName).toBe('bb.q Chicken Braamfontein');
    expect(stores.some((store) => store.id === order.storeId)).toBe(false);
  });

  /**
   * Written out rather than through `storeSnapshot`, which looks the id up and
   * falls back to the first branch in the list — a fallback that would have
   * quietly re-attributed this order to Sandton City.
   */
  it('carries its own snapshot rather than a lookup', () => {
    const seed = code('src/services/orderService.ts');
    const block = seed.slice(
      seed.indexOf("id: 'order-4870'"),
      seed.indexOf("id: 'order-4870'") + 2000,
    );

    expect(block).toMatch(/storeId: 'store-braamfontein'/);
    expect(block).not.toMatch(/storeSnapshot\(/);
  });

  /** No coordinates and no phone: a shopfront that is not there any more. */
  it('offers neither directions nor a call', async () => {
    const order = await orderNamed('BBQ-4870');

    expect(directionsTargetFor(order)).toBeNull();
    expect(isDiallable(order.storePhone)).toBe(false);
  });
});

/**
 * 7 — points taken back, which the ledger had never shown.
 *
 * Three shapes of row exist and only two were seeded: an order earning, and a
 * redemption spending. `cancelOrder` takes the points back with a negative
 * `lifetimeDelta`, and no seeded row described it.
 */
describe('a points row for an order that was called off', () => {
  it('returns exactly what the order earned', async () => {
    seedOrderLedger();
    const [account, cancelled] = await Promise.all([fetchLoyaltyAccount(), orderNamed('BBQ-4788')]);
    const row = account.history.find((entry) => entry.id === 'points-5');

    expect(cancelled.status).toBe('cancelled');
    expect(row?.points).toBe(-cancelled.totals.pointsEarned);
    expect(row?.orderReference).toBe('BBQ-4788');
  });

  /** Derived, because the first draft typed −212 against an order that earned 149. */
  it('is written from the order rather than typed beside it', () => {
    expect(code('src/services/data/rewardsData.ts')).toMatch(
      /points: -order\.totals\.pointsEarned/,
    );
  });

  it('gives the ledger all three shapes of row', async () => {
    seedOrderLedger();
    const account = await fetchLoyaltyAccount();

    expect(account.history.some((entry) => entry.points > 0 && entry.orderReference)).toBe(true);
    expect(account.history.some((entry) => entry.points < 0 && !entry.orderReference)).toBe(true);
    expect(account.history.some((entry) => entry.points < 0 && entry.orderReference)).toBe(true);
  });
});

/**
 * 8 — a notification list long enough to scroll.
 *
 * Seven rows fit on a phone with room to spare, so the screen had only ever
 * been rendered as a short list.
 */
describe('a notification list somebody has to scroll', () => {
  it('is long enough to leave the fold', () => {
    expect(notifications.length).toBeGreaterThanOrEqual(12);
  });

  it('still carries a mix of read and unread', () => {
    expect(notifications.some((entry) => entry.read)).toBe(true);
    expect(notifications.some((entry) => !entry.read)).toBe(true);
  });

  it('points every href at something the app can answer for', async () => {
    const orders = await fetchOrders();
    const orderHrefs = notifications
      .map((entry) => entry.href)
      .filter((href): href is string => Boolean(href) && href!.startsWith('/order/'));

    // One is deliberately dead — the push that outlived its order.
    const resolvable = orderHrefs.filter((href) =>
      orders.some((order) => href === `/order/${order.id}`),
    );

    expect(orderHrefs.length - resolvable.length).toBe(1);
  });
});

/** 9 — a reward reached from a notification rather than the rewards list. */
describe('a notification that opens one reward', () => {
  it('names a reward id the catalogue has', () => {
    const href = notifications.find((entry) => entry.id === 'notif-10')?.href;

    expect(href).toBe('/rewards/reward-fries');
  });
});

/** 10 — the one category with a single product in it. */
describe('a category with one product', () => {
  it('is rice bowls, and it is the only one', async () => {
    const menu = await fetchMenu();
    const counts = new Map<string, number>();
    for (const product of menu.products) {
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }

    const single = [...counts.entries()].filter(([, count]) => count === 1);

    expect(single.map(([id]) => id)).toEqual(['rice-bowls']);
  });
});
