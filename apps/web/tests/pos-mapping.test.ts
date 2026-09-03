import { PRODUCTS, modifierKey, optionGroupsFor, posMapCompleteness } from '@bbq/seed';
import type { PosCatalogueMap } from '@bbq/seed';
import { beforeEach, describe, expect, it } from 'vitest';
import { codesToRequest, toPosOrder } from '@/lib/fulfilment/pos/payload';
import { activePos } from '@/lib/fulfilment/registry';
import { pushToPos, unacknowledged } from '@/lib/fulfilment/handoff';
import {
  aProduct,
  aProductIn,
  blankState,
  orderLine,
  placeOrder,
  sizeGroupOf,
} from './fixtures';

/**
 * The catalogue-to-till mapping.
 *
 * GAAP's integration specification is not public — they work through a partner
 * programme and issue it under agreement — so there is no GAAP adapter here and
 * no invented endpoint pretending to be one. What is here is everything a POS
 * integration needs that does not depend on a vendor's wire format, which is
 * most of the work and all of the risk: the codes, the completeness rule, and
 * the translation from an order to the facts a till needs.
 */

/** A map with everything filled in, built from the catalogue. */
function completeMap(): PosCatalogueMap {
  const modifiers: Record<string, string> = {};
  let next = 5_000;
  for (const product of PRODUCTS) {
    for (const group of optionGroupsFor(product)) {
      for (const choice of group.choices) {
        modifiers[modifierKey(group.key, choice.label)] ??= String(next++);
      }
    }
  }

  return {
    vendor: 'test-pos',
    stores: { 'ST-CRE': 'B01', 'ST-WAT': 'B02', 'ST-FOU': 'B03' },
    products: Object.fromEntries(PRODUCTS.map((product, index) => [product.slug, `${1_000 + index}`])),
    modifiers,
    orderTypes: { Delivery: 'DEL', Collection: 'TAK', 'Dine-in': 'EAT' },
  };
}

/**
 * An order carrying a real option, priced the way the server prices it.
 *
 * The unit price has to include the option's delta or the order route refuses
 * the line for a price mismatch — which is order-integrity working, and was
 * how the first version of these two tests failed before any mutation.
 */
async function anOrderWithAnOption() {
  const side = aProductIn('Sides');
  const size = sizeGroupOf(side);
  const large = size.choices.find((choice) => choice.deltaCents > 0);
  if (!large) throw new Error('the sides have no size that costs more');

  return placeOrder({
    lines: [
      orderLine(side, {
        unitCents: side.priceCents + large.deltaCents,
        options: [{ groupKey: size.key, groupLabel: size.label, choices: [large.label] }],
      }),
    ],
  });
}

beforeEach(blankState);

describe('what a till would have to be told', () => {
  /**
   * Generated from the catalogue rather than typed, so it is the list to hand
   * a vendor and it cannot go stale: adding a product changes it.
   */
  it('lists every product and every modifier a customer can choose', () => {
    const { products, modifiers } = codesToRequest();

    expect(products).toHaveLength(PRODUCTS.length);
    expect(modifiers.length).toBeGreaterThan(0);
    // Group and choice together, because the same "Large" is a different code
    // on a side than on a drink.
    expect(modifiers.every((key) => key.includes(':'))).toBe(true);
  });

  it('covers the options of every product, not just the first', () => {
    const { modifiers } = codesToRequest();

    for (const product of PRODUCTS) {
      for (const group of optionGroupsFor(product)) {
        for (const choice of group.choices) {
          expect(modifiers, `${product.slug}/${group.key}/${choice.label}`).toContain(
            modifierKey(group.key, choice.label),
          );
        }
      }
    }
  });
});

describe('whether the map can be trusted', () => {
  /**
   * Three states, and the middle one is the whole reason this exists.
   *
   * Absent means no POS is attached and the console is the kitchen display,
   * which works. Complete means ready. Partial means orders for mapped items
   * reach the till and orders for unmapped ones are rejected there —
   * intermittently, per basket, mid-service — and that pattern takes a long
   * time to spot from the shop floor.
   */
  it('is absent when there is no map, which is where this deployment is', () => {
    expect(posMapCompleteness(null)).toEqual({ state: 'absent' });
    // The committed map is deliberately empty: GAAP's codes are not public and
    // are not something to guess at.
    expect(posMapCompleteness().state).toBe('absent');
  });

  it('is complete when everything has a code', () => {
    expect(posMapCompleteness(completeMap())).toEqual({ state: 'complete' });
  });

  it('is partial, and says what is missing, when a product has none', () => {
    const map = completeMap();
    delete map.products[aProduct().slug];

    const result = posMapCompleteness(map);
    expect(result.state).toBe('partial');
    expect(result.state === 'partial' && result.missing).toContain(`product:${aProduct().slug}`);
  });

  /** A map covering products and ignoring modifiers fails on the first customised order. */
  it('is partial when a modifier has none, not just a product', () => {
    const map = completeMap();
    const key = Object.keys(map.modifiers)[0] as string;
    delete map.modifiers[key];

    const result = posMapCompleteness(map);
    expect(result.state).toBe('partial');
    expect(result.state === 'partial' && result.missing).toContain(`modifier:${key}`);
  });

  it('is partial when a service mode has none', () => {
    const map = completeMap();
    delete map.orderTypes['Dine-in'];

    expect(posMapCompleteness(map).state).toBe('partial');
  });

  /**
   * The check that keeps this honest as the menu grows. A product added
   * without a code fails here rather than at a till on a Saturday.
   */
  it('notices a product the map has never heard of', () => {
    const map = completeMap();
    map.products = { 'not-a-real-product': '9999' };

    const result = posMapCompleteness(map);
    expect(result.state === 'partial' && result.missing.length).toBe(PRODUCTS.length);
  });
});

