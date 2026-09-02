import { categories, products } from '@/services/data/menuData';
import { hasFoodAsset } from '@/constants/foodAssets';
import type { CategoryId } from '@/types';

/**
 * The menu taxonomy, against the brief that specifies it.
 *
 * §8 ("Menu taxonomy") and §17 ("Required product categories") both name the
 * same nine, so they are the authority here. The app carried three — Chicken,
 * Meals, Sides — with wings, boneless, burgers and rice bowls filed inside
 * them, plus a `desserts` id that appears in none of the brief's lists.
 *
 * These tests hold the shape rather than the copy: a tagline is a writer's
 * call, but which categories exist, that none of them is empty, and that every
 * product lands in one are all things the brief decides.
 */

/** §8 and §17, in their order. */
const BRIEF_TAXONOMY = [
  'chicken',
  'wings',
  'boneless',
  'meals',
  'burgers',
  'rice-bowls',
  'sides',
  'drinks',
  'sauces-extras',
] as const;

/**
 * Typed, but deliberately not surfaced until their photography lands. Asserted
 * rather than left implicit, so promoting one is a decision somebody makes on
 * purpose and not a diff nobody notices.
 */
const AWAITING_ARTWORK: CategoryId[] = ['drinks', 'sauces-extras'];

describe('menu taxonomy follows the brief', () => {
  it('surfaces only categories the brief names', () => {
    const unknown = categories
      .map((category) => category.id)
      .filter((id) => !(BRIEF_TAXONOMY as readonly string[]).includes(id));

    expect(unknown).toEqual([]);
  });

  it('surfaces every named category that has products', () => {
    const expected = BRIEF_TAXONOMY.filter((id) => !AWAITING_ARTWORK.includes(id));
    expect(categories.map((category) => category.id)).toEqual([...expected]);
  });

  it('orders them as the brief lists them', () => {
    const order = categories.map((category) => category.sortOrder);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length);
  });

  it('files every product in a surfaced category', () => {
    const surfaced = new Set(categories.map((category) => category.id));
    const orphans = products
      .filter((product) => !surfaced.has(product.categoryId))
      .map((product) => `${product.id} -> ${product.categoryId}`);

    expect(orphans).toEqual([]);
  });

  /**
   * The rule that keeps the two held-back categories honest. A category chip
   * that always lands on "this category is empty right now" is a worse menu
   * than one chip fewer, so a category may only appear once something fills it.
   */
  it('leaves no category empty', () => {
    const counts = new Map(categories.map((category) => [category.id, 0]));
    for (const product of products) {
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }

    const empty = [...counts].filter(([, count]) => count === 0).map(([id]) => id);
    expect(empty).toEqual([]);
  });

  it('gives every category a tile photograph that actually exists', () => {
    // The tile is the category's whole visual identity on Home and in Menu;
    // a missing one renders the placeholder tile on the busiest screen.
    const missing = categories
      .filter((category) => !hasFoodAsset(category.assetKey))
      .map((category) => `${category.id} -> ${category.assetKey}`);

    expect(missing).toEqual([]);
  });

  it('keeps every product in the catalogue, wherever it was filed', () => {
    // The check is that nothing is dropped or duplicated when products move
    // between categories, which is what a re-file can silently do.
    //
    // This asserted a literal 16 alongside it, which made the count of the
    // menu a fact stated in a test as well as in the menu — so adding eight
    // products failed here with nothing wrong. A duplicate id is the defect;
    // the size of the menu is a business decision, and a test is not where it
    // gets ratified.
    const ids = products.map((product) => product.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Every product still reachable by browsing: the categories partition the
    // catalogue, so summing them must return the whole of it.
    const filed = categories.flatMap((category) =>
      products.filter((product) => product.categoryId === category.id).map((p) => p.id),
    );
    expect([...filed].sort()).toEqual([...ids].sort());
  });
});
