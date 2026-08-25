import type { Product } from '@/types';
import { rewardEffect } from '@/utils/cart';
import { useCartStore } from '@/store/cartStore';

const chicken = {
  id: 'golden-original',
  name: 'Golden Original Chicken',
  assetKey: 'goldenOriginal',
  basePrice: 149,
  optionGroups: [],
  available: true,
} as unknown as Product;

const freeDelivery = {
  rewardId: 'reward-delivery',
  name: 'Free Delivery',
  discount: 32,
  pointsCost: 300,
  category: 'delivery' as const,
};

const foodReward = {
  rewardId: 'reward-fries',
  name: 'Free Fries',
  discount: 40,
  pointsCost: 400,
  category: 'food' as const,
};

/**
 * "Free Delivery" was a flat R32 off, applied whatever the order was, and
 * `calculateTotals` caps a reward against the subtotal rather than against the
 * fee it is meant to cover:
 *
 *     COLLECT  : deliveryFee 0, rewardsDiscount 32 → R122 instead of R154
 *     OVER R350: deliveryFee 0, rewardsDiscount 32 → R420 instead of R452
 *
 * Somebody collecting their own order spent 300 points and got R32 off chicken
 * they carried home themselves. The reward says what it is: "We cover the
 * delivery fee on your next order."
 */
describe('what a reward does to the bill', () => {
  it('sends a delivery reward to the fee, not to the food', () => {
    expect(rewardEffect(freeDelivery, 'delivery')).toEqual({
      rewardsDiscount: 0,
      freeDelivery: true,
    });
  });

  it('gives a delivery reward nothing to do on a collection order', () => {
    expect(rewardEffect(freeDelivery, 'collection')).toEqual({
      rewardsDiscount: 0,
      freeDelivery: false,
    });
  });

  it('leaves every other kind of reward as rand off the food', () => {
    expect(rewardEffect(foodReward, 'delivery')).toEqual({
      rewardsDiscount: 40,
      freeDelivery: false,
    });
  });

  /** A basket saved before rewards carried a category must keep working. */
  it('treats a reward with no category as a flat discount, as it always was', () => {
    expect(rewardEffect({ discount: 25 }, 'delivery')).toEqual({
      rewardsDiscount: 25,
      freeDelivery: false,
    });
  });
});

describe('a Free Delivery reward against a real basket', () => {
  const startCart = (fulfilment: 'delivery' | 'collection', quantity = 1) => {
    const store = useCartStore.getState();
    store.clear();
    store.addLine(chicken, [], quantity);
    useCartStore.getState().setFulfilmentType(fulfilment);
  };

  afterEach(() => {
    useCartStore.getState().clear();
  });

  it('covers the delivery fee and takes nothing off the food', () => {
    startCart('delivery');
    const before = useCartStore.getState().getTotals();
    expect(before.deliveryFee).toBeGreaterThan(0);

    useCartStore.getState().applyReward(freeDelivery);
    const after = useCartStore.getState().getTotals();

    expect(after.deliveryFee).toBe(0);
    expect(after.rewardsDiscount).toBe(0);
    expect(after.total).toBe(before.total - before.deliveryFee);
    expect(useCartStore.getState().getRewardWorth()).toBe(before.deliveryFee);
  });

  it('takes nothing off an order somebody is collecting themselves', () => {
    startCart('collection');
    const before = useCartStore.getState().getTotals();

    useCartStore.getState().applyReward(freeDelivery);
    const after = useCartStore.getState().getTotals();

    expect(after.total).toBe(before.total);
    expect(useCartStore.getState().getRewardWorth()).toBe(0);
  });

  /** Three boxes clears the R350 free-delivery threshold on their own. */
  it('takes nothing off a basket whose delivery was already free', () => {
    startCart('delivery', 3);
    const before = useCartStore.getState().getTotals();
    expect(before.deliveryFee).toBe(0);

    useCartStore.getState().applyReward(freeDelivery);

    expect(useCartStore.getState().getTotals().total).toBe(before.total);
    expect(useCartStore.getState().getRewardWorth()).toBe(0);
  });

  it('still lets a food reward take rand off, on any fulfilment type', () => {
    startCart('collection');
    const before = useCartStore.getState().getTotals();

    useCartStore.getState().applyReward(foodReward);

    expect(useCartStore.getState().getTotals().total).toBe(before.total - 40);
    expect(useCartStore.getState().getRewardWorth()).toBe(40);
  });
});
