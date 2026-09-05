import type { Product } from '@/types';
import { formatPrice } from '@/utils/money';

/**
 * Whether a product can be ordered right now, and how the menu says so.
 *
 * `Product.available` has been on the type since the catalogue was written and
 * all 28 products carried `true`, so nothing had ever been asked to draw the
 * false case. It was read in exactly two places, both of them behind the
 * customer:
 *
 *   - `reorder` drops an unavailable item from an "Order again".
 *   - `reconcileCart` drops a saved line whose product has gone.
 *
 * Neither is a place a customer meets a product. The menu list, the category
 * grid, the search results, the "Goes well with" carousel and the product
 * screen itself never looked at it — so a withdrawn product was an ordinary
 * tappable row that opened, configured, priced and added to the basket like
 * any other, and the customer found out at the cart, after choosing a size and
 * typing a note to the kitchen.
 *
 * The option-level rule was already right and is the one this follows: a
 * sold-out *option* is dimmed, disabled, and says "Sold out" in its own
 * accessible name (`features/menu/optionLabel`). A sold-out product is the
 * same fact one level up, so it reads the same way.
 */
export type Orderable = Pick<Product, 'available' | 'optionGroups'>;

export function isSoldOut(product: Orderable): boolean {
  return !product.available || hasUnfillableGroup(product);
}

/**
 * A required choice with nothing left to choose, which is a different state
 * from the product being withdrawn and the one the catalogue had no example of.
 *
 * A till marks options out, not products. When the last size in a required
 * group goes, the product record still says `available: true` and every part of
 * the app agrees it is fine: `defaultSelection` correctly refuses to preselect
 * a withdrawn option, so the group starts empty; `minSelect: 1` is never
 * satisfied; and the button reads "Choose size" on a screen where no size can
 * be chosen. Seventy-eight of the seventy-nine seeded options were available
 * and the one that was not had two available siblings, so a group had always
 * had something left in it.
 *
 * Seen in Chromium on Cheesling Fries with both sizes withdrawn: "Regular ·
 * Sold out", "Large · Sold out", and a live button asking for a size.
 *
 * Only *required* groups count. An add-on group with everything gone is a
 * product with no extras available, which is an ordinary Tuesday and not a
 * reason to refuse the order.
 */
export function hasUnfillableGroup(product: Pick<Product, 'optionGroups'>): boolean {
  return product.optionGroups.some(
    (group) => group.minSelect > 0 && !group.options.some((option) => option.available),
  );
}

/** The word itself, in one place, so three screens cannot drift apart. */
export const SOLD_OUT_LABEL = 'Sold out';

/**
 * The sentence the product screen prints above the options.
 *
 * Two ways to be unorderable and they are not the same news. A withdrawn
 * product is gone; a product whose only required group has emptied is still on
 * the menu with nothing left to pick, and saying "this is sold out" over three
 * greyed sizes reads as a contradiction rather than an explanation.
 */
export function soldOutReason(product: Orderable): string | null {
  if (!product.available) {
    return 'This is sold out right now, so it cannot be added to your basket. Please check back later or ask the store.';
  }

  const empty = product.optionGroups.find(
    (group) => group.minSelect > 0 && !group.options.some((option) => option.available),
  );
  if (!empty) return null;

  return `Every choice under "${empty.name}" is sold out, so this cannot be added to your basket. Please check back later or ask the store.`;
}

/**
 * What a screen reader is told about a product in a list.
 *
 * The name, the price it starts from, and — when it applies — that it cannot
 * be ordered. The sold-out clause goes directly after the name rather than at
 * the end: somebody listening to a long menu should not have to hear a price
 * they cannot act on before finding out they cannot act on it.
 */
export function productListLabel(
  product: Pick<Product, 'name' | 'basePrice'> & Orderable,
  suffix?: string,
): string {
  const parts = [product.name];
  if (isSoldOut(product)) parts.push(SOLD_OUT_LABEL);
  parts.push(`from ${formatPrice(product.basePrice)}`);

  const label = parts.join(', ');
  return suffix ? `${label}. ${suffix}` : label;
}
