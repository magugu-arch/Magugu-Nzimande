import type { Product } from '@/types';
import { PRICE_UNAVAILABLE, formatPrice } from '@/utils/money';

/**
 * What a dish costs, when nobody has said what a dish costs.
 *
 * ── The defect this exists to close ──────────────────────────────────────
 *
 * §15 forbids inventing menu prices, and Pappas has supplied none, so every
 * dish in the catalogue ships `basePrice: 0` with
 * `priceStatus: 'awaiting-business-input'` beside it. The data was honest.
 * The screens were not: all three price surfaces called `formatPrice` on the
 * raw number and printed **R 0.00** — on every row of the menu, on every
 * product page, and inside the Add to cart button.
 *
 * R 0.00 is not a missing price. It is a *stated* price, and the price it
 * states is free. `utils/money` had already written down why that is the
 * dangerous failure — "a dash is noticed and reported, free chicken is
 * noticed and ordered" — and exported `PRICE_UNAVAILABLE` for it. Nothing
 * ever called it. The flag existed, the constant existed, and the wire
 * between them was never run.
 *
 * ── Why a helper rather than a fix in `formatPrice` ──────────────────────
 *
 * `formatPrice` takes a number and cannot know the difference between a dish
 * nobody has priced and a R0 line that is genuinely free — a waived delivery
 * fee, a fully-discounted total, a complimentary side. Teaching it to treat
 * every zero as unknown would break those, and they are correct today.
 *
 * The distinction lives on the product, so the helper does too.
 */

/** A dish whose price nobody has supplied yet. */
export function isAwaitingPrice(product: Pick<Product, 'priceStatus'>): boolean {
  return product.priceStatus === 'awaiting-business-input';
}

/**
 * The price to print for a dish: the real one, or an em dash.
 *
 * A dash rather than words because this sits in a menu row and inside a
 * button, where "Price on request" would wrap or truncate. The screens that
 * have room to explain say so in a sentence beside it.
 */
export function priceLabel(product: Pick<Product, 'priceStatus' | 'basePrice'>): string {
  return isAwaitingPrice(product) ? PRICE_UNAVAILABLE : formatPrice(product.basePrice);
}

/**
 * The line total for the Add to cart button, or nothing.
 *
 * `undefined` rather than a dash: `Button`'s `trailingLabel` already omits
 * itself when undefined, which is the right shape for a button that cannot
 * quote a total.
 */
export function lineTotalLabel(
  product: Pick<Product, 'priceStatus'>,
  lineTotal: number,
): string | undefined {
  return isAwaitingPrice(product) ? undefined : formatPrice(lineTotal);
}
