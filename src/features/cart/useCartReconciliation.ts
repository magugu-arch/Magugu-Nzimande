import { useEffect } from 'react';
import type { CartReconciliation } from '@/utils/cart';
import { useMenu } from '@/features/menu/hooks';
import { useCartStore } from '@/store/cartStore';
import { announce } from '@/utils/accessibility';
import { reconcileCart } from '@/utils/cart';
import { formatPrice } from '@/utils/money';

/**
 * Human wording for what reconciliation did, or null when it did nothing worth
 * mentioning. Exported separately from the hook so the phrasing can be tested
 * without a renderer.
 */
export function describeReconciliation(result: CartReconciliation): string | null {
  const parts: string[] = [];

  if (result.dropped.length > 0) {
    const names = result.dropped.map(({ line }) => line.name);
    const list =
      names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
    parts.push(
      `${list} ${names.length === 1 ? 'is' : 'are'} no longer available, so we removed ${
        names.length === 1 ? 'it' : 'them'
      }.`,
    );
  }

  if (result.repriced.length > 0) {
    if (result.repriced.length === 1) {
      const [only] = result.repriced;
      if (only) {
        parts.push(
          `${only.line.name} is now ${formatPrice(only.line.unitPrice)}, was ${formatPrice(
            only.previousUnitPrice,
          )}.`,
        );
      }
    } else {
      parts.push(`${result.repriced.length} items have changed price since you added them.`);
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

export interface CartReconciliationState {
  /** What changed, in words. Null when the basket was already up to date. */
  notice: string | null;
  dismiss: () => void;
}

/**
 * Keeps a saved basket honest against the live menu.
 *
 * The cart persists to disk with every price baked in, which is what makes it
 * work offline and what makes it go stale. Without this, a basket left
 * overnight checks out at yesterday's prices, and an item withdrawn from the
 * menu is still ordered.
 *
 * The safety rule is that only a *successfully loaded* menu may change the
 * basket. A failed fetch, an empty cache or a loading state leaves it exactly
 * as it was — reconciling against nothing would read as "everything is off the
 * menu" and silently empty the basket on a bad connection.
 */
export function useCartReconciliation(): CartReconciliationState {
  const menu = useMenu();
  const lines = useCartStore((state) => state.lines);
  const setLines = useCartStore((state) => state.setLines);

  // The notice lives in the store rather than in local state, so it survives
  // the customer moving from the cart to checkout before reading it.
  const notice = useCartStore((state) => state.reconciliationNotice);
  const dismiss = useCartStore((state) => state.dismissReconciliationNotice);

  useEffect(() => {
    const products = menu.data?.products;

    // `isSuccess` is the guard that matters. `menu.data` alone would also be
    // satisfied by stale cache during a background refetch, which is fine, but
    // a loading or errored menu must never be treated as an empty one.
    if (!menu.isSuccess || !products || products.length === 0) return;
    if (lines.length === 0) return;

    const result = reconcileCart(lines, products);
    if (!result.changed) return;

    const notice = describeReconciliation(result);
    setLines(result.lines, notice);

    // Nobody asked for this: the basket changes the moment the menu loads. A
    // sighted customer sees the notice appear; without this, everyone else
    // reaches checkout at a total they were never told about.
    if (notice) announce(notice);
  }, [menu.isSuccess, menu.data, lines, setLines]);

  return { notice, dismiss };
}
