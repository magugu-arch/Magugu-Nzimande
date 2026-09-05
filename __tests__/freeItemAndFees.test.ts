import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CartLine, Order, SelectedOption } from '@/types';
import { fetchMenu } from '@/services/menuService';
import { fetchOrders } from '@/services/orderService';
import { vouchers } from '@/services/data/rewardsData';
import { promotions } from '@/services/data/rewardsData';
import { priceBasket, voucherBlocker, voucherDiscount, type VoucherTerms } from '@/utils/cart';
import { voucherStatus } from '@/features/cart/voucherStatus';
import { isSoldOut, promotedProductId } from '@/features/menu/availability';

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

const line = (productId: string, unitPrice: number, quantity = 1): CartLine => ({
  id: `${productId}__x`,
  productId,
  name: productId,
  assetKey: 'frenchFries',
  unitBasePrice: unitPrice,
  quantity,
  selectedOptions: [] as SelectedOption[],
  unitPrice,
  lineTotal: unitPrice * quantity,
});

const freeFries: VoucherTerms = {
  code: 'FRIESONUS',
  discountType: 'freeItem',
  freeProductId: 'french-fries',
  discountValue: 0,
  minimumSpend: 150,
};

/**
 * FIXTURE 1 — the fourth discount mechanic, which nothing had ever used.
 *
 * `discountType` has four members and the wallet has a case for each — the
 * `freeItem` one prints "Free item". Three seeded vouchers were `fixed`, one
 * `freeDelivery`, one `percentage`, and `freeItem` had never existed, so the
 * arithmetic behind that label had never run against anything.
 *
 * What it did was share the `fixed` case: `Math.min(discountValue, subtotal)`,
 * a rand amount with nothing tying it to any item — and `Voucher` had no field
 * that could name one.
 */
describe('a voucher that makes one item free', () => {
  it('is seeded, so the fourth mechanic has something to run against', () => {
    const byType = vouchers.filter((voucher) => voucher.discountType === 'freeItem');

    expect(byType.map((voucher) => voucher.code)).toEqual(['FRIESONUS']);
    expect(byType[0]?.freeProductId).toBe('french-fries');
  });

  it('names a product that is actually on the menu', async () => {
    const menu = await fetchMenu();
    const named = vouchers
      .filter((voucher) => voucher.discountType === 'freeItem')
      .map((voucher) => voucher.freeProductId);

    for (const id of named) {
      expect(menu.products.some((product) => product.id === id)).toBe(true);
    }
  });

  /**
   * The defect: worth a rand amount off a basket that need not contain the
   * item at all. `discountValue` is 0 on this voucher, so under the old rule
   * "Free French Fries" was worth exactly nothing.
   */
  it('is worth the price of the item, not a number typed beside it', () => {
    const lines = [line('golden-original', 209), line('french-fries', 45)];

    expect(voucherDiscount(freeFries, 254, new Date(), lines)).toBe(45);
  });

  /** `unitPrice` includes the options chosen, so a large fries is worth more. */
  it('prices the configuration actually ordered', () => {
    const lines = [line('golden-original', 209), line('french-fries', 67)];

    expect(voucherDiscount(freeFries, 276, new Date(), lines)).toBe(67);
  });

  /** One unit, not the line — two portions do not make two free. */
  it('frees one of them, however many were ordered', () => {
    const lines = [line('golden-original', 209), line('french-fries', 45, 3)];

    expect(voucherDiscount(freeFries, 344, new Date(), lines)).toBe(45);
  });

  /** The cheapest, so a voucher for one item is not spent on the dearest. */
  it('takes the cheapest matching line when there are several', () => {
    const lines = [
      line('golden-original', 209),
      line('french-fries', 67),
      line('french-fries', 45),
    ];

    expect(voucherDiscount(freeFries, 321, new Date(), lines)).toBe(45);
  });

  it('is worth nothing when the basket has no such item', () => {
    expect(voucherDiscount(freeFries, 209, new Date(), [line('golden-original', 209)])).toBe(0);
  });

  /**
   * The safe direction. Four call sites only have a subtotal; without the
   * basket the voucher charges full price rather than taking money off for an
   * item nobody put in.
   */
  it('is worth nothing when nobody passed the basket', () => {
    expect(voucherDiscount(freeFries, 254)).toBe(0);
  });

  it('leaves the other three mechanics exactly as they were', () => {
    const fixed: VoucherTerms = {
      code: 'WELCOME50',
      discountType: 'fixed',
      discountValue: 50,
      minimumSpend: 200,
    };
    const percentage: VoucherTerms = {
      code: 'SPICY15',
      discountType: 'percentage',
      discountValue: 15,
      minimumSpend: 150,
    };
    const delivery: VoucherTerms = {
      code: 'FREEDEL',
      discountType: 'freeDelivery',
      discountValue: 0,
      minimumSpend: 150,
    };

    expect(voucherDiscount(fixed, 254)).toBe(50);
    expect(voucherDiscount(percentage, 200)).toBe(30);
    expect(voucherDiscount(delivery, 200)).toBe(0);
  });
});

