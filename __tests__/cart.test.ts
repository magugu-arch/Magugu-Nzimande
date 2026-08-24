import { businessRules } from '@/constants/config';
import type { CartLine, OptionGroup, Product } from '@/types';
import {
  buildCartLine,
  buildLineId,
  calculateTotals,
  cartItemCount,
  clampQuantity,
  defaultSelectionFor,
  describeOptions,
  meetsDeliveryMinimum,
  reconcileCart,
  voucherDiscount,
  voucherExpired,
  voucherFreesDelivery,
  voucherQualifies,
  type VoucherTerms,
  resolveSelectedOptions,
  unmetOptionGroups,
  unitPriceFor,
} from '@/utils/cart';
import { describeReconciliation } from '@/features/cart/useCartReconciliation';

const sizeGroup: OptionGroup = {
  id: 'size',
  name: 'Choose your size',
  kind: 'size',
  minSelect: 1,
  maxSelect: 1,
  defaultOptionIds: ['size-medium'],
  options: [
    { id: 'size-small', name: 'Small', priceDelta: 0, available: true },
    { id: 'size-medium', name: 'Medium', priceDelta: 60, available: true },
    { id: 'size-large', name: 'Large', priceDelta: 115, available: false },
  ],
};

const addonGroup: OptionGroup = {
  id: 'addons',
  name: 'Extra dipping sauce',
  kind: 'addon',
  minSelect: 0,
  maxSelect: 2,
  defaultOptionIds: [],
  options: [
    { id: 'dip-honey', name: 'Honey Garlic dip', priceDelta: 18, available: true },
    { id: 'dip-soy', name: 'Soy Garlic dip', priceDelta: 18, available: true },
    { id: 'dip-hot', name: 'Hot Spicy dip', priceDelta: 20, available: true },
  ],
};

const product: Product = {
  id: 'golden-original',
  slug: 'golden-original-chicken',
  name: 'Golden Original Chicken',
  shortDescription: 'Crispy',
  description: 'Crispy chicken',
  basePrice: 149,
  categoryId: 'chicken',
  assetKey: 'goldenOriginal',
  spiceLevel: 0,
  tags: ['bestseller'],
  optionGroups: [sizeGroup, addonGroup],
  recommendedProductIds: [],
  available: true,
  preparationMinutes: 18,
  serves: 'Serves 2 – 3',
  allergens: ['Gluten'],
};

describe('buildLineId', () => {
  it('produces the same id regardless of option ordering', () => {
    const a = buildLineId('golden-original', [
      {
        groupId: 'size',
        groupName: 'Size',
        optionId: 'size-medium',
        optionName: 'Medium',
        priceDelta: 60,
      },
      {
        groupId: 'addons',
        groupName: 'Dips',
        optionId: 'dip-soy',
        optionName: 'Soy',
        priceDelta: 18,
      },
    ]);
    const b = buildLineId('golden-original', [
      {
        groupId: 'addons',
        groupName: 'Dips',
        optionId: 'dip-soy',
        optionName: 'Soy',
        priceDelta: 18,
      },
      {
        groupId: 'size',
        groupName: 'Size',
        optionId: 'size-medium',
        optionName: 'Medium',
        priceDelta: 60,
      },
    ]);
    expect(a).toBe(b);
  });

  it('distinguishes different configurations of the same product', () => {
    const medium = buildLineId('golden-original', [
      {
        groupId: 'size',
        groupName: 'Size',
        optionId: 'size-medium',
        optionName: 'Medium',
        priceDelta: 60,
      },
    ]);
    const small = buildLineId('golden-original', [
      {
        groupId: 'size',
        groupName: 'Size',
        optionId: 'size-small',
        optionName: 'Small',
        priceDelta: 0,
      },
    ]);
    expect(medium).not.toBe(small);
  });

  it('falls back to the bare product id when nothing is selected', () => {
    expect(buildLineId('french-fries', [])).toBe('french-fries');
  });
});

describe('defaultSelectionFor', () => {
  it('honours declared defaults', () => {
    expect(defaultSelectionFor(product).size).toEqual(['size-medium']);
  });

  it('leaves optional groups empty', () => {
    expect(defaultSelectionFor(product).addons).toEqual([]);
  });

  it('picks the first available option when a required group has no valid default', () => {
    const noDefault: Product = {
      ...product,
      optionGroups: [{ ...sizeGroup, defaultOptionIds: ['size-nonexistent'] }],
    };
    expect(defaultSelectionFor(noDefault).size).toEqual(['size-small']);
  });
});

