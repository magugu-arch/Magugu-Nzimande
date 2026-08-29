import { useCartStore } from '@/store/cartStore';
import {
  buildCartLine,
  defaultSelectionFor,
  reconcileCart,
  resolveSelectedOptions,
  type VoucherTerms,
} from '@/utils/cart';
import type { CartLine, Product } from '@/types';
import { products } from '@/services/data/menuData';

const first = products[0]!;

/** The basket a customer gets by adding the item without touching anything. */
const lineFor = (product: Product): CartLine =>
  buildCartLine(
    product,
    resolveSelectedOptions(product.optionGroups, defaultSelectionFor(product)),
    1,
  );

const voucher: VoucherTerms = {
  code: 'SPICY15',
  discountType: 'percentage',
  discountValue: 15,
  minimumSpend: 0,
};

const reward = {
  rewardId: 'free-wings',
  name: 'Free Wings',
  discount: 79,
  pointsCost: 400,
  category: 'food' as const,
};

/**
 * What reconciling a basket does to a voucher and a redeemed reward.
 *
 * `setLines` cleared both on every reconcile, reasoning that "a code validated
 * against the old subtotal may no longer qualify against the new one". That was
 * true of the cart that froze a voucher's discount at the moment it was entered.
 * `priceBasket` now recomputes `voucherDiscount` against the basket as it
 * stands, expiry and minimum spend included — so a voucher cannot go stale, and
 * the comment had outlived the code.
 *
 * Meanwhile reconciliation fires on *any* difference, and a backend fixing a
 * typo in a product name is a difference that produces no notice at all,
 * because a rename is correctly nothing worth interrupting anyone over. So:
 * apply a discount, background the app, come back after the menu refetches, and
 * it is gone with nothing on screen to explain it.
 *
 * The reward is the worse half. `rewards/[id]` spends the points *before* it
 * applies the reward, and `RewardTerms` carries no minimum spend — so a reward
 * can never stop qualifying, and clearing it burned 400 points for nothing.
 */
describe('a promotion through a reconcile', () => {
  const reset = (over: Partial<ReturnType<typeof useCartStore.getState>> = {}) =>
    useCartStore.setState({
      lines: [],
      voucher: null,
      reward: null,
      reconciliationNotice: null,
      ...over,
    });

  beforeEach(() => reset());

  it('survives a rename, which costs nothing and is announced to nobody', () => {
    const line = lineFor(first);
    reset({ lines: [line], voucher, reward });

    const renamed = reconcileCart([line], [{ ...first, name: `${first.name} (large)` }]);
    // The line does have to be written back — but no number moved.
    expect(renamed.changed).toBe(true);
    expect(renamed.repriced).toHaveLength(0);
    expect(renamed.dropped).toHaveLength(0);

    useCartStore.getState().setLines(renamed.lines, null);

    expect(useCartStore.getState().voucher).toEqual(voucher);
    expect(useCartStore.getState().reward).toEqual(reward);
  });

  it('survives a reprice, because the discount is recomputed either way', () => {
    const line = lineFor(first);
    reset({ lines: [line], voucher, reward });

    const dearer = reconcileCart([line], [{ ...first, basePrice: first.basePrice + 10 }]);
    expect(dearer.repriced).toHaveLength(1);

    useCartStore.getState().setLines(dearer.lines, 'a price moved');

    expect(useCartStore.getState().voucher).toEqual(voucher);
    expect(useCartStore.getState().reward).toEqual(reward);
  });

  /**
   * The protection the old clearing was reaching for, done where it belongs:
   * the voucher stays applied and is simply worth nothing while the basket sits
   * under its minimum.
   */
  it('is worth nothing, rather than removed, when the basket drops below its minimum', () => {
    const line = lineFor(first);
    const dear: VoucherTerms = { ...voucher, minimumSpend: line.unitPrice * 10 };
    reset({ lines: [line], voucher: dear });

    expect(useCartStore.getState().getTotals().discount).toBe(0);
    expect(useCartStore.getState().voucher).toEqual(dear);
  });

  it('goes when reconciliation empties the basket, which nothing can be applied to', () => {
    const line = lineFor(first);
    reset({ lines: [line], voucher, reward });

    // Every line off the menu.
    const emptied = reconcileCart([line], [{ ...first, available: false }]);
    expect(emptied.lines).toHaveLength(0);

    useCartStore.getState().setLines(emptied.lines, 'everything went');

    expect(useCartStore.getState().voucher).toBeNull();
    expect(useCartStore.getState().reward).toBeNull();
  });
});