describe('translating an order', () => {
  it('turns it into codes a till would accept', async () => {
    const order = await placeOrder();
    const result = toPosOrder(order, completeMap());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.order.reference).toBe(order.orderNumber);
    expect(result.order.branchCode).toBeTruthy();
    expect(result.order.orderTypeCode).toBe('TAK');
    expect(result.order.lines).toHaveLength(order.lines.length);
    expect(result.order.totalCents).toBe(order.totals.totalCents);
  });

  it('keeps money in integer cents', async () => {
    const order = await placeOrder();
    const result = toPosOrder(order, completeMap());

    if (!result.ok) throw new Error('expected a mapped order');
    for (const amount of [
      result.order.totalCents,
      result.order.subtotalCents,
      ...result.order.lines.map((line) => line.unitCents),
    ]) {
      expect(Number.isInteger(amount)).toBe(true);
    }
  });

  /**
   * Fails as a whole rather than per line. A basket sent to the till with three
   * of its four items is an order the kitchen makes wrongly for a customer who
   * paid for four — far worse than a rejected order somebody has to look at.
   */
  it('refuses the whole order when one line cannot be mapped', async () => {
    const order = await placeOrder();
    const map = completeMap();
    delete map.products[order.lines[0]?.slug ?? ''];

    const result = toPosOrder(order, map);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.missing).toContain(`product:${order.lines[0]?.slug}`);
  });

  it('refuses when the branch has no code', async () => {
    const order = await placeOrder();
    const map = completeMap();
    map.stores = {};

    const result = toPosOrder(order, map);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.missing.some((entry) => entry.startsWith('store:'))).toBe(true);
  });

  it('names every missing code once rather than repeating it', async () => {
    const order = await placeOrder();
    const map = completeMap();
    map.products = {};
    map.orderTypes = {};

    const result = toPosOrder(order, map);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(new Set(result.missing).size).toBe(result.missing.length);
  });

  /**
   * The modifier lookup, which nothing above reached: the shared fixtures place
   * orders with no options on them, so a mutation that looked codes up by label
   * alone broke none of these tests. It does now.
   *
   * The label alone is not enough on a real till. "Large" is a different code
   * on a side than on a drink, and a lookup that ignores the group finds
   * whichever the map happened to list first — a wrong code the till accepts,
   * which is the worst kind of wrong.
   */
  it('looks a modifier up by its group as well as its label', async () => {
    const order = await anOrderWithAnOption();

    const map = completeMap();
    // Two groups, one shared label, different codes — as a real till has.
    const chosen = order.lines[0]?.options[0];
    map.modifiers[modifierKey(chosen?.groupKey ?? '', chosen?.choices[0] ?? '')] = 'MOD-SIZE-L';
    // A second group sharing the same label, different code — as a till has.
    map.modifiers[modifierKey('drink', chosen?.choices[0] ?? '')] = 'MOD-DRINK-L';

    const result = toPosOrder(order, map);
    expect(result.ok, `missing: ${!result.ok ? result.missing.join(', ') : ''}`).toBe(true);
    if (!result.ok) return;

    expect(result.order.lines[0]?.modifierCodes).toEqual(['MOD-SIZE-L']);
  });

  it('reports a missing modifier by group and label together', async () => {
    const order = await anOrderWithAnOption();

    const chosen = order.lines[0]?.options[0];
    const key = modifierKey(chosen?.groupKey ?? '', chosen?.choices[0] ?? '');

    const map = completeMap();
    delete map.modifiers[key];

    const result = toPosOrder(order, map);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.missing).toContain(`modifier:${key}`);
  });

  it('writes a description a human can read off a docket', async () => {
    const order = await placeOrder();
    const result = toPosOrder(order, completeMap());

    if (!result.ok) throw new Error('expected a mapped order');
    expect(result.order.lines[0]?.description).toContain(order.lines[0]?.name);
  });

  it('carries the customer, so the kitchen can shout a name', async () => {
    const order = await placeOrder();
    const result = toPosOrder(order, completeMap());

    if (!result.ok) throw new Error('expected a mapped order');
    expect(result.order.customerName).toBe(order.customer.name);
    expect(result.order.customerPhone).toBe(order.customer.mobile);
  });
});

describe('with no POS attached, which is this deployment', () => {
  it('has no adapter', () => {
    expect(activePos()).toBeNull();
  });

  /** The order still stands, and the console is still the kitchen display. */
  it('still takes the order and reports no failed handoff', async () => {
    const order = await placeOrder();

    expect(await pushToPos(order, activePos())).toBeNull();
    expect(unacknowledged('pos')).toEqual([]);
    expect(order.orderNumber).toBeTruthy();
  });
});
