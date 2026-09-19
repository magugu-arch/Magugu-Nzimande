import { categories, products, DISH_SOURCES } from '@/services/data/menuData';
import { hasFoodAsset } from '@/constants/foodAssets';
import type { CategoryId } from '@/types';

/**
 * The Pappas menu taxonomy, against the brief that specifies it.
 *
 * §17.6 lists sixteen category ids; §10's asset map names ten of them as
 * having supplied photography. Those ten are what ships, and the reason is
 * §15's rule against inventing dishes — a category with no supplied contents
 * is an empty screen a customer can navigate into.
 *
 * These tests hold the shape rather than the copy: a tagline is a writer's
 * call, but which categories exist, that none is empty, that every dish lands
 * in one, and — the important one for this build — that no dish carries a
 * price nobody supplied are all things the brief decides.
 */

/** The ten categories §10 supplies photography for. */
const SUPPLIED_TAXONOMY = [
  'mezedakia',
  'salads',
  'souvlaki',
  'seafood',
  'fish-market',
  'signature-mains',
  'steak-on-the-rock',
  'desserts',
  'breakfast',
  'drinks',
] as const;

/**
 * §17.6's other ids, held back until Pappas supplies their contents.
 *
 * Asserted rather than left implicit, so promoting one is a decision somebody
 * makes on purpose and not a diff nobody notices.
 */
const AWAITING_CONTENTS = [
  'vegetarian',
  'meat',
  'dips',
  'lightMeals',
  'steaks',
  'fishPlatters',
  'gelato',
] as const;

describe('menu taxonomy follows the brief', () => {
  it('surfaces only categories the brief supplies photography for', () => {
    const unknown = categories
      .map((category) => category.id)
      .filter((id) => !(SUPPLIED_TAXONOMY as readonly string[]).includes(id));

    expect(unknown).toEqual([]);
  });

  it('surfaces all ten of them', () => {
    expect([...categories.map((c) => c.id)].sort()).toEqual([...SUPPLIED_TAXONOMY].sort());
  });

  it('does not type a category it cannot fill', () => {
    // §17.6 names these seven and supplies neither imagery nor contents for
    // any. Typing one would let a screen route to it.
    const typed = categories.map((category) => category.id as string);
    for (const held of AWAITING_CONTENTS) {
      expect(typed).not.toContain(held);
    }
  });

  it('orders them as a kitchen would serve them', () => {
    const order = categories.map((category) => category.sortOrder);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
  });

  it('files every dish in a surfaced category', () => {
    const surfaced = new Set<CategoryId>(categories.map((category) => category.id));
    const orphans = products
      .filter((product) => !surfaced.has(product.categoryId))
      .map((product) => `${product.id} -> ${product.categoryId}`);

    expect(orphans).toEqual([]);
  });

  it('leaves no category empty', () => {
    // A category chip that always lands on "nothing here right now" is a worse
    // menu than one chip fewer.
    const counts = new Map<string, number>(categories.map((category) => [category.id, 0]));
    for (const product of products) {
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }

    const empty = [...counts].filter(([, count]) => count === 0).map(([id]) => id);
    expect(empty).toEqual([]);
  });

  it('gives every category a tile photograph that actually exists', () => {
    const missing = categories
      .filter((category) => !hasFoodAsset(category.assetKey))
      .map((category) => `${category.id} -> ${category.assetKey}`);

    expect(missing).toEqual([]);
  });

  it('gives every dish a unique id', () => {
    expect(new Set(products.map((product) => product.id)).size).toBe(products.length);
  });
});

/**
 * The rules that keep this catalogue honest.
 *
 * §15: "Do not invent menu prices, events, opening hours, loyalty rules or
 * customer promises." These are the checks that make that enforceable rather
 * than aspirational — every one of them would fail the moment somebody typed
 * a plausible number into this file to make a screenshot look finished.
 */
describe('nothing in the catalogue is invented', () => {
  it('states no price nobody supplied', () => {
    const priced = products
      .filter((product) => product.priceStatus !== 'awaiting-business-input')
      .map((product) => product.id);

    // When Pappas supplies pricing this expectation flips — and it should be
    // flipped deliberately, by someone who has the real menu in front of them.
    expect(priced).toEqual([]);
  });

  it('never offers an unpriced dish for sale', () => {
    // The pairing that makes `basePrice: 0` safe: a dish awaiting a price is
    // unavailable, so the zero can never reach a cart total.
    const orderable = products
      .filter((product) => product.priceStatus === 'awaiting-business-input' && product.available)
      .map((product) => product.id);

    expect(orderable).toEqual([]);
  });

  it('records where every dish was read from', () => {
    // Each dish is legible in a supplied Pappas photograph, and says which.
    const unsourced = products.filter((product) => !DISH_SOURCES[product.id]);
    expect(unsourced.map((product) => product.id)).toEqual([]);
  });

  it('claims no allergen information', () => {
    // §15 covers customer promises, and an allergen claim is the one kind of
    // invented content that can put somebody in hospital.
    const claiming = products
      .filter((product) => product.allergens.length > 0)
      .map((product) => product.id);

    expect(claiming).toEqual([]);
  });

  it('awards no best-seller or popularity badge', () => {
    // §6: those labels are permitted "only when backed by business data", and
    // there is none. `signature` and `vegetarian` are observable from the dish.
    const unbacked = products
      .filter((product) =>
        product.tags.some((tag) => ['bestseller', 'popular', 'chefs-choice'].includes(tag)),
      )
      .map((product) => product.id);

    expect(unbacked).toEqual([]);
  });
});
