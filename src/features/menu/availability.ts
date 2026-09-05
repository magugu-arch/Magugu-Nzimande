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
export function isSoldOut(product: Pick<Product, 'available'>): boolean {
  return !product.available;
}

/** The word itself, in one place, so three screens cannot drift apart. */
export const SOLD_OUT_LABEL = 'Sold out';

/**
 * What a screen reader is told about a product in a list.
 *
 * The name, the price it starts from, and — when it applies — that it cannot
 * be ordered. The sold-out clause goes directly after the name rather than at
 * the end: somebody listening to a long menu should not have to hear a price
 * they cannot act on before finding out they cannot act on it.
 */
export function productListLabel(
  product: Pick<Product, 'name' | 'basePrice' | 'available'>,
  suffix?: string,
): string {
  const parts = [product.name];
  if (isSoldOut(product)) parts.push(SOLD_OUT_LABEL);
  parts.push(`from ${formatPrice(product.basePrice)}`);

  const label = parts.join(', ');
  return suffix ? `${label}. ${suffix}` : label;
}
