import { STORES } from '@bbq/seed';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/orders/route';
import { setHidden, setSoldOut } from '@/lib/catalogue-state';
import { repriceLines } from '@/lib/order-integrity';
import type { OrderLine } from '@bbq/types';
import {
  aChickenProduct,
  aDiscountingChoice,
  orderLine,
  orderRequest,
  request,
  sizeGroupOf,
} from './fixtures';

/**
 * What the API will accept about money.
 *
 * These go through the route handler rather than the pricing helpers, because
 * the hole they close was not in the arithmetic — `totalsFor` was always
 * correct. It was that the numbers handed to it came from the request. A test
 * of the domain layer alone would have stayed green throughout.
 */

const chicken = aChickenProduct();
const sizeGroup = sizeGroupOf(chicken);
const halfBird = aDiscountingChoice(sizeGroup);
const store = STORES[0];
if (!store) throw new Error('seed catalogue has no stores');

const line = (over: Partial<OrderLine> = {}): OrderLine => orderLine(chicken, over);

const place = async (lines: OrderLine[], over: Record<string, unknown> = {}) => {
  const response = await POST(
    request('/api/orders', { body: orderRequest(lines, { storeId: store.id, ...over }) }),
  );
  return { status: response.status, body: await response.json() };
};

beforeEach(() => {
  setSoldOut(chicken.slug, false);
  setHidden(chicken.slug, false);
});

