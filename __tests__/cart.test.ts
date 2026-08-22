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
  resolveSelectedOptions,
  unmetOptionGroups,
  unitPriceFor,
} from '@/utils/cart';

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
      { groupId: 'size', groupName: 'Size', optionId: 'size-medium', optionName: 'Medium', priceDelta: 60 },
      { groupId: 'addons', groupName: 'Dips', optionId: 'dip-soy', optionName: 'Soy', priceDelta: 18 },
    ]);
    const b = buildLineId('golden-original', [
      { groupId: 'addons', groupName: 'Dips', optionId: 'dip-soy', optionName: 'Soy', priceDelta: 18 },
      { groupId: 'size', groupName: 'Size', optionId: 'size-medium', optionName: 'Medium', priceDelta: 60 },
    ]);
    expect(a).toBe(b);
  });

  it('distinguishes different configurations of the same product', () => {
    const medium = buildLineId('golden-original', [
      { groupId: 'size', groupName: 'Size', optionId: 'size-medium', optionName: 'Medium', priceDelta: 60 },
    ]);
    const small = buildLineId('golden-original', [
      { groupId: 'size', groupName: 'Size', optionId: 'size-small', optionName: 'Small', priceDelta: 0 },
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
    expect(calculateTotals({ lines: [line(120)], fulfilmentType: 'collection' }).deliveryFee).toBe(0);
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
      { ...buildCartLine(product, resolveSelectedOptions([sizeGroup], { size: ['size-small'] }), 3) },
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
