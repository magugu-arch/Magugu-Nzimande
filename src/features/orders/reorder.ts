import type { CartLine, Product } from '@/types';

/**
 * What a reorder can actually put back in the basket.
 *
 * Split out because "Order again" was written twice — once on the order
 * screen and once on the Orders list — and the two did not agree. The order
 * screen carried a comment saying an item that has left the menu should be
 * named rather than silently dropped from the basket; the list did exactly
 * that, silently. And where every line was off the menu, the list's
 * `if (added > 0) router.push('/cart')` meant the button did nothing at all:
 * no basket, no message, no navigation. A control that answers a tap with
 * nothing reads as a broken app.
 *
 * Pure, so the decision can be tested without a renderer, and shared, so the
 * two entry points cannot drift again.
 */
export interface ReorderPlan {
  /** Lines to add, in the order they appeared originally. */
  addable: { line: CartLine; product: Product }[];
  /** Names of lines that cannot come back, for telling the customer. */
  unavailable: string[];
}

export function planReorder(lines: CartLine[], products: Product[]): ReorderPlan {
  const byId = new Map(products.map((product) => [product.id, product]));

  const addable: ReorderPlan['addable'] = [];
  const unavailable: string[] = [];

  for (const line of lines) {
    const product = byId.get(line.productId);
    // Off the menu entirely, or on it and withdrawn — the same outcome for the
    // customer, and both worth naming.
    if (!product || !product.available) {
      unavailable.push(line.name);
      continue;
    }
    addable.push({ line, product });
  }

  return { addable, unavailable };
}

/**
 * What to tell the customer, or null when everything came back and there is
 * nothing worth interrupting them for.
 *
 * Names the items rather than counting them. "1 is no longer available" makes
 * someone open the basket and compare it against a receipt to work out what is
 * missing; naming the dish answers the question on the spot.
 */
export function describeReorder(plan: ReorderPlan): { title: string; message: string } | null {
  if (plan.unavailable.length === 0) return null;

  const names =
    plan.unavailable.length === 1
      ? plan.unavailable[0]
      : `${plan.unavailable.slice(0, -1).join(', ')} and ${plan.unavailable.at(-1)}`;

  if (plan.addable.length === 0) {
    return {
      title: 'Nothing to reorder',
      message: `${names} ${plan.unavailable.length === 1 ? 'is' : 'are'} not on the menu right now.`,
    };
  }

  return {
    title: 'Added what we could',
    message: `${names} ${plan.unavailable.length === 1 ? 'is' : 'are'} no longer available, so we left ${plan.unavailable.length === 1 ? 'it' : 'them'} out.`,
  };
}