describe('unitPriceFor', () => {
  it('adds option deltas to the base price', () => {
    const selected = resolveSelectedOptions([sizeGroup, addonGroup], {
      size: ['size-medium'],
      addons: ['dip-honey'],
    });
    expect(unitPriceFor(product.basePrice, selected)).toBe(227);
  });

  it('returns the base price when nothing is selected', () => {
    expect(unitPriceFor(product.basePrice, [])).toBe(149);
  });
});

describe('resolveSelectedOptions', () => {
  it('ignores option ids that are not in the group', () => {
    const selected = resolveSelectedOptions([sizeGroup], { size: ['size-medium', 'ghost'] });
    expect(selected).toHaveLength(1);
    expect(selected[0]?.optionId).toBe('size-medium');
  });
});

describe('clampQuantity', () => {
  it('keeps quantity within bounds', () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-4)).toBe(1);
    expect(clampQuantity(5)).toBe(5);
    expect(clampQuantity(999)).toBe(businessRules.maxQuantityPerLine);
  });

  it('rounds fractional input and defaults on NaN', () => {
    expect(clampQuantity(2.6)).toBe(3);
    expect(clampQuantity(Number.NaN)).toBe(1);
  });
});

describe('buildCartLine', () => {
  it('computes unit price and line total', () => {
    const selected = resolveSelectedOptions([sizeGroup], { size: ['size-medium'] });
    const line = buildCartLine(product, selected, 2);

    expect(line.unitPrice).toBe(209);
    expect(line.lineTotal).toBe(418);
    expect(line.quantity).toBe(2);
    expect(line.assetKey).toBe('goldenOriginal');
  });

  it('omits blank special instructions rather than storing empty strings', () => {
    const line = buildCartLine(product, [], 1, '   ');
    expect(line.specialInstructions).toBeUndefined();
  });

  it('trims special instructions it does keep', () => {
    const line = buildCartLine(product, [], 1, '  extra crispy  ');
    expect(line.specialInstructions).toBe('extra crispy');
  });
});

describe('unmetOptionGroups', () => {
  it('flags a required group with nothing chosen', () => {
    const unmet = unmetOptionGroups([sizeGroup, addonGroup], { size: [], addons: [] });
    expect(unmet.map((group) => group.id)).toEqual(['size']);
  });

  it('returns nothing when every minimum is met', () => {
    const unmet = unmetOptionGroups([sizeGroup, addonGroup], {
      size: ['size-medium'],
      addons: [],
    });
    expect(unmet).toHaveLength(0);
  });
});

describe('calculateTotals', () => {
  const line = (total: number, quantity = 1): CartLine => ({
    id: `line-${total}`,
    productId: 'p',
    name: 'Item',
    assetKey: 'goldenOriginal',
    unitBasePrice: total,
    quantity,
    selectedOptions: [],
    unitPrice: total,
    lineTotal: total * quantity,
  });

  it('charges delivery below the free threshold', () => {
    const totals = calculateTotals({ lines: [line(200)], fulfilmentType: 'delivery' });
    expect(totals.deliveryFee).toBe(businessRules.deliveryFee);
    expect(totals.total).toBe(200 + businessRules.deliveryFee + businessRules.serviceFee);
  });

  it('waives delivery at or above the free threshold', () => {
    const totals = calculateTotals({
      lines: [line(businessRules.freeDeliveryThreshold)],
      fulfilmentType: 'delivery',
    });
    expect(totals.deliveryFee).toBe(0);
  });

  it('never charges delivery on collection or dine-in', () => {
    expect(calculateTotals({ lines: [line(120)], fulfilmentType: 'collection' }).deliveryFee).toBe(
      0,
    );
    expect(calculateTotals({ lines: [line(120)], fulfilmentType: 'dinein' }).deliveryFee).toBe(0);
  });

  it('applies a delivery fee override', () => {
    const totals = calculateTotals({
      lines: [line(120)],
      fulfilmentType: 'delivery',
      deliveryFeeOverride: 0,
    });
    expect(totals.deliveryFee).toBe(0);
  });

  it('caps a voucher discount at the subtotal', () => {
    const totals = calculateTotals({
      lines: [line(80)],
      fulfilmentType: 'collection',
      voucherDiscount: 500,
    });
    expect(totals.discount).toBe(80);
    expect(totals.total).toBe(businessRules.serviceFee);
  });

  it('caps a rewards discount at what is left after the voucher', () => {
    const totals = calculateTotals({
      lines: [line(100)],
      fulfilmentType: 'collection',
      voucherDiscount: 60,
      rewardsDiscount: 100,
    });
    expect(totals.discount).toBe(60);
    expect(totals.rewardsDiscount).toBe(40);
  });

  it('never returns a negative total', () => {
    const totals = calculateTotals({
      lines: [line(50)],
      fulfilmentType: 'collection',
      voucherDiscount: 999,
      rewardsDiscount: 999,
    });
    expect(totals.total).toBeGreaterThanOrEqual(0);
  });

  it('earns points on discounted food value, not on fees', () => {
    const totals = calculateTotals({
      lines: [line(200)],
      fulfilmentType: 'delivery',
      voucherDiscount: 50,
    });
    expect(totals.pointsEarned).toBe(150);
  });

  it('charges no service fee on an empty basket', () => {
    const totals = calculateTotals({ lines: [], fulfilmentType: 'delivery' });
    expect(totals.serviceFee).toBe(0);
    expect(totals.total).toBe(0);
  });
});