/**
 * The sentence under the code, which had two branches for three problems.
 *
 * Without the item `voucherDiscount` returns zero while the old
 * `voucherQualifies` — spend and expiry only — went on saying yes, so the cart
 * would have printed "R 0.00 off applied" under a green tick.
 */
describe('what the cart says about a stuck voucher', () => {
  const totals = (subtotal: number, discount: number) => ({ subtotal, discount });

  it('asks for the item by name when that is what is missing', () => {
    const lines = [line('golden-original', 209)];

    expect(voucherBlocker(freeFries, 209, new Date(), lines)).toBe('missingItem');
    expect(voucherStatus(freeFries, totals(209, 0), lines, 'French Fries')).toBe(
      'Add French Fries to use this code',
    );
  });

  it('still works without a name to give', () => {
    expect(voucherStatus(freeFries, totals(209, 0), [line('golden-original', 209)], null)).toBe(
      'Add the free item to use this code',
    );
  });

  it('asks for the spend when that is what is missing', () => {
    const lines = [line('french-fries', 45)];

    expect(voucherBlocker(freeFries, 45, new Date(), lines)).toBe('minimum');
    expect(voucherStatus(freeFries, totals(45, 0), lines, 'French Fries')).toBe(
      'Spend R 150.00 to use this code',
    );
  });

  it('says what it took off once nothing is missing', () => {
    const lines = [line('golden-original', 209), line('french-fries', 45)];

    expect(voucherBlocker(freeFries, 254, new Date(), lines)).toBeNull();
    expect(voucherStatus(freeFries, totals(254, 45), lines, 'French Fries')).toBe(
      'R 45.00 off applied',
    );
  });

  it('names an expiry before anything else, because that cannot be fixed', () => {
    const dead: VoucherTerms = {
      ...freeFries,
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    };

    expect(voucherBlocker(dead, 45, new Date(), [])).toBe('expired');
    expect(voucherStatus(dead, totals(45, 0), [], 'French Fries')).toMatch(/^That code expired on/);
  });

  it('the cart screen asks the helper rather than branching in place', () => {
    const screen = code('src/app/cart/index.tsx');

    expect(screen).toMatch(/voucherStatus\(voucher, totals, lines, freeItemName, now\)/);
    expect(screen).not.toMatch(/off applied/);
  });
});

/**
 * FIXTURE 2 — a delivery whose fee a voucher paid.
 *
 * Five seeded orders carried a voucher and every one was a rand discount off
 * the food. `OrderTotals` prints `deliveryFee === 0 ? 'Free'`, which is true
 * and says nothing about why — an order over the R350 threshold reads
 * identically.
 */
describe('a free delivery, and why it was free', () => {
  it('is seeded under the threshold, so the voucher is what did it', async () => {
    const order = await orderNamed('BBQ-4560');

    expect(order.voucherCode).toBe('FREEDEL');
    expect(order.totals.deliveryFee).toBe(0);
    expect(order.totals.subtotal).toBeLessThan(350);
    expect(order.totals.deliveryFreedByVoucher).toBe(true);
  });

  it('records the reason where it is known rather than inferring it later', () => {
    const lines = [line('golden-original', 209)];
    const delivery: VoucherTerms = {
      code: 'FREEDEL',
      discountType: 'freeDelivery',
      discountValue: 0,
      minimumSpend: 150,
    };

    const withVoucher = priceBasket({ lines, fulfilmentType: 'delivery', voucher: delivery });
    const without = priceBasket({ lines, fulfilmentType: 'delivery' });

    expect(withVoucher.totals.deliveryFee).toBe(0);
    expect(withVoucher.totals.deliveryFreedByVoucher).toBe(true);
    expect(without.totals.deliveryFreedByVoucher).toBeUndefined();
  });

  /** A basket over the threshold is free on its own account, code or no code. */
  it('does not claim the code did it when the threshold did', () => {
    const lines = [line('golden-original', 400)];
    const fixed: VoucherTerms = {
      code: 'WELCOME50',
      discountType: 'fixed',
      discountValue: 50,
      minimumSpend: 200,
    };

    const priced = priceBasket({ lines, fulfilmentType: 'delivery', voucher: fixed });

    expect(priced.totals.deliveryFee).toBe(0);
    expect(priced.totals.deliveryFreedByVoucher).toBeUndefined();
  });

  it('the receipt prints the code beside the word', () => {
    expect(code('src/features/cart/components/OrderTotals.tsx')).toMatch(
      /deliveryFreedByVoucher && voucherCode/,
    );
  });
});

