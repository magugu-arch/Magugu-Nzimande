import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Order } from '@/types';
import { fetchMenu } from '@/services/menuService';
import { fetchOrders } from '@/services/orderService';
import { hasUnfillableGroup, isSoldOut, soldOutReason } from '@/features/menu/availability';
import { directionsTargetFor } from '@/features/orders/directions';
import { planReorder, describeReorder } from '@/features/orders/reorder';

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
 * FIXTURE 1 — a dine-in order that is actually happening.
 *
 * The seed's one dine-in order was `completed`, so nobody had opened a live one.
 * Two things were waiting behind that.
 */
describe('a dine-in order in flight', () => {
  it('is seeded mid-cook, at a rung nothing had reached cold', async () => {
    const order = await orderNamed('BBQ-4844');

    expect(order.fulfilmentType).toBe('dinein');
    expect(order.status).toBe('preparing');
    expect(order.tableNumber).toBe('14');
  });

  /**
   * The table number is typed at checkout, carried on the order, and was drawn
   * on exactly one screen: the confirmation, seen once immediately after
   * paying. Close it and come back — which is what somebody does while they
   * wait — and it was gone from the tracking screen, the Orders card and the
   * receipt alike.
   */
  it('shows the table on the screen somebody comes back to', () => {
    const screen = code('src/app/order/[id]/index.tsx');

    expect(screen).toMatch(/data\.tableNumber \?/);
    expect(screen).toMatch(/Table \{data\.tableNumber\}/);
  });

  /**
   * The other half, found in the same browser pass: "Get directions · The Zone
   * @ Rosebank" offered to somebody nine minutes into a meal at The Zone @
   * Rosebank. The rule read "collection and dine-in are the orders somebody
   * travels to", which is half right — the table number was typed at the table.
   */
  it('does not offer directions to the branch the customer is sitting in', async () => {
    expect(directionsTargetFor(await orderNamed('BBQ-4844'))).toBeNull();
  });

  it('still offers them for a collection order', async () => {
    const target = directionsTargetFor(await orderNamed('BBQ-4610'));

    expect(target).not.toBeNull();
    expect(target?.label).toMatch(/bb\.q/);
  });

  it('still refuses them for a delivery', async () => {
    expect(directionsTargetFor(await orderNamed('BBQ-4821'))).toBeNull();
  });
});

/**
 * FIXTURE 2 — a required option group with every option withdrawn.
 *
 * A till marks options out, not products. Seventy-eight of the seventy-nine
 * seeded options were available and the one that was not had two available
 * siblings, so a required group had always had something left in it.
 */
describe('a product whose only required group has emptied', () => {
  it('is seeded', async () => {
    const menu = await fetchMenu();
    const fries = menu.products.find((product) => product.id === 'cheesling-fries');

    expect(fries?.available).toBe(true);
    expect(hasUnfillableGroup(fries!)).toBe(true);
  });

  /**
   * The defect, seen in Chromium: "Regular · Sold out", "Large · Sold out",
   * and a live button reading "Choose size" on a screen where no size could be
   * chosen. Every part of the app agreed the product was fine.
   */
  it('counts as sold out even though its own flag says available', async () => {
    const menu = await fetchMenu();
    const fries = menu.products.find((product) => product.id === 'cheesling-fries');

    expect(isSoldOut(fries!)).toBe(true);
  });

  /** Two ways to be unorderable, and they are not the same news. */
  it('names the group rather than claiming the product was withdrawn', async () => {
    const menu = await fetchMenu();
    const fries = menu.products.find((product) => product.id === 'cheesling-fries');
    const withdrawn = menu.products.find((product) => product.id === 'rose-ddeok-bokki');

    expect(soldOutReason(fries!)).toBe(
      'Every choice under "Size" is sold out, so this cannot be added to your basket. Please check back later or ask the store.',
    );
    expect(soldOutReason(withdrawn!)).toMatch(/^This is sold out right now/);
  });

  it('says nothing about a product that can be ordered', async () => {
    const menu = await fetchMenu();
    const fine = menu.products.find((product) => product.id === 'golden-original');

    expect(soldOutReason(fine!)).toBeNull();
    expect(isSoldOut(fine!)).toBe(false);
  });

  /**
   * An add-on group with everything gone is a product with no extras today,
   * which is an ordinary Tuesday and not a reason to refuse the order.
   */
  it('ignores an optional group with nothing left in it', () => {
    const optional = {
      available: true,
      optionGroups: [
        {
          id: 'extras',
          name: 'Add to it',
          kind: 'addon' as const,
          minSelect: 0,
          maxSelect: 2,
          defaultOptionIds: [],
          options: [{ id: 'egg', name: 'Boiled egg', priceDelta: 12, available: false }],
        },
      ],
    };

    expect(hasUnfillableGroup(optional)).toBe(false);
    expect(isSoldOut(optional)).toBe(false);
  });

  it('every other product on the menu is still orderable', async () => {
    const menu = await fetchMenu();
    const blocked = menu.products.filter((product) => isSoldOut(product)).map((p) => p.name);

    expect(blocked.sort()).toEqual(['Cheesling Fries', 'Rose Ddeok-Bokki']);
  });
});

