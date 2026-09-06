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
 * The product a promotion sends somebody to, when it sends them to one.
 *
 * A promotion's `ctaHref` is server data and mostly points at `/product/<id>`.
 * Stock is not: a dish can be withdrawn or lose the last option in a required
 * group while a fortnight-long campaign is still running, and nothing joined
 * the two up — the Offers screen went on headlining "CHEESLING FRIES, LOADED /
 * Add them to any box for R55" with an "Order now" button opening a product
 * that cannot be added to a basket.
 *
 * Returns the id only for a plain product route, so `/offers` and `/(tabs)/menu`
 * are left alone.
 */
export function promotedProductId(ctaHref: string): string | null {
  const match = /^\/product\/([A-Za-z0-9-]+)$/.exec(ctaHref);
  return match?.[1] ?? null;
}

/**
 * The cheapest configuration a customer can actually reach.
 *
 * Every menu card prints a price and every accessible name says "from" it, and
 * both read `basePrice` — a claim about the floor, answered with a number that
 * is only the floor while no required group costs anything and none of them
 * pays anything back.
 *
 * Both halves of that held by coincidence until the kids meals learned to sell
 * a box without a drink. `KIDS_DRINK_GROUP` is `minSelect: 1`, so a customer
 * must choose one of its options, and one of them is now −R12: the Little
 * Crunch box bases at R69 and can be had for R57. The card went on saying R69,
 * which is worse than the understating direction the original guard was written
 * against — a customer scanning the Kids row is being quoted more than the
 * cheapest thing on it.
 *
 * Only required groups count, and only what is available in them: an add-on
 * nobody has to take does not move the floor, and neither does a sold-out
 * option that happens to be the cheapest. `minSelect` multiplies, because a
 * group asking for two picks charges for two.
 */
export function priceFloor(product: Pick<Product, 'basePrice' | 'optionGroups'>): number {
  return product.optionGroups.reduce((total, group) => {
    if (group.minSelect < 1) return total;
    const available = group.options.filter((option) => option.available);
    if (available.length === 0) return total;
    return total + Math.min(...available.map((option) => option.priceDelta)) * group.minSelect;
  }, product.basePrice);
}

/**
 * A ranked suggestion list, with what cannot be sold moved to the back.
 *
 * `fetchProductsByIds` preserves the caller's order because "recommended" lists
 * are deliberately ranked — and it filters for *existence*, never for stock. So
 * a withdrawn dish kept whatever rank the catalogue gave it. Four of the
 * twenty-eight products recommend Rose Ddeok-Bokki, which is withdrawn, and on
 * Secret Sauce Chicken the row came out: Cheesling Fries (sold out), Rose
 * Ddeok-Bokki (sold out), Golden Original. Two of three unbuyable, both of them
 * ahead of the one that could be bought — and at 168pt a card on a 390pt screen,
 * the only orderable suggestion starts off-screen.
 *
 * Sunk rather than dropped, deliberately. "Goes well with" is partly an answer
 * to "what else do you do?", and a customer is better told that a dish exists
 * and is off today than shown a shorter list that pretends it never existed.
 * The card already says "Sold out" in its badge and in its accessible name;
 * what it could not do was stop being first.
 *
 * A stable partition, so the ranking survives inside each half.
 */
export function orderableFirst<T extends Orderable>(products: T[]): T[] {
  return [...products.filter((p) => !isSoldOut(p)), ...products.filter((p) => isSoldOut(p))];
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
  // The floor, not the base. The word is "from", so it has to be true.
  parts.push(`from ${formatPrice(priceFloor(product))}`);

  const label = parts.join(', ');
  return suffix ? `${label}. ${suffix}` : label;
}
