import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartLine, CartTotals, FulfilmentType, Product, SelectedOption } from '@/types';
import {
  buildCartLine,
  cartItemCount,
  clampQuantity,
  priceBasket,
  type RewardTerms,
  type VoucherTerms,
} from '@/utils/cart';
import { track } from '@/ux/analytics';

/**
 * Cart state.
 *
 * All pricing lives in utils/cart — this store owns the lines and the applied
 * voucher/reward, and derives totals from them. Persisted so a customer who
 * closes the app mid-order still has their basket (brief §12, offline-aware).
 */

/**
 * A voucher is stored by its terms, never by the discount it once produced.
 * See `VoucherTerms` in utils/cart for what freezing the number allowed.
 */
type AppliedVoucher = VoucherTerms;

/**
 * A redeemed reward, carrying enough for the bill to know what it does.
 *
 * `category` matters because a delivery reward covers the delivery fee rather
 * than taking rand off the food — see `rewardEffect`. Without it, "Free
 * Delivery" came off a collection order.
 */
interface AppliedReward extends RewardTerms {
  rewardId: string;
  name: string;
  pointsCost: number;
}

interface CartState {
  lines: CartLine[];
  fulfilmentType: FulfilmentType;
  voucher: AppliedVoucher | null;
  reward: AppliedReward | null;

  addLine: (
    product: Product,
    selectedOptions: SelectedOption[],
    quantity: number,
    specialInstructions?: string,
  ) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateInstructions: (lineId: string, instructions: string) => void;
  removeLine: (lineId: string) => void;
  /** Swap a line's configuration wholesale — used when editing from the cart. */
  replaceLine: (lineId: string, next: CartLine) => void;
  /**
   * Replace every line at once, with a note explaining why. Only for
   * reconciling a saved basket against the live menu — see `reconcileCart`.
   * Leaves the applied voucher and reward where they are, on the same rule as
   * `removeLine`: only an empty basket cannot carry one.
   */
  setLines: (lines: CartLine[], notice: string | null) => void;
  /**
   * What reconciliation last changed, in words, or null. Lives here rather
   * than in a screen's state so the customer still sees it if the basket was
   * reconciled on the way to somewhere else. Never persisted: it describes one
   * moment, not the basket.
   */
  reconciliationNotice: string | null;
  dismissReconciliationNotice: () => void;
  clear: () => void;

  setFulfilmentType: (fulfilmentType: FulfilmentType) => void;
  applyVoucher: (voucher: AppliedVoucher) => void;
  removeVoucher: () => void;
  applyReward: (reward: AppliedReward) => void;
  removeReward: () => void;

  getTotals: () => CartTotals;
  /**
   * What the applied reward actually takes off this bill, in rand.
   *
   * Measured as the difference the reward makes to the total rather than read
   * back from what it was worth when it was redeemed — which is the same
   * mistake the voucher used to make. A "Free Delivery" reward is worth the
   * fee when there is one and nothing at all when there is not, and the cart
   * has no business claiming "R32.00 off" either way.
   */
  getRewardWorth: () => number;
  getItemCount: () => number;
  hasLine: (lineId: string) => boolean;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      fulfilmentType: 'delivery',
      voucher: null,
      reward: null,

      addLine: (product, selectedOptions, quantity, specialInstructions) => {
        const incoming = buildCartLine(product, selectedOptions, quantity, specialInstructions);

        // §15 `add_to_cart`, recorded here rather than in the screens that call
        // it. Three of them do — the product page, a Home best-seller row and
        // reorder — and an event wired per screen is an event the fourth one
        // forgets. `value` is the configured line, modifiers included, because
        // that is what a basket-value chart has to add up.
        track('add_to_cart', {
          productId: product.id,
          categoryId: product.categoryId,
          quantity: incoming.quantity,
          value: incoming.lineTotal,
        });

        set((state) => {
          const existingIndex = state.lines.findIndex((line) => line.id === incoming.id);
          // Same product with an identical configuration merges rather than
          // stacking a duplicate row.
          if (existingIndex >= 0) {
            const existing = state.lines[existingIndex];
            if (!existing) return state;
            const merged = buildCartLine(
              product,
              selectedOptions,
              existing.quantity + incoming.quantity,
              specialInstructions ?? existing.specialInstructions,
            );
            const lines = [...state.lines];
            lines[existingIndex] = merged;
            return { lines };
          }
          return { lines: [...state.lines, incoming] };
        });
      },

