import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartLine, CartTotals, FulfilmentType, Product, SelectedOption } from '@/types';
import {
  buildCartLine,
  calculateTotals,
  cartItemCount,
  clampQuantity,
  voucherDiscount,
  voucherFreesDelivery,
  type VoucherTerms,
} from '@/utils/cart';
import { sumRand } from '@/utils/money';

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

interface AppliedReward {
  rewardId: string;
  name: string;
  discount: number;
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
   * Any applied voucher is dropped along with it, because a code validated
   * against the old subtotal may no longer qualify against the new one.
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

      // Only called when reconciliation actually found a difference, so the
      // voucher and reward always go: both were validated against a basket
      // that no longer exists, and a promo that no longer qualifies must be
      // re-earned rather than carried over unchecked.
      setLines: (lines, notice) =>
        set({ lines, voucher: null, reward: null, reconciliationNotice: notice }),

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
        // The voucher's worth is recomputed against the basket as it stands,
        // never read back from what it was worth when it was entered.
        const subtotal = sumRand(lines.map((line) => line.lineTotal));

        return calculateTotals({
          lines,
          fulfilmentType,
          voucherDiscount: voucher ? voucherDiscount(voucher, subtotal) : 0,
          rewardsDiscount: reward?.discount ?? 0,
          ...(voucher && voucherFreesDelivery(voucher, subtotal) ? { deliveryFeeOverride: 0 } : {}),
        });
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