describe('what the API will charge', () => {
  it('takes an honest basket at the catalogue price', async () => {
    const { status, body } = await place([line()]);

    expect(status).toBe(201);
    expect(body.order.totals.subtotalCents).toBe(chicken.priceCents);
  });

  /**
   * The one that was open: this exact request used to return 201 with a total
   * of one cent, and loyalty points posted against it.
   */
  it('refuses a line that has set its own price', async () => {
    const { status, body } = await place([line({ unitCents: 1 })]);

    expect(status).toBe(409);
    expect(body.slugs).toEqual([chicken.slug]);
    expect(body.problems[0].problem).toMatch(/priced at/i);
  });

  it('refuses a price that is too high as readily as one that is too low', async () => {
    const { status } = await place([line({ unitCents: chicken.priceCents + 5_000 })]);
    expect(status).toBe(409);
  });

  it('never lets a refused basket reach the order store', async () => {
    const { body } = await place([line({ unitCents: 1 })]);
    expect(body.order).toBeUndefined();
  });

  it('prices every line, not just the first', async () => {
    const { status, body } = await place([line(), line({ key: 'second', unitCents: 1 })]);

    expect(status).toBe(409);
    expect(body.problems).toHaveLength(1);
  });

  it('reports every bad line at once, so a basket is fixed in one pass', () => {
    const result = repriceLines([
      line({ unitCents: 1 }),
      line({ slug: 'not-a-product', key: 'x' }),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((problem) => problem.slug)).toEqual([
      chicken.slug,
      'not-a-product',
    ]);
  });
});

describe('what the API will sell', () => {
  /**
   * An invented slug is on neither the sold-out list nor the hidden list, so
   * the checks that stood here before returned false for both and let it
   * through at whatever price it asked for.
   */
  it('refuses a product that was never on the menu', async () => {
    const { status, body } = await place([
      line({ slug: 'gold-plated-bird', key: 'g', unitCents: 1 }),
    ]);

    expect(status).toBe(409);
    expect(body.problems[0].problem).toMatch(/not on the menu/i);
  });

  it('refuses a sold-out product', async () => {
    setSoldOut(chicken.slug, true);
    const { status, body } = await place([line()]);

    expect(status).toBe(409);
    expect(body.problems[0].problem).toMatch(/sold out/i);
  });

  it('refuses a hidden product, which is not on the menu at all', async () => {
    setHidden(chicken.slug, true);
    const { status, body } = await place([line()]);

    expect(status).toBe(409);
    expect(body.problems[0].problem).toMatch(/not on the menu/i);
  });
});

describe('what the API will accept as an option', () => {
  it('charges a real option at the catalogue delta', async () => {
    const { status, body } = await place([
      line({
        unitCents: chicken.priceCents + halfBird.deltaCents,
        options: [
          { groupKey: 'size', groupLabel: sizeGroup.label, choices: [halfBird.label] },
        ],
      }),
    ]);

    expect(status).toBe(201);
    expect(body.order.totals.subtotalCents).toBe(chicken.priceCents + halfBird.deltaCents);
  });

  /** Half bird is R70 off. Claiming it twice would be R140 off. */
  it('refuses the same discounting choice claimed twice', async () => {
    const { status, body } = await place([
      line({
        unitCents: chicken.priceCents + halfBird.deltaCents * 2,
        options: [
          {
            groupKey: 'size',
            groupLabel: sizeGroup.label,
            choices: [halfBird.label, halfBird.label],
          },
        ],
      }),
    ]);

    expect(status).toBe(409);
    expect(body.problems[0].problem).toMatch(/one choice|twice/i);
  });

  it('refuses an option group the product does not have', async () => {
    const { status, body } = await place([
      line({
        options: [{ groupKey: 'invented', groupLabel: 'Invented', choices: ['Free'] }],
      }),
    ]);

    expect(status).toBe(409);
    expect(body.problems[0].problem).toMatch(/not an option group/i);
  });

  it('refuses a choice label the group does not offer', async () => {
    const { status, body } = await place([
      line({
        options: [{ groupKey: 'size', groupLabel: sizeGroup.label, choices: ['Free bird'] }],
      }),
    ]);

    expect(status).toBe(409);
    expect(body.problems[0].problem).toMatch(/is not a/i);
  });
});

describe('where the API will deliver', () => {
  const deliveryStore = STORES.find((candidate) => candidate.services.Delivery && candidate.zones[0]);
  if (!deliveryStore) throw new Error('no seed store offers delivery with a zone');
  const covered = deliveryStore.zones[0] as string;

  const deliver = (suburb: string) =>
    place([line()], {
      storeId: deliveryStore.id,
      mode: 'Delivery',
      address: '12 Rivonia Road',
      suburb,
    });

  it('takes a delivery order to a suburb the store covers', async () => {
    expect((await deliver(covered)).status).toBe(201);
  });

  it('matches a suburb however it was typed, as the quote does', async () => {
    expect((await deliver(`  ${covered.toUpperCase()}  `)).status).toBe(201);
  });

  /**
   * The quote endpoint has always refused this. Nothing made the order
   * endpoint ask, so the order reached the kitchen queue anyway.
   */
  it('refuses a delivery order to a suburb nobody covers', async () => {
    const { status, body } = await deliver('Cape Town');

    expect(status).toBe(409);
    expect(body.error).toMatch(/does not deliver/i);
  });

  it('refuses a suburb the other store covers but this one does not', async () => {
    const other = STORES.find(
      (candidate) =>
        candidate.id !== deliveryStore.id &&
        candidate.zones.some((zone) => !deliveryStore.zones.includes(zone)),
    );
    if (!other) return;
    const theirs = other.zones.find((zone) => !deliveryStore.zones.includes(zone)) as string;

    expect((await deliver(theirs)).status).toBe(409);
  });

  it('does not ask about suburbs for a collection order', async () => {
    expect((await place([line()], { mode: 'Collection' })).status).toBe(201);
  });
});

describe('the stored order carries the server’s numbers', () => {
  it('replaces a renamed line with the catalogue name', async () => {
    const { status, body } = await place([line({ name: 'Free Chicken (100% off)' })]);

    expect(status).toBe(201);
    expect(body.order.lines[0].name).toBe(chicken.name);
  });

  it('posts points against the price the server computed', async () => {
    const { body } = await place([line()]);
    expect(body.order.pointsEarned).toBe(Math.floor(chicken.priceCents / 100));
  });
});
