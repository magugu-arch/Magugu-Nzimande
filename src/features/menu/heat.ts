import type { Product } from '@/types';

/**
 * "Show milder items first", which until now showed nothing first.
 *
 * `AppPreferences.preferMildFirst` is a switch on the Preferences screen. The
 * customer reads "Puts the gentler flavours at the top of every list", flips
 * it, and it is written to the store, persisted to storage and kept across
 * sign-outs. It was read by nothing. Every list came back in exactly the order
 * it was already in, and every chilli badge stayed where it was.
 *
 * The type's own comment said what it was for — "Hides spice badges and hot
 * items first for heat-averse customers" — which is the same shape as the
 * birthday reward and the trading hours before it: a rule stated in the code
 * and in the interface, and kept nowhere.
 *
 * Two behaviours, because the copy promises two things and the type names both.
 */

/**
 * The menu, gentlest first, without disturbing anything else about the order.
 *
 * A **stable** sort by heat alone. Products inside one heat level keep the
 * order they arrived in — which is the merchandising order for a category, the
 * relevance order for a search, and hearted-newest-first for favourites. A
 * customer who asks for milder things first has not asked for the menu to be
 * reshuffled underneath them, and re-ranking a search by heat would answer a
 * question nobody asked.
 *
 * `Array.prototype.sort` is specified stable, so this is the sort itself doing
 * the work rather than a tiebreak bolted on. The copy is deliberate too: this
 * must never mutate the array a query handed it.
 */
export function mildestFirst(products: Product[]): Product[] {
  return [...products].sort((a, b) => a.spiceLevel - b.spiceLevel);
}

/**
 * Whether a heat badge should be drawn at all.
 *
 * The badge is the other half of the promise. Somebody who has said they would
 * rather not deal with heat is not helped by a red "Hot" flag on every third
 * card; the item is still there, still findable, still labelled in its own
 * description — it simply stops being shouted about.
 *
 * The product detail screen keeps its badge either way, and that is on
 * purpose: a customer who has opened Hot Spicy Chicken is entitled to be told
 * it is hot, whatever their list preference says. This governs lists.
 */
export function showsHeatBadge(spiceLevel: number, preferMildFirst: boolean): boolean {
  return !preferMildFirst && spiceLevel >= 3;
}

/** Applies the preference to a list, or hands it straight back. */
export function orderedForHeat(products: Product[], preferMildFirst: boolean): Product[] {
  return preferMildFirst ? mildestFirst(products) : products;
}
