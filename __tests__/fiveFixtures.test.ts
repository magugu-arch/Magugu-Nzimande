import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Order } from '@/types';
import { fetchMenu } from '@/services/menuService';
import { fetchOrders } from '@/services/orderService';
import { productListLabel, SOLD_OUT_LABEL } from '@/features/menu/availability';
import {
  countdownStillApplies,
  deliveryFailed,
  liveStatusBadge,
  liveStatusCopy,
  timelineFor,
} from '@/features/orders/liveStatus';

const code = (file: string) =>
  readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * FIXTURE 1 — a product the kitchen has run out of.
 *
 * `Product.available` has been on the type since the catalogue was written and
 * all 28 products carried `true`, so the false case had never been drawn. It
 * was read in exactly two places, both behind the customer: `reorder` drops an
 * unavailable item from an "Order again", and `reconcileCart` drops a saved
 * line whose product has gone. The menu list, the card grid, the search
 * results, the "Goes well with" carousel and the product screen never looked.
 *
 * Verified in Chromium before the fix: `/product/rose-ddeok-bokki` rendered
 * every option, priced them, and offered "Add to cart R 82.00".
 */
describe('a product that is sold out', () => {
  /**
   * Asked of the flag itself, not of `isSoldOut`. The helper has since grown a
   * second reason to refuse a product — a required group whose every option has
   * been withdrawn, which is a till marking options out rather than a product —
   * and this case is about the flag.
   */
  it('is seeded, so the false branch has something to run against', async () => {
    const menu = await fetchMenu();
    const withdrawn = menu.products.filter((product) => !product.available);

    expect(withdrawn.map((product) => product.name)).toEqual(['Rose Ddeok-Bokki']);
  });

  it('says so before it says the price', () => {
    const label = productListLabel({
      name: 'Rose Ddeok-Bokki',
      basePrice: 82,
      available: false,
      optionGroups: [],
    });

    expect(label).toBe('Rose Ddeok-Bokki, Sold out, from R 82.00');
    expect(label.indexOf(SOLD_OUT_LABEL)).toBeLessThan(label.indexOf('R 82.00'));
  });

  it("leaves an available product's label alone", () => {
    expect(
      productListLabel({ name: 'French Fries', basePrice: 45, available: true, optionGroups: [] }),
    ).toBe('French Fries, from R 45.00');
  });

  it('keeps the description clause the list rows already carried', () => {
    expect(
      productListLabel(
        { name: 'French Fries', basePrice: 45, available: true, optionGroups: [] },
        'Thick cut.',
      ),
    ).toBe('French Fries, from R 45.00. Thick cut.');
  });

  /** The screens, so this cannot quietly go back to being read nowhere. */
  it.each([
    'src/features/menu/components/ProductRow.tsx',
    'src/features/menu/components/ProductCard.tsx',
  ])('%s asks availability rather than drawing every product the same', (file) => {
    expect(code(file)).toMatch(/isSoldOut\(product\)/);
    expect(code(file)).toMatch(/productListLabel\(product/);
  });

  it('the product screen refuses the basket rather than letting the cart refuse later', () => {
    const screen = code('src/app/product/[id].tsx');

    expect(screen).toMatch(/if \(isSoldOut\(product\.data\)\) return;/);
    expect(screen).toMatch(/disabled=\{soldOut\}/);
    expect(screen).toMatch(/\? SOLD_OUT_LABEL/);
  });
});

/**
 * FIXTURE 2 — a product with no published nutrition.
 *
 * `nutrition` is optional and all 28 carried it, so
 * `item.nutrition ? <NutritionPanel …> : null` had only ever taken the first
 * branch. On the second the panel vanished with nothing in its place.
 */
describe('a product with no nutritional information', () => {
  it('is seeded on the product whose data is already unconfirmed', async () => {
    const menu = await fetchMenu();
    const unmeasured = menu.products.filter((product) => !product.nutrition);

    expect(unmeasured.map((product) => product.name)).toEqual(['Sweet Potato Fries']);
  });

  /**
   * The point of choosing that product: its `allergens` are `[]` and the
   * screen already says so in words. Two datasets missing for one item, and
   * only one of them admitted it.
   */
  it('is the same product whose allergens are unconfirmed', async () => {
    const menu = await fetchMenu();
    const item = menu.products.find((product) => product.id === 'sweet-potato-fries');

    expect(item?.allergens).toEqual([]);
    expect(item?.nutrition).toBeUndefined();
  });

  it('says the figures are missing rather than drawing nothing', () => {
    const screen = code('src/app/product/[id].tsx');

    expect(screen).toMatch(/Nutritional information for this item is not confirmed/);
    expect(screen).not.toMatch(/item\.nutrition \? \([\s\S]{0,200}\) : null/);
  });

  it('is carried to audit:launch rather than being filled in here', () => {
    expect(code('scripts/audit-launch-readiness.mjs')).toMatch(/'Nutrition data'/);
  });
});

/**
 * FIXTURE 3 — a courier that gave up.
 *
 * `FAILED` is a member of `DeliveryStatus`; the mock's progression walked from
 * `ON_THE_WAY` straight to `DELIVERED`, so it had never been reported.
 */
describe('a delivery that failed', () => {
  const failed = async (): Promise<Order> => {
    const orders = await fetchOrders();
    const order = orders.find((candidate) => candidate.reference === 'BBQ-4840');
    if (!order) throw new Error('BBQ-4840 is not seeded');
    return order;
  };

  it('is seeded, and stays failed rather than being walked on by the clock', async () => {
    const order = await failed();

    expect(order.delivery?.status).toBe('FAILED');
    expect(deliveryFailed(order)).toBe(true);
  });

  /**
   * The defect, seen in Chromium: fifty-one minutes after the courier turned
   * back, the hero read "Out for delivery · Your driver has collected the
   * order and is on the way".
   */
  it('is not described as a driver still on the way', async () => {
    const order = await failed();
    const copy = liveStatusCopy(order);

    expect(copy.label).toBe('Delivery unsuccessful');
    expect(copy.description).not.toMatch(/on the way/i);
    expect(copy.description).toMatch(/could not complete/i);
  });

  it('is not badged "In progress"', async () => {
    expect(liveStatusBadge(await failed())).toBe('Needs attention');
  });

  it('has no countdown, because there is nothing left to count down to', async () => {
    expect(countdownStillApplies(await failed())).toBe(false);
  });

  /**
   * The journey it really took stands; the step after it does not. The seeded
   * failure left "Completed · Enjoy. Thanks for ordering with bb.q." sitting
   * undated at the bottom of the list.
   */
  it('stops the timeline at the last step that actually happened', async () => {
    const order = await failed();
    const shown = timelineFor(order);

    expect(shown.length).toBeLessThan(order.timeline.length);
    expect(shown.every((event) => event.occurredAt !== null)).toBe(true);
    expect(shown.map((event) => event.status)).not.toContain('completed');
    expect(shown[shown.length - 1]?.status).toBe('out_for_delivery');
  });

  it("leaves every other order's timeline untouched", async () => {
    const orders = await fetchOrders();

    for (const order of orders.filter((candidate) => !deliveryFailed(candidate))) {
      expect(timelineFor(order)).toBe(order.timeline);
    }
  });

  it('counts as settled on the courier card', () => {
    expect(code('src/features/orders/components/CourierTracking.tsx')).toMatch(
      /job\.status === 'FAILED'/,
    );
  });

  /** The remedy is bb.q's to decide, not this app's to invent. */
  it('sends the policy to audit:launch rather than promising a refund', () => {
    const screen = code('src/features/orders/liveStatus.ts');

    expect(screen).not.toMatch(/refund|redeliver/i);
    expect(code('scripts/audit-launch-readiness.mjs')).toMatch(/'Failed delivery policy'/);
  });
});

/**
 * FIXTURE 4 — nine lines, which is more than the whole seeded history had.
 *
 * Every list in the app was short by construction: three addresses, three
 * cards, seven orders, and no basket over two lines. Nothing had been asked to
 * lay out a receipt at 320pt with a family order on it.
 */
describe('an order with nine lines', () => {
  it('is seeded', async () => {
    const orders = await fetchOrders();
    const big = orders.find((order) => order.reference === 'BBQ-4842');

    expect(big?.lines).toHaveLength(9);
  });

  /**
   * Written from the menu, so a price that moves takes the fixture with it.
   * A basket whose arithmetic drifts from the catalogue tests nothing.
   */
  it('prices every line off the menu it came from', async () => {
    const [orders, menu] = await Promise.all([fetchOrders(), fetchMenu()]);
    const big = orders.find((order) => order.reference === 'BBQ-4842');

    for (const line of big?.lines ?? []) {
      const product = menu.products.find((candidate) => candidate.id === line.productId);
      const deltas = line.selectedOptions.reduce((sum, option) => sum + option.priceDelta, 0);

      expect(product).toBeDefined();
      expect(line.unitBasePrice).toBe(product?.basePrice);
      expect(line.unitPrice).toBe(line.unitBasePrice + deltas);
      expect(line.lineTotal).toBe(line.unitPrice * line.quantity);
    }
  });

  it('totals what its lines add up to', async () => {
    const orders = await fetchOrders();
    const big = orders.find((order) => order.reference === 'BBQ-4842');
    const subtotal = (big?.lines ?? []).reduce((sum, line) => sum + line.lineTotal, 0);

    expect(subtotal).toBe(1_671);
    expect(big?.totals.subtotal).toBe(subtotal);
    expect(big?.totals.total).toBe(subtotal + (big?.totals.serviceFee ?? 0));
  });
});

/**
 * FIXTURE 5 — a collection order sitting on the counter.
 *
 * `ready` had never been a seeded status: the ledger held `received`,
 * `out_for_delivery`, `completed` and `cancelled`, and the three middle rungs
 * were reachable only by placing an order and waiting for the mock to advance
 * it. So the screen whose whole job is to say "come and get it" had never been
 * rendered cold.
 */
describe('a collection order that is ready', () => {
  const ready = async (): Promise<Order> => {
    const orders = await fetchOrders();
    const order = orders.find((candidate) => candidate.reference === 'BBQ-4842');
    if (!order) throw new Error('BBQ-4842 is not seeded');
    return order;
  };

  it('is seeded at a status nothing had reached cold', async () => {
    const order = await ready();

    expect(order.status).toBe('ready');
    expect(order.fulfilmentType).toBe('collection');
  });

  /**
   * The defect, seen in Chromium: "Ready · Boxed, sealed and ready to go" and,
   * one line below it, "Ready for collection in 9 – 19 min". The kitchen had
   * finished early and the screen told somebody to wait for food already
   * waiting for them.
   */
  it('does not quote a countdown for food already on the counter', async () => {
    expect(countdownStillApplies(await ready())).toBe(false);
  });

  it('still quotes one while the kitchen is actually cooking', async () => {
    const order = await ready();

    expect(countdownStillApplies({ ...order, status: 'preparing' })).toBe(true);
    expect(countdownStillApplies({ ...order, status: 'received' })).toBe(true);
  });

  /**
   * A delivery at `ready` is a different case and must keep its countdown: the
   * road is still ahead, and the estimate is measuring it.
   */
  it('keeps the countdown for a delivery at the same status', async () => {
    const order = await ready();

    expect(countdownStillApplies({ ...order, fulfilmentType: 'delivery' })).toBe(true);
  });

  it('names the step the timeline already names, rather than saying "Ready"', async () => {
    const order = await ready();

    expect(liveStatusCopy(order).label).toBe('Ready for collection');
    expect(liveStatusCopy({ ...order, fulfilmentType: 'dinein' }).label).toBe(
      'Ready at your table',
    );
  });
});

/** Both screens that draw an open order ask the same helper. */
describe('the tracking screen and the orders card agree', () => {
  it.each(['src/app/order/[id]/index.tsx', 'src/app/(tabs)/orders.tsx'])(
    '%s reads liveStatusCopy and countdownStillApplies',
    (file) => {
      expect(code(file)).toMatch(/liveStatusCopy\(/);
      expect(code(file)).toMatch(/countdownStillApplies\(/);
    },
  );

  it('neither still writes statusCopy straight onto the screen', () => {
    for (const file of ['src/app/order/[id]/index.tsx', 'src/app/(tabs)/orders.tsx']) {
      expect(code(file)).not.toMatch(/statusCopy\(\w+\.status\)\.(label|description)/);
    }
  });
});
