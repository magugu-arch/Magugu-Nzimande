import { act } from '@testing-library/react-native';
import type { Product } from '@/types';
import { useCartStore } from '@/store/cartStore';
import { resolveSelectedOptions } from '@/utils/cart';
import { businessRules } from '@/constants/config';

const product: Product = {
  id: 'honey-garlic',
  slug: 'honey-garlic-chicken',
  name: 'Honey Garlic Chicken',
  shortDescription: 'Sticky',
  description: 'Sticky honey glaze',
  basePrice: 165,
  categoryId: 'chicken',
  assetKey: 'honeyGarlic',
  spiceLevel: 0,
  tags: ['bestseller'],
  optionGroups: [
    {
      id: 'size',
      name: 'Size',
      kind: 'size',
      minSelect: 1,
      maxSelect: 1,
      defaultOptionIds: ['size-medium'],
      options: [
        { id: 'size-small', name: 'Small', priceDelta: 0, available: true },
        { id: 'size-medium', name: 'Medium', priceDelta: 60, available: true },
      ],
    },
  ],
  recommendedProductIds: [],
  available: true,
  preparationMinutes: 20,
  serves: 'Serves 2 – 3',
  allergens: [],
};

const medium = () => resolveSelectedOptions(product.optionGroups, { size: ['size-medium'] });
const small = () => resolveSelectedOptions(product.optionGroups, { size: ['size-small'] });

beforeEach(() => {
  act(() => {
    useCartStore.getState().clear();
    useCartStore.getState().setFulfilmentType('delivery');
  });
});

describe('cart store', () => {
  it('adds a line and derives totals', () => {
    act(() => {
      useCartStore.getState().addLine(product, medium(), 1);
    });

    const state = useCartStore.getState();
    expect(state.lines).toHaveLength(1);
    expect(state.getItemCount()).toBe(1);
    expect(state.getTotals().subtotal).toBe(225);
  });

  it('merges an identical configuration instead of stacking a duplicate row', () => {
    act(() => {
      useCartStore.getState().addLine(product, medium(), 1);
      useCartStore.getState().addLine(product, medium(), 2);
    });

    const state = useCartStore.getState();
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0]?.quantity).toBe(3);
    expect(state.lines[0]?.lineTotal).toBe(675);
  });

  it('keeps different configurations as separate lines', () => {
    act(() => {
      useCartStore.getState().addLine(product, medium(), 1);
      useCartStore.getState().addLine(product, small(), 1);
    });

    expect(useCartStore.getState().lines).toHaveLength(2);
    expect(useCartStore.getState().getItemCount()).toBe(2);
  });

  it('recalculates the line total when quantity changes', () => {
    act(() => {
      useCartStore.getState().addLine(product, medium(), 1);
    });
    const lineId = useCartStore.getState().lines[0]?.id as string;

    act(() => {
      useCartStore.getState().updateQuantity(lineId, 4);
    });

    expect(useCartStore.getState().lines[0]?.lineTotal).toBe(900);
  });

  it('clamps quantity to the per-line maximum', () => {
    act(() => {
      useCartStore.getState().addLine(product, medium(), 1);
    });
    const lineId = useCartStore.getState().lines[0]?.id as string;

    act(() => {
      useCartStore.getState().updateQuantity(lineId, 999);
    });

    expect(useCartStore.getState().lines[0]?.quantity).toBe(businessRules.maxQuantityPerLine);
  });

  it('drops the voucher and reward when the last line is removed', () => {
    act(() => {
      useCartStore.getState().addLine(product, medium(), 1);
      useCartStore.getState().applyVoucher({ code: 'WELCOME50', discount: 50, freeDelivery: false });
      useCartStore.getState().applyReward({
        rewardId: 'reward-fries',
        name: 'Free French Fries',
        discount: 20,
        pointsCost: 400,
      });
    });

    const lineId = useCartStore.getState().lines[0]?.id as string;
    act(() => {
      useCartStore.getState().removeLine(lineId);
    });

    const state = useCartStore.getState();
    expect(state.lines).toHaveLength(0);
    expect(state.voucher).toBeNull();
    expect(state.reward).toBeNull();
  });

  it('applies a voucher discount to the total', () => {
    act(() => {
      useCartStore.getState().addLine(product, medium(), 1);
      useCartStore.getState().applyVoucher({ code: 'WELCOME50', discount: 50, freeDelivery: false });
    });

    const totals = useCartStore.getState().getTotals();
    expect(totals.discount).toBe(50);
    expect(totals.total).toBe(225 - 50 + businessRules.deliveryFee + businessRules.serviceFee);
  });

  it('waives the delivery fee for a free-delivery voucher', () => {
    act(() => {
      useCartStore.getState().addLine(product, medium(), 1);
      useCartStore.getState().applyVoucher({ code: 'FREEDEL', discount: 0, freeDelivery: true });
    });

    expect(useCartStore.getState().getTotals().deliveryFee).toBe(0);
  });

  it('drops the delivery fee when switching to collection', () => {
    act(() => {
      useCartStore.getState().addLine(product, medium(), 1);
    });
    expect(useCartStore.getState().getTotals().deliveryFee).toBe(businessRules.deliveryFee);

    act(() => {
      useCartStore.getState().setFulfilmentType('collection');
    });
    expect(useCartStore.getState().getTotals().deliveryFee).toBe(0);
  });

  it('stores and clears special instructions', () => {
    act(() => {
      useCartStore.getState().addLine(product, medium(), 1);
    });
    const lineId = useCartStore.getState().lines[0]?.id as string;

    act(() => {
      useCartStore.getState().updateInstructions(lineId, ' extra crispy ');
    });
    expect(useCartStore.getState().lines[0]?.specialInstructions).toBe('extra crispy');

    act(() => {
      useCartStore.getState().updateInstructions(lineId, '   ');
    });
    expect(useCartStore.getState().lines[0]?.specialInstructions).toBeUndefined();
  });

  it('reports whether a line is present', () => {
    act(() => {
      useCartStore.getState().addLine(product, medium(), 1);
    });
    const lineId = useCartStore.getState().lines[0]?.id as string;

    expect(useCartStore.getState().hasLine(lineId)).toBe(true);
    expect(useCartStore.getState().hasLine('not-a-line')).toBe(false);
  });
});