describe('cartItemCount', () => {
  it('counts units, not lines', () => {
    const lines: CartLine[] = [
      { ...buildCartLine(product, [], 2) },
      {
        ...buildCartLine(product, resolveSelectedOptions([sizeGroup], { size: ['size-small'] }), 3),
      },
    ];
    expect(cartItemCount(lines)).toBe(5);
  });
});

describe('describeOptions', () => {
  it('joins option names with a separator', () => {
    const selected = resolveSelectedOptions([sizeGroup, addonGroup], {
      size: ['size-medium'],
      addons: ['dip-honey'],
    });
    const line = buildCartLine(product, selected, 1);
    expect(describeOptions(line)).toBe('Medium · Honey Garlic dip');
  });
});

describe('meetsDeliveryMinimum', () => {
  it('gates delivery below the minimum', () => {
    expect(meetsDeliveryMinimum(businessRules.minimumDeliverySubtotal - 1, 'delivery')).toBe(false);
    expect(meetsDeliveryMinimum(businessRules.minimumDeliverySubtotal, 'delivery')).toBe(true);
  });

  it('does not gate collection or dine-in', () => {
    expect(meetsDeliveryMinimum(10, 'collection')).toBe(true);
    expect(meetsDeliveryMinimum(10, 'dinein')).toBe(true);
  });
});

describe('reconcileCart', () => {
  const saved = buildCartLine(
    product,
    resolveSelectedOptions([sizeGroup], { size: ['size-medium'] }),
    2,
  );

  it('leaves an up-to-date basket alone', () => {
    const result = reconcileCart([saved], [product]);

    expect(result.changed).toBe(false);
    expect(result.lines).toEqual([saved]);
    expect(result.dropped).toEqual([]);
    expect(result.repriced).toEqual([]);
  });

  /**
   * The whole point. The cart persists to disk with every price baked in, so a
   * basket left overnight would otherwise check out at yesterday's prices.
   */
  it('reprices a line when the base price has moved', () => {
    const dearer: Product = { ...product, basePrice: 169 };
    const result = reconcileCart([saved], [dearer]);

    expect(result.changed).toBe(true);
    expect(result.lines[0]?.unitPrice).toBe(229); // 169 + 60
    expect(result.lines[0]?.lineTotal).toBe(458); // × 2
    expect(result.repriced[0]?.previousUnitPrice).toBe(saved.unitPrice);
  });

  it('reprices when an option delta has moved, not just the base', () => {
    const dearerOption: Product = {
      ...product,
      optionGroups: [
        {
          ...sizeGroup,
          options: sizeGroup.options.map((option) =>
            option.id === 'size-medium' ? { ...option, priceDelta: 75 } : option,
          ),
        },
        addonGroup,
      ],
    };

    const result = reconcileCart([saved], [dearerOption]);
    expect(result.lines[0]?.unitPrice).toBe(224); // 149 + 75
    expect(result.repriced).toHaveLength(1);
  });

  it('drops a product that has left the menu', () => {
    const result = reconcileCart([saved], []);

    expect(result.lines).toEqual([]);
    expect(result.dropped[0]?.reason).toBe('off-menu');
  });

  it('drops a product still listed but sold out', () => {
    const result = reconcileCart([saved], [{ ...product, available: false }]);
    expect(result.dropped[0]?.reason).toBe('unavailable');
  });

  /**
   * Dropping just the option and keeping the line would cook something the
   * customer did not order — a large that is quietly now a small.
   */
  it('drops the whole line when a chosen option is withdrawn', () => {
    const withoutMedium: Product = {
      ...product,
      optionGroups: [
        { ...sizeGroup, options: sizeGroup.options.filter((o) => o.id !== 'size-medium') },
        addonGroup,
      ],
    };

    const result = reconcileCart([saved], [withoutMedium]);
    expect(result.dropped[0]?.reason).toBe('option-gone');
    expect(result.lines).toEqual([]);
  });

  it('drops the line when a chosen option is marked unavailable', () => {
    const soldOutMedium: Product = {
      ...product,
      optionGroups: [
        {
          ...sizeGroup,
          options: sizeGroup.options.map((option) =>
            option.id === 'size-medium' ? { ...option, available: false } : option,
          ),
        },
        addonGroup,
      ],
    };

    expect(reconcileCart([saved], [soldOutMedium]).dropped[0]?.reason).toBe('option-gone');
  });

  it('carries a rename through without calling it a price change', () => {
    const renamed: Product = { ...product, name: 'Golden Original' };
    const result = reconcileCart([saved], [renamed]);

    expect(result.changed).toBe(true);
    expect(result.lines[0]?.name).toBe('Golden Original');
    expect(result.repriced).toEqual([]);
  });

  it('keeps the quantity and the special instructions it was saved with', () => {
    const withNote = buildCartLine(
      product,
      resolveSelectedOptions([sizeGroup], { size: ['size-medium'] }),
      3,
      'extra crispy',
    );

    const result = reconcileCart([withNote], [{ ...product, basePrice: 169 }]);
    expect(result.lines[0]?.quantity).toBe(3);
    expect(result.lines[0]?.specialInstructions).toBe('extra crispy');
  });

  it('handles a mixed basket without losing the good lines', () => {
    const other: Product = { ...product, id: 'soy-garlic', name: 'Soy Garlic Chicken' };
    const otherLine = buildCartLine(other, [], 1);

    const result = reconcileCart([saved, otherLine], [product]);

    expect(result.lines.map((line) => line.productId)).toEqual(['golden-original']);
    expect(result.dropped.map(({ line }) => line.productId)).toEqual(['soy-garlic']);
  });
});

