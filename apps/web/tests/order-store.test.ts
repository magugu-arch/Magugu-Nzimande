import { beforeEach, describe, expect, it } from 'vitest';
import { advanceOrder, labelFor, listOrders, readOrder } from '@/lib/order-store';
import { placeOrder, resetState } from './fixtures';
import { mutateState } from '@/lib/demo-state';

/**
 * The order store: numbering, the queue, and the labels a customer reads.
 *
 * The order number is the string somebody reads down a telephone to a store,
 * so two orders sharing one is not a cosmetic problem. It is generated from a
 * counter rather than a clock for exactly that reason, and nothing was holding
 * the counter to it.
 */

beforeEach(() => {
  resetState();
  mutateState((state) => {
    state.orders = [];
    state.sequence = 0;
  });
});

describe('order numbers', () => {
  it('reads as a date and a counter', async () => {
    const order = await placeOrder();
    expect(order.orderNumber).toMatch(/^BBQ-\d{6}-\d{4}$/);
  });

  /** Two orders in the same millisecond must not collide. */
  it('never repeats, even for orders placed together', async () => {
    const orders = await Promise.all([placeOrder(), placeOrder(), placeOrder(), placeOrder()]);
    const numbers = orders.map((order) => order.orderNumber);

    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('gives every order its own id as well as its own number', async () => {
    const orders = await Promise.all([placeOrder(), placeOrder(), placeOrder()]);
    expect(new Set(orders.map((order) => order.id)).size).toBe(3);
  });

  it('counts up rather than about', async () => {
    const first = await placeOrder();
    const second = await placeOrder();

    const tail = (number: string) => Number(number.slice(-4));
    expect(tail(second.orderNumber)).toBeGreaterThan(tail(first.orderNumber));
  });
});

describe('the queue', () => {
  it('puts the newest order at the top, where the kitchen looks', async () => {
    await placeOrder();
    const latest = await placeOrder();

    expect(listOrders()[0]?.id).toBe(latest.id);
  });

  it('reads back an order it has', async () => {
    const placed = await placeOrder();
    expect(readOrder(placed.id)?.orderNumber).toBe(placed.orderNumber);
  });

  it('has nothing for an id it never issued', () => {
    expect(readOrder('O-nonexistent')).toBeNull();
  });

  /**
   * The queue is a working rail, not an archive. Without the bound a
   * long-lived process grows a JSON file until it cannot be written.
   *
   * The trim happens when an order is placed, so this fills the rail past the
   * limit and then places a real one, rather than asserting against a number
   * that was never trimmed.
   */
  it('stays bounded when a new order arrives on a full rail', async () => {
    const seed = await placeOrder();
    const real = readOrder(seed.id);
    if (!real) throw new Error('expected the placed order back');

    mutateState((state) => {
      state.orders = Array.from({ length: 140 }, (_, index) => ({
        ...real,
        id: `O-filler-${index}`,
        orderNumber: `BBQ-260902-${String(index).padStart(4, '0')}`,
      }));
    });
    expect(listOrders()).toHaveLength(140);

    await placeOrder();

    expect(listOrders().length).toBeLessThanOrEqual(100);
  });

  it('keeps the newest orders when it trims, not the oldest', async () => {
    const seed = await placeOrder();
    const real = readOrder(seed.id);
    if (!real) throw new Error('expected the placed order back');

    mutateState((state) => {
      state.orders = Array.from({ length: 120 }, (_, index) => ({
        ...real,
        id: `O-filler-${index}`,
      }));
    });

    const latest = await placeOrder();
    // Losing the order somebody just placed would be the one unacceptable trim.
    expect(readOrder(latest.id)).not.toBeNull();
  });
});

describe('advancing an order', () => {
  it('moves it one step at a time', async () => {
    const placed = await placeOrder({ mode: 'Collection' });

    expect(advanceOrder(placed.id)?.status).toBe('preparing');
    expect(advanceOrder(placed.id)?.status).toBe('ready');
  });

  it('stops at the end rather than falling off it', async () => {
    const placed = await placeOrder({ mode: 'Collection' });
    for (let step = 0; step < 10; step += 1) advanceOrder(placed.id);

    expect(readOrder(placed.id)?.status).toBe('completed');
  });

  it('has nothing to advance for an order that does not exist', () => {
    expect(advanceOrder('O-nonexistent')).toBeNull();
  });

  it('persists the move rather than only returning it', async () => {
    const placed = await placeOrder({ mode: 'Collection' });
    advanceOrder(placed.id);

    expect(readOrder(placed.id)?.status).toBe('preparing');
  });
});

describe('the label a customer reads', () => {
  it('says how the order is being fulfilled at the end', () => {
    expect(labelFor({ status: 'completed', mode: 'Delivery' })).toBe('Delivered');
    expect(labelFor({ status: 'completed', mode: 'Collection' })).toBe('Collected');
    expect(labelFor({ status: 'completed', mode: 'Dine-in' })).toBe('Served');
  });

  it('says cancelled whatever the mode', () => {
    for (const mode of ['Delivery', 'Collection', 'Dine-in'] as const) {
      expect(labelFor({ status: 'cancelled', mode })).toBe('Cancelled');
    }
  });

  it('has a label for every state an order passes through', async () => {
    const placed = await placeOrder({ mode: 'Collection' });

    for (let step = 0; step < 6; step += 1) {
      const current = readOrder(placed.id);
      if (!current) throw new Error('the order vanished mid-journey');
      expect(labelFor(current), current.status).toBeTruthy();
      advanceOrder(placed.id);
    }
  });

  it('earns a point per whole rand of what was actually paid', async () => {
    const placed = await placeOrder();
    const order = readOrder(placed.id);

    expect(order?.pointsEarned).toBe(Math.floor((order?.totals.totalCents ?? 0) / 100));
  });
});
