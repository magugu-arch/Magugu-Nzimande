import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Order } from '@/types';
import { fetchOrders } from '@/services/orderService';
import { fetchMenu, fetchProductsByIds } from '@/services/menuService';
import { promotions, vouchers } from '@/services/data/rewardsData';
import { menuSnapshot } from '@/services/data/menuData';
import { currentAddresses } from '@/services/accountService';
import { mockDropoffBriefing } from '@/providers/delivery';
import { isSoldOut, orderableFirst, priceFloor } from '@/features/menu/availability';
import { promoCodeWarning, voucherStandingCopy } from '@/features/rewards/voucherStanding';
import { calculateTotals } from '@/utils/cart';
import { formatPriceDelta } from '@/utils/money';

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
 * 1 — a "goes well with" row that led with what nobody could buy.
 *
 * Found by asking the catalogue rather than by seeding: four of the
 * twenty-eight products recommend Rose Ddeok-Bokki, which is withdrawn, and
 * `fetchProductsByIds` filters for existence and never for stock.
 */
describe('a recommendation row that cannot lead with a sold-out dish', () => {
  it('has products in the catalogue that recommend a withdrawn one', () => {
    const withdrawn = new Set(
      menuSnapshot.products.filter((product) => !product.available).map((product) => product.id),
    );
    const pointingAtOne = menuSnapshot.products.filter((product) =>
      product.recommendedProductIds.some((id) => withdrawn.has(id)),
    );

    expect(withdrawn.size).toBeGreaterThan(0);
    expect(pointingAtOne.length).toBeGreaterThanOrEqual(4);
  });

  /**
   * The defect, seen in Chromium on Secret Sauce Chicken: Cheesling Fries (sold
   * out), Rose Ddeok-Bokki (sold out), Golden Original. Two of three unbuyable
   * and both of them ahead of the one that could be bought — at 168pt a card on
   * a 390pt screen, the only orderable suggestion started off the edge.
   */
  it('was ranked with both sold-out items first, as the service returns them', async () => {
    const raw = await fetchProductsByIds([
      'cheesling-fries',
      'rose-ddeok-bokki',
      'golden-original',
    ]);

    expect(raw.map((product) => product.id)).toEqual([
      'cheesling-fries',
      'rose-ddeok-bokki',
      'golden-original',
    ]);
    expect(raw.filter(isSoldOut)).toHaveLength(2);
  });

  it('sinks them without dropping them, keeping the rank inside each half', async () => {
    const raw = await fetchProductsByIds([
      'cheesling-fries',
      'rose-ddeok-bokki',
      'golden-original',
    ]);
    const ranked = orderableFirst(raw);

    expect(ranked.map((product) => product.id)).toEqual([
      'golden-original',
      'cheesling-fries',
      'rose-ddeok-bokki',
    ]);
    // Sunk, not removed: a customer is better told the dish exists and is off.
    expect(ranked).toHaveLength(raw.length);
  });

  it('is what the product screen draws', () => {
    const screen = code('src/app/product/[id].tsx');

    expect(screen).toMatch(/orderableFirst\(recommended\.data \?\? \[\]\)/);
    expect(screen).toMatch(/\{suggestions\.map\(\(suggestion\) =>/);
  });
});

/**
 * 2 — a courier authorised to report a position that has not reported one.
 *
 * `trackingAvailable: true` with no `courierPosition` is a pair the type has
 * always allowed and the mock had never produced: `seedTrackedDeliveryJob`
 * always arrives with a fix.
 */
describe('a tracked delivery before the first position arrives', () => {
  it('is seeded, authorised, and carries no position', async () => {
    const order = await orderNamed('BBQ-4874');

    expect(order.delivery?.trackingAvailable).toBe(true);
    expect(order.delivery?.courierPosition).toBeUndefined();
    expect(order.delivery?.status).toBe('COURIER_ASSIGNED');
  });

  /**
   * The defect. The map slot is gated on `trackingAvailable && courierPosition`,
   * and everything failing that gate fell through to "Live map tracking is not
   * available for this delivery" — under a header icon that reads
   * `trackingAvailable` alone and was, correctly, the navigation arrow. One
   * card saying tracking was unavailable beside the icon it draws when tracking
   * is available.
   */
  it('says it is waiting rather than that tracking is unavailable', () => {
    const component = code('src/features/orders/components/CourierTracking.tsx');

    expect(component).toMatch(/\) : job\.trackingAvailable \? \(/);
    expect(component).toMatch(/Waiting for your driver/);
    expect(component).toMatch(/testID="courier-awaiting-position"/);
  });

  it('keeps the unauthorised sentence for a job that really has no tracking', async () => {
    const order = await orderNamed('BBQ-4876');

    expect(order.delivery?.trackingAvailable).toBe(false);
    expect(code('src/features/orders/components/CourierTracking.tsx')).toMatch(
      /Live map tracking is not available/,
    );
  });
});

/** 3 — the last unseeded courier status: the network handing the job back. */
describe('a courier job the network cancelled', () => {
  it('is seeded with the provider’s own reason', async () => {
    const order = await orderNamed('BBQ-4876');

    expect(order.delivery?.status).toBe('CANCELLED');
    expect(order.delivery?.reason).toMatch(/No driver was available/);
  });

  /**
   * `attachDelivery` says in as many words that a cancelled courier job must not
   * cancel the customer's order, and nothing had ever put that rule to the test.
   * The food is made and sitting at the branch, so the order stays `ready`.
   */
  it('does not cancel the customer’s order', async () => {
    const order = await orderNamed('BBQ-4876');

    expect(order.status).toBe('ready');
  });

  it('leaves every member of DeliveryStatus with a seeded example', async () => {
    const orders = await fetchOrders();
    const seen = new Set(
      orders.map((order) => order.delivery?.status).filter((status) => status !== undefined),
    );

    for (const status of ['CANCELLED', 'FAILED', 'ON_THE_WAY', 'COURIER_ASSIGNED'] as const) {
      expect(seen.has(status)).toBe(true);
    }
  });
});

/**
 * 4 and 5 — the two ways a saved line survives reconciliation, neither of which
 * had ever happened. See `ledgerAndBasket.test.ts` for the reconciliation
 * itself; this is the seed that makes it reachable.
 */
describe('a saved basket with survivors in it', () => {
  it('carries a line priced before the menu moved', () => {
    const store = code('src/store/cartStore.ts');
    const basket = store.slice(store.indexOf('const STALE_BASKET'));

    expect(basket).toMatch(/productId: 'honey-garlic'/);
    expect(basket).toMatch(/unitBasePrice: 155/);
    // The catalogue's price today, which is what makes it a reprice.
    expect(menuSnapshot.products.find((p) => p.id === 'honey-garlic')?.basePrice).toBe(165);
  });

  it('carries a line saved under a name the menu has since changed', () => {
    const store = code('src/store/cartStore.ts');
    const basket = store.slice(store.indexOf('const STALE_BASKET'));

    expect(basket).toMatch(/name: 'Korean Chicken Rice Bowl'/);
    expect(menuSnapshot.products.find((p) => p.id === 'korean-rice-bowl')?.name).toBe(
      'Korean Rice Bowl',
    );
  });
});

/**
 * 6 — the first option in the catalogue that takes money off.
 *
 * `priceDelta` has been documented as "may be negative" since the type was
 * written and all seventy-nine seeded options were zero or positive, so every
 * part of the app that handles a delta had only handled one direction.
 */
describe('an option that takes money off', () => {
  const kidsMeal = () => {
    const product = menuSnapshot.products.find((p) => p.id === 'little-crunch-chicken-meal');
    if (!product) throw new Error('the kids meal is not seeded');
    return product;
  };

  it('is seeded, in a required group, on the four kids boxes', () => {
    const negatives = menuSnapshot.products.flatMap((product) =>
      product.optionGroups.flatMap((group) =>
        group.options.filter((option) => option.priceDelta < 0).map((option) => option.id),
      ),
    );

    expect(negatives).toHaveLength(4);
    expect(negatives.every((id) => id.endsWith('-drink-none'))).toBe(true);
  });

  it('prints as a discount rather than a plus and a minus', () => {
    expect(formatPriceDelta(-12)).toBe('−R 12.00');
    expect(formatPriceDelta(12)).toBe('+R 12.00');
  });

  /**
   * The defect it exposed, and the one the original guard predicted in writing:
   * "a discount would break the claim the other way, making the card overstate
   * the minimum." Every card printed `basePrice` under the word "from".
   */
  it('drops the floor below the base price, which the card has to follow', () => {
    const product = kidsMeal();

    expect(priceFloor(product)).toBe(product.basePrice - 12);
    expect(code('src/features/menu/components/ProductCard.tsx')).toMatch(
      /formatPrice\(priceFloor\(product\)\)/,
    );
    expect(code('src/features/menu/components/ProductRow.tsx')).toMatch(
      /formatPrice\(priceFloor\(product\)\)/,
    );
  });

  it('leaves every other product’s floor exactly where it was', () => {
    const moved = menuSnapshot.products.filter(
      (product) => priceFloor(product) !== product.basePrice,
    );

    expect(moved.map((product) => product.categoryId)).toEqual(['kids', 'kids', 'kids', 'kids']);
  });
});

/** 7 — a promotion advertising a code this customer has already spent. */
describe('an offer whose code has been used', () => {
  it('is seeded, against a voucher the wallet says is spent', () => {
    const promotion = promotions.find((candidate) => candidate.id === 'promo-soy-fan');
    const voucher = vouchers.find((candidate) => candidate.code === promotion?.promoCode);

    expect(promotion?.promoCode).toBe('SOYFAN');
    expect(voucher?.used).toBe(true);
    // Still running: a campaign outliving one customer's use of its code is the
    // ordinary case, not a mistake in the data.
    expect(new Date(promotion!.validUntil).getTime()).toBeGreaterThan(Date.now());
  });

  /**
   * The defect. The screen printed "Use this code at checkout" over every
   * promotion and handed out a Copy button, because it never asked the wallet
   * anything — the refusal came at the cart, three screens and a basket later.
   */
  it('says so instead of inviting the customer to copy it', () => {
    const spent = vouchers.find((candidate) => candidate.code === 'SOYFAN');
    const live = vouchers.find((candidate) => candidate.code === 'SPICY15');

    expect(promoCodeWarning(spent)).toMatch(/already used this code/);
    expect(promoCodeWarning(live)).toBeNull();
    // A code the wallet has never heard of is not one this app can judge.
    expect(promoCodeWarning(undefined)).toBeNull();
  });

  it('is drawn by the offer screen in place of the standing invitation', () => {
    const screen = code('src/app/offers/[id].tsx');

    expect(screen).toMatch(/promoCodeWarning\(/);
    expect(screen).toMatch(/\{codeWarning \?\? 'Use this code at checkout'\}/);
  });

  /** One caption, two screens, rather than the same three-way test written twice. */
  it('reads the wallet’s own words, from the wallet’s own helper', () => {
    expect(voucherStandingCopy({ used: true, expired: true, expiresAt: '' })).toBe('Already used');
    expect(code('src/app/rewards/vouchers.tsx')).toMatch(/voucherStandingCopy\(voucher\)/);
  });
});

/** 8 — an order whose food was entirely covered, and which was still a payment. */
describe('an order paid for in fees alone', () => {
  it('is seeded, with the reward capped at the food it was spent on', async () => {
    const order = await orderNamed('BBQ-4878');

    expect(order.totals.subtotal).toBe(45);
    expect(order.totals.rewardsDiscount).toBe(45);
    expect(order.totals.total).toBe(order.totals.serviceFee);
  });

  /** The rule, checked against the engine rather than against the seeded row. */
  it('is what calculateTotals produces for a reward worth more than the basket', () => {
    const line = {
      id: 'x',
      productId: 'french-fries',
      name: 'French Fries',
      assetKey: 'frenchFries' as const,
      unitBasePrice: 45,
      quantity: 1,
      selectedOptions: [],
      unitPrice: 45,
      lineTotal: 45,
    };
    const totals = calculateTotals({
      lines: [line],
      fulfilmentType: 'collection',
      rewardsDiscount: 50,
    });

    expect(totals.rewardsDiscount).toBe(45);
    expect(totals.total).toBe(5);
    // Points accrue on food value after discounts, and there is none.
    expect(totals.pointsEarned).toBe(0);
  });

  it('earns nothing, which the receipt therefore has to be able to say', async () => {
    const order = await orderNamed('BBQ-4878');

    expect(order.totals.pointsEarned).toBe(0);
  });

  /**
   * The R5 that survives is the service fee, not the delivery fee — collection,
   * deliberately, so which of the two survives a full discount is unambiguous.
   */
  it('keeps the service fee and has no delivery fee to keep', async () => {
    const order = await orderNamed('BBQ-4878');

    expect(order.fulfilmentType).toBe('collection');
    expect(order.totals.deliveryFee).toBe(0);
    expect(order.totals.serviceFee).toBeGreaterThan(0);
  });
});

/**
 * 9 and 10 — the delivery note that reached nobody.
 *
 * Collected on the address screen, echoed at checkout, and dropped: there was
 * no field for it on `PlaceOrderInput`, so the order never carried it and the
 * courier was created with the street address alone.
 */
describe('what the customer told the driver', () => {
  it('is on a seeded order, taken from the address rather than retyped', async () => {
    const order = await orderNamed('BBQ-4874');
    const address = currentAddresses().find((candidate) => candidate.id === 'address-mum');

    expect(order.deliveryInstructions).toBe(address?.instructions);
    expect(order.deliveryInstructions).toMatch(/Green gate/);
  });

  it('reaches the courier provider, which had only ever been told the street', async () => {
    await orderNamed('BBQ-4874');

    expect(mockDropoffBriefing('mock-job-awaiting-4874')).toBeUndefined();
    // The seeded job is registered directly rather than through `create`, so the
    // briefing is proven on the path a placed order actually takes.
    expect(code('src/services/orderService.ts')).toMatch(
      /dropoffInstructions: order\.deliveryInstructions/,
    );
    expect(code('src/providers/delivery/mockDeliveryProvider.ts')).toMatch(
      /input\.dropoffInstructions \? \{ dropoffInstructions: input\.dropoffInstructions \}/,
    );
  });

  it('is sent from checkout, and only on a delivery', () => {
    const screen = code('src/app/checkout/index.tsx');

    expect(screen).toMatch(/fulfilmentType === 'delivery' && deliveryInstructions\.trim\(\)/);
  });

  it('is shown back on the receipt, which is where somebody goes to check', () => {
    const screen = code('src/app/order/[id]/index.tsx');

    expect(screen).toMatch(/data\.deliveryInstructions \?/);
    expect(screen).toMatch(/What we told your driver/);
  });

  it('is absent on every order placed without one', async () => {
    const orders = await fetchOrders();
    const withNote = orders.filter((order) => order.deliveryInstructions);

    expect(withNote.map((order) => order.reference)).toEqual(['BBQ-4874']);
  });

  /** The menu is untouched by all of this — a guard against a stray edit. */
  it('has not moved the catalogue', async () => {
    const menu = await fetchMenu();

    expect(menu.products).toHaveLength(28);
    expect(menu.categories).toHaveLength(8);
  });
});