describe('describeReconciliation', () => {
  const line = buildCartLine(product, [], 1);

  it('says nothing when nothing changed', () => {
    expect(
      describeReconciliation({ lines: [line], dropped: [], repriced: [], changed: false }),
    ).toBeNull();
  });

  it('names a single removed item', () => {
    const notice = describeReconciliation({
      lines: [],
      dropped: [{ line, reason: 'unavailable' }],
      repriced: [],
      changed: true,
    });

    expect(notice).toBe('Golden Original Chicken is no longer available, so we removed it.');
  });

  it('lists several removed items readably', () => {
    const second = buildCartLine({ ...product, id: 'b', name: 'Cheesling Fries' }, [], 1);
    const notice = describeReconciliation({
      lines: [],
      dropped: [
        { line, reason: 'unavailable' },
        { line: second, reason: 'off-menu' },
      ],
      repriced: [],
      changed: true,
    });

    expect(notice).toContain('Golden Original Chicken and Cheesling Fries');
    expect(notice).toContain('are no longer available');
  });

  it('gives both prices when one item has changed', () => {
    const notice = describeReconciliation({
      lines: [line],
      dropped: [],
      repriced: [{ line, previousUnitPrice: 129 }],
      changed: true,
    });

    expect(notice).toContain('R 149.00');
    expect(notice).toContain('R 129.00');
  });

  it('counts rather than lists when several prices moved', () => {
    const notice = describeReconciliation({
      lines: [line],
      dropped: [],
      repriced: [
        { line, previousUnitPrice: 129 },
        { line, previousUnitPrice: 100 },
      ],
      changed: true,
    });

    expect(notice).toBe('2 items have changed price since you added them.');
  });
});

/**
 * What freezing the discount allowed.
 *
 * The cart stored the number a voucher produced and threw the terms away.
 * Apply a 15% code to a R596 basket for R89.40 off, then take items out until
 * the basket is R149 — below the code's own R150 minimum — and the R89.40
 * still came off: a 60% discount on an order that no longer qualified for the
 * voucher at all. Verified in the browser before this was written.
 */
