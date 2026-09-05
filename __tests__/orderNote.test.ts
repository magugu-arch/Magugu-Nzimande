import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CartLine, SelectedOption } from '@/types';
import { orderLineLabel } from '@/features/orders/lineLabel';
import { fetchOrders } from '@/services/orderService';

const medium: SelectedOption = {
  groupId: 'hot-spicy-size',
  groupName: 'Choose your size',
  optionId: 'hot-spicy-size-medium',
  optionName: 'Medium · 9 pieces',
  priceDelta: 60,
};

/**
 * Built by argument rather than spread over a `Partial`, which is the shape
 * every other cart fixture in this suite uses: under
 * `exactOptionalPropertyTypes` a spread partial widens each optional field to
 * include `undefined`, and `specialInstructions` is exactly the field this
 * file is about.
 */
const line = (
  opts: {
    name?: string;
    quantity?: number;
    lineTotal?: number;
    options?: SelectedOption[];
    note?: string;
  } = {},
): CartLine => {
  const base: CartLine = {
    id: 'hot-spicy__size:medium',
    productId: 'hot-spicy',
    name: opts.name ?? 'Hot Spicy Chicken',
    assetKey: 'hotSpicy',
    unitBasePrice: 169,
    quantity: opts.quantity ?? 1,
    selectedOptions: opts.options ?? [medium],
    unitPrice: 229,
    lineTotal: opts.lineTotal ?? 229,
  };

  return opts.note ? { ...base, specialInstructions: opts.note } : base;
};

/**
 * A note to the kitchen, which no seeded order had ever carried.
 *
 * `specialInstructions` is offered on every product screen (200 characters,
 * `product/[id]`), survives into the cart, is drawn on the cart row and drawn
 * again in the checkout review — and then no order in the seed had one, so
 * nothing downstream of payment had ever been asked to render it. The receipt
 * drew quantity, name, options and price and dropped the note: the app showed
 * a customer their own words at every step up to the moment they paid, and
 * then they were gone from the only record they keep.
 *
 * Found by seeding one on the order that is actually in flight and opening
 * `/order/order-4830` in Chromium, which said nothing about chilli.
 */
describe('the seed carries a note to the kitchen', () => {
  it('puts one on the order that is actually happening', async () => {
    const orders = await fetchOrders();
    const inFlight = orders.find((order) => order.reference === 'BBQ-4830');

    expect(inFlight?.lines.some((l) => l.specialInstructions)).toBe(true);
  });

  /** "Order again" copies the note forward, so a finished order needs one too. */
  it('puts one on a finished order as well', async () => {
    const orders = await fetchOrders();
    const done = orders.find((order) => order.reference === 'BBQ-4821');

    expect(done?.lines[0]?.specialInstructions).toBe('Extra crispy please.');
  });
});

describe('what a screen reader is told about one line', () => {
  it('says the note, which the receipt used to drop', () => {
    const label = orderLineLabel(
      line({ note: 'Easy on the chilli please — one portion is for a child.' }),
    );

    expect(label).toContain('note: Easy on the chilli please');
  });

  it('reads as one sentence, in the order the eye reads it', () => {
    expect(orderLineLabel(line())).toBe('1 Hot Spicy Chicken, Medium · 9 pieces, R 229.00');
  });

  /**
   * Voices disagree about `×` — some say "times", some say nothing at all,
   * which turns `1 × Hot Spicy Chicken` into "one Hot Spicy Chicken" on one
   * phone and "one times Hot Spicy Chicken" on the next.
   */
  it('does not hand a multiplication sign to a voice', () => {
    expect(orderLineLabel(line({ quantity: 2, lineTotal: 458 }))).toBe(
      '2 Hot Spicy Chicken, Medium · 9 pieces, R 458.00',
    );
    expect(orderLineLabel(line())).not.toContain('×');
  });

  it('skips the options clause for a line that has none', () => {
    expect(orderLineLabel(line({ options: [], name: 'Coke', lineTotal: 25 }))).toBe(
      '1 Coke, R 25.00',
    );
  });

  /**
   * `formatPrice`, not a reading invented here. It groups thousands with a
   * space rather than a comma, which is the South African convention and what
   * `ProductCard`, `ProductRow` and `StickyCartBar` already put into their own
   * labels — a different reading of money on this one screen would be the only
   * one in the app.
   */
  it('quotes the price the way every other price in the app is announced', () => {
    expect(orderLineLabel(line({ lineTotal: 1_229 }))).toContain('R 1 229.00');
  });
});

/** Nobody writes one of these out by hand again. */
describe('every screen that draws an order line asks the helper', () => {
  const code = (file: string) =>
    readFileSync(path.join(__dirname, '..', file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it.each(['src/app/order/[id]/index.tsx', 'src/app/checkout/index.tsx'])(
    '%s groups its line and labels it through orderLineLabel',
    (file) => {
      expect(code(file)).toMatch(/accessibilityLabel=\{orderLineLabel\(line\)\}/);
    },
  );

  /**
   * The visual half. The label alone would leave a sighted customer reading a
   * receipt that still says nothing about the note they typed.
   */
  it('the receipt draws the note as well as announcing it', () => {
    expect(code('src/app/order/[id]/index.tsx')).toMatch(/line\.specialInstructions \?/);
  });
});