/**
 * FIXTURE 3 — the last rung of the sequence, and the longest note anybody can
 * type.
 */
describe('an order with a driver assigned', () => {
  it('is seeded at the rung nothing had reached cold', async () => {
    const order = await orderNamed('BBQ-4846');

    expect(order.status).toBe('courier_assigned');
  });

  /**
   * Chosen rather than picked. A 42-minute delivery estimate is 22 minutes of
   * kitchen plus the 20-minute road buffer, so `readyAt` is three minutes ago
   * and the mock's courier leg lands past COURIER_ASSIGNED at two and short of
   * PICKED_UP at six. If either clock drifts the fixture becomes an order and a
   * courier job disagreeing on one screen.
   */
  it('has a driver on it, because the courier job agrees', async () => {
    const order = await orderNamed('BBQ-4846');

    expect(order.delivery?.status).toBe('COURIER_ASSIGNED');
    expect(order.driverName).toBeTruthy();
  });
});

describe('a note that uses the whole allowance', () => {
  it('is seeded at exactly what the input accepts', async () => {
    const order = await orderNamed('BBQ-4846');
    const note = order.lines[0]?.specialInstructions ?? '';

    expect(note.length).toBeGreaterThan(190);
    expect(note.length).toBeLessThanOrEqual(200);
  });

  it('matches the cap the product screen sets', () => {
    expect(code('src/app/product/[id].tsx')).toMatch(/maxLength=\{200\}/);
  });

  /**
   * The defect, measured in Chromium at 320pt: the receipt showed 57 pixels of
   * 285 and the cart row 38 of 152 — a fifth and a quarter of what somebody
   * typed, cut mid-word with no ellipsis, because React Native Web compiles
   * `numberOfLines` to `overflow: clip`. Two hundred characters is four or five
   * lines on pages that already scroll.
   */
  it.each([
    'src/app/order/[id]/index.tsx',
    'src/app/checkout/index.tsx',
    'src/features/cart/components/CartLineRow.tsx',
  ])('%s no longer clamps it', (file) => {
    const source = code(file);
    const note = source.slice(
      source.indexOf('specialInstructions ?'),
      source.indexOf('specialInstructions ?') + 400,
    );

    expect(note).not.toMatch(/numberOfLines/);
  });
});

/**
 * FIXTURE 5 — a finished order nobody can place again.
 *
 * Every seeded order reordered cleanly, which is exactly the shape a real
 * history does not have. This one found no defect: the branch was already
 * right, and now it has something to run against.
 */
describe('an order whose only product has been withdrawn', () => {
  it('is seeded', async () => {
    const order = await orderNamed('BBQ-4838');

    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]?.productId).toBe('rose-ddeok-bokki');
  });

  it('has nothing to put back in the basket', async () => {
    const [order, menu] = await Promise.all([orderNamed('BBQ-4838'), fetchMenu()]);
    const plan = planReorder(order.lines, menu.products);

    expect(plan.addable).toHaveLength(0);
  });

  /**
   * Verified in Chromium: tapping "Order this again" neither navigated nor
   * went quiet — it said "Nothing to reorder · Rose Ddeok-Bokki is not on the
   * menu right now."
   */
  it('says which item, rather than a generic refusal', async () => {
    const [order, menu] = await Promise.all([orderNamed('BBQ-4838'), fetchMenu()]);
    const notice = describeReorder(planReorder(order.lines, menu.products));

    expect(notice?.message).toMatch(/Rose Ddeok-Bokki/);
  });

  it('never opens an empty cart instead of explaining', () => {
    const hook = code('src/features/orders/useReorder.ts');
    const guard = hook.slice(hook.indexOf('plan.addable.length === 0'));

    expect(guard.slice(0, 200)).toMatch(/tell\(/);
    expect(guard.slice(0, 200)).not.toMatch(/router\.push/);
  });
});