      updateQuantity: (lineId, quantity) => {
        set((state) => ({
          lines: state.lines.map((line) => {
            if (line.id !== lineId) return line;
            const safeQuantity = clampQuantity(quantity);
            return {
              ...line,
              quantity: safeQuantity,
              lineTotal: Math.round(line.unitPrice * safeQuantity * 100) / 100,
            };
          }),
        }));
      },

      updateInstructions: (lineId, instructions) => {
        const trimmed = instructions.trim();
        set((state) => ({
          lines: state.lines.map((line) =>
            line.id === lineId
              ? trimmed.length > 0
                ? { ...line, specialInstructions: trimmed }
                : (({ specialInstructions: _omit, ...rest }) => rest)(line)
              : line,
          ),
        }));
      },

      removeLine: (lineId) => {
        set((state) => {
          const lines = state.lines.filter((line) => line.id !== lineId);
          // An empty basket cannot carry a voucher or reward.
          return lines.length === 0 ? { lines, voucher: null, reward: null } : { lines };
        });
      },

      replaceLine: (lineId, next) => {
        set((state) => {
          const lines = state.lines.filter((line) => line.id !== lineId);
          const existingIndex = lines.findIndex((line) => line.id === next.id);
          if (existingIndex >= 0) {
            const existing = lines[existingIndex];
            if (existing) {
              const quantity = clampQuantity(existing.quantity + next.quantity);
              lines[existingIndex] = {
                ...existing,
                quantity,
                lineTotal: Math.round(existing.unitPrice * quantity * 100) / 100,
              };
              return { lines };
            }
          }
          return { lines: [...lines, next] };
        });
      },

      /**
       * This used to clear the voucher and reward on every reconcile, on the
       * grounds that "a code validated against the old subtotal may no longer
       * qualify against the new one". That was true of the cart that froze a
       * voucher's discount at the moment it was entered. It stopped being true
       * when `priceBasket` started recomputing `voucherDiscount` against the
       * basket as it stands — expiry and minimum spend included — and the
       * comment outlived the code it described.
       *
       * What it cost: reconciliation fires on any change, and a backend fixing
       * a typo in a product name is a change. So a renamed dish threw away an
       * applied voucher and, worse, a reward the customer had already spent
       * loyalty points on — a reward carries no spend condition at all, so it
       * could never stop qualifying. Neither produced a notice, because a
       * rename is correctly nothing worth interrupting anyone over.
       *
       * A voucher that no longer qualifies is now worth R0 and says so on the
       * totals, which is the honest version of the same protection. The one
       * case that still clears is an empty basket — `removeLine`'s rule.
       */
      setLines: (lines, notice) =>
        set({
          lines,
          ...(lines.length === 0 ? { voucher: null, reward: null } : {}),
          reconciliationNotice: notice,
        }),

      reconciliationNotice: null,
      dismissReconciliationNotice: () => set({ reconciliationNotice: null }),

      clear: () => set({ lines: [], voucher: null, reward: null }),

      setFulfilmentType: (fulfilmentType) => set({ fulfilmentType }),

      applyVoucher: (voucher) => set({ voucher }),
      removeVoucher: () => set({ voucher: null }),
      applyReward: (reward) => set({ reward }),
      removeReward: () => set({ reward: null }),

      getTotals: () => {
        const { lines, fulfilmentType, voucher, reward } = get();
        return priceBasket({ lines, fulfilmentType, voucher, reward }).totals;
      },

      getRewardWorth: () => {
        const { lines, fulfilmentType, voucher, reward } = get();
        return priceBasket({ lines, fulfilmentType, voucher, reward }).rewardWorth;
      },

      getItemCount: () => cartItemCount(get().lines),

      hasLine: (lineId) => get().lines.some((line) => line.id === lineId),
    }),
    {
      name: 'bbq.cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lines: state.lines,
        fulfilmentType: state.fulfilmentType,
      }),
    },
  ),
);