describe('voucherDiscount', () => {
  const fifteenPercent: VoucherTerms = {
    code: 'SPICY15',
    discountType: 'percentage',
    discountValue: 15,
    minimumSpend: 150,
  };

  const fiftyOff: VoucherTerms = {
    code: 'WELCOME50',
    discountType: 'fixed',
    discountValue: 50,
    minimumSpend: 200,
  };

  it('is a percentage of the basket as it stands, not as it was', () => {
    expect(voucherDiscount(fifteenPercent, 596)).toBe(89.4);
    expect(voucherDiscount(fifteenPercent, 200)).toBe(30);
  });

  it('stops applying the moment the basket drops below the minimum', () => {
    expect(voucherDiscount(fifteenPercent, 150)).toBe(22.5);
    expect(voucherDiscount(fifteenPercent, 149)).toBe(0);
  });

  it('never takes more than the basket is worth', () => {
    // A R50 code against R30 of food must not produce a negative total.
    expect(voucherDiscount({ ...fiftyOff, minimumSpend: 0 }, 30)).toBe(30);
  });

  it('leaves the subtotal alone for free delivery, which is carried by the fee', () => {
    expect(
      voucherDiscount(
        { code: 'FREEDEL', discountType: 'freeDelivery', discountValue: 0, minimumSpend: 150 },
        400,
      ),
    ).toBe(0);
  });

  it('withdraws free delivery too when the basket stops qualifying', () => {
    const freeDel: VoucherTerms = {
      code: 'FREEDEL',
      discountType: 'freeDelivery',
      discountValue: 0,
      minimumSpend: 150,
    };
    expect(voucherFreesDelivery(freeDel, 150)).toBe(true);
    expect(voucherFreesDelivery(freeDel, 149)).toBe(false);
  });

  it('says whether the basket qualifies at all', () => {
    expect(voucherQualifies(fiftyOff, 200)).toBe(true);
    expect(voucherQualifies(fiftyOff, 199.99)).toBe(false);
  });
});

/**
 * The voucher terms hold what a code *asks for*, so it can be re-decided
 * against the basket at any moment. Expiry was the one term left out: it was
 * checked once, as the code was typed, against a boolean stamped at fetch
 * time, and after that the cart had no way to know.
 *
 * Driven in a browser: apply SPICY15, move the clock on eight days, and it was
 * still taken at checkout and printed on the confirmation as
 * "Promo discount −R 31.35" — R 214.65 charged against R 246.00 owed, six days
 * after the voucher died.
 */
describe('a voucher that expires while it sits in the basket', () => {
  const applied = new Date(2026, 7, 24, 14, 0);
  const afterExpiry = new Date(2026, 8, 2, 14, 0);
  const expiresAt = new Date(2026, 7, 31, 23, 59).toISOString();

  const percentage: VoucherTerms = {
    code: 'SPICY15',
    discountType: 'percentage',
    discountValue: 15,
    minimumSpend: 150,
    expiresAt,
  };

  const freeDelivery: VoucherTerms = {
    code: 'FREEDEL',
    discountType: 'freeDelivery',
    discountValue: 0,
    minimumSpend: 150,
    expiresAt,
  };

  it('is worth something while it is alive', () => {
    expect(voucherDiscount(percentage, 209, applied)).toBe(31.35);
  });

  it('is worth nothing once it has expired', () => {
    expect(voucherDiscount(percentage, 209, afterExpiry)).toBe(0);
  });

  /**
   * Free delivery is carried by the fee rather than the subtotal, so it takes
   * a different route out of the totals and would have kept working on its
   * own. Both go through `voucherQualifies`, which is why one rule covers it.
   */
  it('stops freeing the delivery too', () => {
    expect(voucherFreesDelivery(freeDelivery, 209, applied)).toBe(true);
    expect(voucherFreesDelivery(freeDelivery, 209, afterExpiry)).toBe(false);
  });

  it('expires on the stroke, not the day after', () => {
    expect(voucherExpired(percentage, new Date(2026, 7, 31, 23, 58))).toBe(false);
    expect(voucherExpired(percentage, new Date(2026, 7, 31, 23, 59))).toBe(true);
  });

  it('never expires without a date, which is what an open-ended code is', () => {
    const forever: VoucherTerms = { ...percentage };
    delete forever.expiresAt;

    expect(voucherExpired(forever, afterExpiry)).toBe(false);
    expect(voucherDiscount(forever, 209, afterExpiry)).toBe(31.35);
  });

  /**
   * A date the app cannot parse is somebody's data fault. Refusing the
   * discount over it would take money off a customer for a typo that is not
   * theirs, so the code stays good and the basket decides.
   */
  it('does not expire a voucher over an unreadable date', () => {
    const broken: VoucherTerms = { ...percentage, expiresAt: 'sometime next week' };

    expect(voucherExpired(broken, afterExpiry)).toBe(false);
    expect(voucherDiscount(broken, 209, afterExpiry)).toBe(31.35);
  });

  /** Expiry and the minimum are independent — failing either is enough. */
  it('still refuses a live voucher on too small a basket', () => {
    expect(voucherDiscount(percentage, 100, applied)).toBe(0);
  });
});