/**
 * FIXTURE 3 — an order booked for tomorrow.
 *
 * `scheduledFor` was on one order and that order was `completed`, so the
 * tracking hero's "Scheduled for …" branch had never been drawn on a live one.
 * No defect: it renders correctly and the clock leaves it alone.
 */
describe('an order scheduled for tomorrow', () => {
  it('is seeded, live, and due in the future', async () => {
    const order = await orderNamed('BBQ-4850');

    expect(order.status).toBe('received');
    expect(order.scheduledFor).toBeTruthy();
    expect(new Date(order.scheduledFor!).getTime()).toBeGreaterThan(Date.now());
  });

  it('is not walked forward by the clock while its slot is still hours away', async () => {
    const first = await orderNamed('BBQ-4850');
    const second = await orderNamed('BBQ-4850');

    expect(second.status).toBe(first.status);
    expect(second.status).toBe('received');
  });
});

/**
 * FIXTURE 4 — a promotion whose dish cannot be ordered.
 *
 * A campaign runs for a fortnight; stock does not.
 */
describe('a promotion pointing at an unorderable dish', () => {
  it('reads the product id off a plain product route only', () => {
    expect(promotedProductId('/product/cheesling-fries')).toBe('cheesling-fries');
    expect(promotedProductId('/(tabs)/menu')).toBeNull();
    expect(promotedProductId('/offers')).toBeNull();
    expect(promotedProductId('/product/a/b')).toBeNull();
  });

  /**
   * Not seeded — it happened. Cheesling Fries lost the last option in its
   * required Size group, and the campaign for it was still running.
   */
  it('exists in the seed as a live inconsistency', async () => {
    const menu = await fetchMenu();
    const stuck = promotions.filter((promotion) => {
      const id = promotedProductId(promotion.ctaHref);
      const product = id ? menu.products.find((candidate) => candidate.id === id) : null;
      return product ? isSoldOut(product) : false;
    });

    expect(stuck.map((promotion) => promotion.id)).toContain('promo-cheesling-fries');
  });

  it('the offer screen refuses the button rather than opening a dead end', () => {
    const screen = code('src/app/offers/[id].tsx');

    expect(screen).toMatch(/promotedItem && isSoldOut\(promotedItem\)/);
    expect(screen).toMatch(/disabled=\{Boolean\(promotedItem && isSoldOut\(promotedItem\)\)\}/);
  });

  /** The campaign itself stands: taking one down is not this app's call. */
  it('leaves the promotion in the list', async () => {
    const menu = await fetchMenu();
    const id = promotedProductId('/product/cheesling-fries');
    const product = menu.products.find((candidate) => candidate.id === id);

    expect(product).toBeDefined();
    expect(promotions.some((promotion) => promotion.id === 'promo-cheesling-fries')).toBe(true);
  });
});

/**
 * FIXTURE 5 — an order that earned nothing.
 *
 * Points accrue on food value after discounts, so a reward big enough to cover
 * the food leaves nothing to earn on. Every seeded order earned something —
 * 184 was the lowest — so `pointsEarned: 0` had never been handed to
 * `OrderTotals`, whose points line is guarded by `pointsEarned > 0`.
 */
describe('an order that earned no points', () => {
  it('is seeded with the food fully covered', async () => {
    const order = await orderNamed('BBQ-4520');

    expect(order.totals.pointsEarned).toBe(0);
    expect(order.totals.rewardsDiscount).toBe(order.totals.subtotal);
    expect(order.totals.total).toBe(order.totals.serviceFee);
  });

  it('names the reward that took the money', async () => {
    const order = await orderNamed('BBQ-4520');

    expect(order.rewardName).toBe('Free Half & Half Chicken');
    expect(order.redeemedRewardId).toBe('reward-half-and-half');
  });

  /** The guard was right and had never run. Verified in Chromium: no line. */
  it('says nothing rather than promising nought points', () => {
    expect(code('src/features/cart/components/OrderTotals.tsx')).toMatch(
      /totals\.pointsEarned > 0 \?/,
    );
  });
});
