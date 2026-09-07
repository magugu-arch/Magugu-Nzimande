import { MAX_BASKET_LINES, MAX_LINE_QUANTITY, type OrderLine } from '@bbq/types';
import { PRODUCTS } from '@bbq/seed';
import { beforeEach, describe, expect, it } from 'vitest';
import { pointsFor, totalsFor } from '@/lib/pricing';
import {
  aProduct,
  attemptOrder,
  blankState,
  bodyOf,
  dearestLine,
  distinctLines,
  errorOf,
  orderLine,
} from './fixtures';

/**
 * The edges of the money, which had none.
 *
 * Everything here is an integer number of cents, and the arithmetic is careful:
 * one rounding step, at the discount, never recomputed from a formatted string.
 * All of that is exactly right and all of it depends on the numbers staying
 * inside the range where a JavaScript number is an exact integer — below 2^53.
 *
 * `quantity` had no upper bound. An order for a trillion pieces of chicken was
 * accepted with a 201 and a total of 18,900,000,000,000,000 cents, on which
 * `Number.isSafeInteger` returns false; the loyalty ledger stood ready to credit
 * 189 trillion points on completion. Nothing was wrong with the sums. Nothing
 * had been asked to refuse the inputs.
 *
 * So these tests come in two halves. One says the bounds are enforced. The
 * other says *why* they are where they are — that at the very top of what they
 * allow, every total is still exact — so that raising one is a decision
 * somebody makes with the consequence in front of them rather than a limit
 * somebody deletes.
 */

beforeEach(blankState);

describe('how many of one thing', () => {
  it('takes an order at the limit', async () => {
    const response = await attemptOrder([{ ...orderLine(aProduct()), quantity: MAX_LINE_QUANTITY }]);
    expect(response.status).toBe(201);
  });

  it('refuses one past it', async () => {
    const response = await attemptOrder([
      { ...orderLine(aProduct()), quantity: MAX_LINE_QUANTITY + 1 },
    ]);

    expect(response.status).toBe(400);
    expect(await errorOf(response), 'and says what to do instead').toContain('Ring the store');
  });

  /** The number that started this. */
  it('refuses a trillion of them', async () => {
    const response = await attemptOrder([
      { ...orderLine(aProduct()), quantity: 1_000_000_000_000 },
    ]);

    expect(response.status).toBe(400);
  });
});

describe('how many different things', () => {
  it('takes a basket at the limit', async () => {
    expect((await attemptOrder(distinctLines(MAX_BASKET_LINES))).status).toBe(201);
  });

  it('refuses one past it', async () => {
    const response = await attemptOrder(distinctLines(MAX_BASKET_LINES + 1));

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toContain('Ring the store');
  });

  /**
   * Built inline rather than through `distinctLines`, which only hands back
   * lines the repricer accepts and so refuses to invent five thousand of them.
   * It does not need to: the array length is checked by the schema before
   * anything is priced, so these are rejected for being five thousand rather
   * than for being anything else.
   */
  it('refuses five thousand', async () => {
    const many = Array.from({ length: 5_000 }, (_, index) => ({
      ...orderLine(aProduct()),
      key: `line::${index}`,
    }));

    expect((await attemptOrder(many)).status).toBe(400);
  });
});

/**
 * The half that explains the numbers.
 *
 * A bound with no stated reason is a bound somebody raises on a quiet afternoon
 * because a customer asked. These say what the bounds are protecting, in terms
 * that fail if it stops being true.
 */
describe('the totals at the very top of what is allowed', () => {
  const dearestBasket = (): OrderLine[] =>
    Array.from({ length: MAX_BASKET_LINES }, (_, index) => ({
      ...dearestLine(MAX_LINE_QUANTITY),
      key: `dearest::${index}`,
    }));

  it('are exact integers, which is the whole point of the bounds', () => {
    const totals = totalsFor(dearestBasket(), 'Delivery', null);

    for (const [name, value] of Object.entries(totals)) {
      expect(Number.isSafeInteger(value), `${name} is ${value}, outside the exact range`).toBe(
        true,
      );
    }
  });

  /**
   * With a wide margin rather than by a hair.
   *
   * A menu whose prices rise, or an option that adds to a line, must not be the
   * change that quietly takes the sums past exact. A thousandfold gap means no
   * plausible price list gets near it.
   */
  it('leave room for the menu to change under them', () => {
    const { totalCents } = totalsFor(dearestBasket(), 'Delivery', null);

    expect(totalCents).toBeGreaterThan(0);
    expect(totalCents * 1_000).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });

  /**
   * And the points that follow are exact too.
   *
   * This is where the unbounded quantity did its second kind of damage: points
   * are one per whole rand, so a total that had left the exact range produced a
   * balance of 189 trillion — a number the loyalty ledger would then have
   * carried around forever. Asserted as the arithmetic rather than as a
   * ceiling: an earlier draft of this test picked "under a million" out of the
   * air and failed on a correct total of 1,133,550, which is what the bounds
   * genuinely allow.
   */
  it('produce a points balance that is exactly one per whole rand', () => {
    const { totalCents } = totalsFor(dearestBasket(), 'Delivery', null);
    const points = pointsFor(totalCents);

    expect(Number.isSafeInteger(points)).toBe(true);
    expect(points).toBe(Math.floor(totalCents / 100));
  });

  /**
   * The bounds are only meaningful against a real catalogue, so this reads one.
   * If the seed ever ships an empty product list, the tests above would pass by
   * pricing nothing at all.
   */
  it('are computed from a catalogue that has products in it', () => {
    expect(PRODUCTS.length).toBeGreaterThan(0);
    expect(dearestLine(1).unitCents).toBeGreaterThan(0);
  });
});

describe('what the totals always satisfy', () => {
  /**
   * The identity the customer checks by eye on the basket screen. It held
   * before this change and holds after it; stated here because a bound that
   * clamps a quantity is exactly the kind of change that could break it.
   */
  it('add up, at the limit as anywhere else', async () => {
    const response = await attemptOrder([
      { ...orderLine(aProduct()), quantity: MAX_LINE_QUANTITY },
    ]);
    const { order } = await bodyOf<{
      order: { totals: { subtotalCents: number; discountCents: number; deliveryCents: number; totalCents: number } };
    }>(response);
    const { subtotalCents, discountCents, deliveryCents, totalCents } = order.totals;

    expect(subtotalCents - discountCents + deliveryCents).toBe(totalCents);
  });

  it('never charge less than nothing', async () => {
    const response = await attemptOrder([
      { ...orderLine(aProduct()), quantity: MAX_LINE_QUANTITY },
    ]);
    const { order } = await bodyOf<{ order: { totals: Record<string, number> } }>(response);

    for (const [name, value] of Object.entries(order.totals)) {
      expect(value, `${name} is negative`).toBeGreaterThanOrEqual(0);
    }
  });
});
