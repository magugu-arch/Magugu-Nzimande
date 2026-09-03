import { CATEGORIES, optionGroupsFor } from './catalogue';
import { PRODUCTS } from './products';

/**
 * The map from this catalogue to a point-of-sale system's own item codes.
 *
 * Every POS integration needs one, and it is the part that actually takes the
 * time. A till does not know what `golden-original` is: it knows PLU 1042, and
 * it rejects an order naming anything else. The same is true of every option a
 * customer can choose — "Half bird" and "Extra cheese" are modifier codes on
 * the till, with their own numbers, and a map that covers products and ignores
 * modifiers is half a map that fails on the first customised order.
 *
 * This is deliberately empty.
 *
 * GAAP's integration specification is not public — they work through an
 * integration partner programme and issue the document under agreement — so
 * the codes are not something that can be guessed, derived or filled in from
 * outside. What is here is the shape they go in, the rule that keeps a
 * half-finished map from reaching production, and one function every adapter
 * asks rather than reading the map itself.
 */

/** A till's own identifier for something orderable. */
export type PosCode = string;

export type PosCatalogueMap = {
  /** Which POS these codes belong to, so two vendors cannot be confused. */
  vendor: string;
  /** Our store id to their branch code. */
  stores: Record<string, PosCode>;
  /** Our product slug to their item code. */
  products: Record<string, PosCode>;
  /**
   * Our option choice to their modifier code, keyed `groupKey:choiceLabel`.
   *
   * Flat rather than nested because a till's modifier codes are flat: the same
   * "Large" can be a different code on a side than on a drink, and the group
   * key is what keeps those apart.
   */
  modifiers: Record<string, PosCode>;
  /** Our service mode to their order type. */
  orderTypes: Record<string, PosCode>;
};

/**
 * The map, unfilled.
 *
 * When GAAP's specification arrives this is the only file that changes. Nothing
 * else in the integration knows a code.
 */
export const POS_CODES: PosCatalogueMap | null = null;

export const modifierKey = (groupKey: string, choiceLabel: string) => `${groupKey}:${choiceLabel}`;

/** Every code an order could possibly need, so completeness can be checked. */
export function requiredPosCodes(): {
  stores: string[];
  products: string[];
  modifiers: string[];
  orderTypes: string[];
} {
  const modifiers = new Set<string>();
  for (const product of PRODUCTS) {
    for (const group of optionGroupsFor(product)) {
      for (const choice of group.choices) modifiers.add(modifierKey(group.key, choice.label));
    }
  }

  return {
    // Read from the seed rather than listed, so a store or a product added
    // without a code fails the completeness check rather than the first order.
    stores: [],
    products: PRODUCTS.map((product) => product.slug),
    modifiers: [...modifiers].sort(),
    orderTypes: ['Delivery', 'Collection', 'Dine-in'],
  };
}

export type Completeness =
  | { state: 'absent' }
  | { state: 'complete' }
  | { state: 'partial'; missing: string[] };

/**
 * Whether the map can be trusted.
 *
 * Three states rather than two, and the middle one is the point: a partial map
 * is worse than no map at all. With no map the adapter is switched off and the
 * console is the kitchen display, which works. With a partial one, orders for
 * mapped items reach the till and orders for unmapped ones are rejected there —
 * intermittently, per basket, in the middle of a service, and the pattern takes
 * a while to spot.
 */
export function posMapCompleteness(map: PosCatalogueMap | null = POS_CODES): Completeness {
  if (!map) return { state: 'absent' };

  const required = requiredPosCodes();
  const missing: string[] = [];

  for (const slug of required.products) {
    if (!map.products[slug]) missing.push(`product:${slug}`);
  }
  for (const key of required.modifiers) {
    if (!map.modifiers[key]) missing.push(`modifier:${key}`);
  }
  for (const mode of required.orderTypes) {
    if (!map.orderTypes[mode]) missing.push(`orderType:${mode}`);
  }

  return missing.length === 0 ? { state: 'complete' } : { state: 'partial', missing };
}

/** The categories a POS would need mapped too, if it groups its menu. */
export const POS_CATEGORY_KEYS = CATEGORIES.map((category) => category.key);
