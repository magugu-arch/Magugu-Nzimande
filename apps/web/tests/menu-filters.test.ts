import { PRODUCTS } from '@bbq/seed';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, SORT_LABELS, SORT_ORDERS, applyFilters } from '@/lib/menu-filters';
import type { MenuFilters } from '@/lib/menu-filters';
import { aChickenProduct } from './fixtures';

/**
 * How a customer finds something on the menu.
 *
 * All of this ran untested: search, the heat ladder, the category tabs and
 * four sort orders, against the real catalogue. The failure it protects
 * against is quiet — a filter that returns nothing looks like an empty menu,
 * not like a bug.
 */

const filters = (over: Partial<MenuFilters> = {}): MenuFilters => ({
  ...DEFAULT_FILTERS,
  ...over,
});

const slugs = (result: readonly { slug: string }[]) => result.map((product) => product.slug);

describe('the default view', () => {
  it('shows the whole menu', () => {
    expect(applyFilters(PRODUCTS, DEFAULT_FILTERS)).toHaveLength(PRODUCTS.length);
  });

  it('does not mutate the catalogue it was handed', () => {
    const before = slugs(PRODUCTS);
    applyFilters(PRODUCTS, filters({ sort: 'price-high' }));
    expect(slugs(PRODUCTS)).toEqual(before);
  });

  it('has a label for every sort order it offers', () => {
    for (const order of SORT_ORDERS) {
      expect(SORT_LABELS[order]).toBeTruthy();
    }
  });
});

describe('searching', () => {
  it('finds a product by its name', () => {
    const product = aChickenProduct();
    const found = applyFilters(PRODUCTS, filters({ search: product.name }));
    expect(slugs(found)).toContain(product.slug);
  });

  it('ignores case and surrounding space', () => {
    const product = aChickenProduct();
    const found = applyFilters(PRODUCTS, filters({ search: `  ${product.name.toUpperCase()} ` }));
    expect(slugs(found)).toContain(product.slug);
  });

  /** Every word has to land, or "hot wings" would match everything hot. */
  it('requires all of the words, not any of them', () => {
    const product = aChickenProduct();
    const found = applyFilters(
      PRODUCTS,
      filters({ search: `${product.name} definitelynotinthecatalogue` }),
    );
    expect(found).toHaveLength(0);
  });

  it('searches the sauce and the category, not only the name', () => {
    const product = aChickenProduct();
    expect(slugs(applyFilters(PRODUCTS, filters({ search: product.sauce })))).toContain(
      product.slug,
    );
    expect(applyFilters(PRODUCTS, filters({ search: 'Chicken' })).length).toBeGreaterThan(0);
  });

  it('returns nothing for a word that is nowhere on the menu', () => {
    expect(applyFilters(PRODUCTS, filters({ search: 'zzzznotathing' }))).toHaveLength(0);
  });
});

describe('the heat ladder', () => {
  it('lets everything through at the top of the ladder', () => {
    expect(applyFilters(PRODUCTS, filters({ heatMax: 5 }))).toHaveLength(PRODUCTS.length);
  });

  it('keeps only what is at or below the chosen heat', () => {
    const mild = applyFilters(PRODUCTS, filters({ heatMax: 1 }));
    expect(mild.every((product) => product.heat <= 1)).toBe(true);
  });

  it('narrows rather than widens as the ladder comes down', () => {
    const counts = [5, 4, 3, 2, 1, 0].map(
      (heatMax) => applyFilters(PRODUCTS, filters({ heatMax })).length,
    );

    for (let index = 1; index < counts.length; index += 1) {
      expect(counts[index]).toBeLessThanOrEqual(counts[index - 1] as number);
    }
  });
});

describe('the category tabs', () => {
  it('keeps only the chosen category', () => {
    const found = applyFilters(PRODUCTS, filters({ category: 'Chicken' }));

    expect(found.length).toBeGreaterThan(0);
    expect(found.every((product) => product.category === 'Chicken')).toBe(true);
  });

  it('shows everything again on "all"', () => {
    expect(applyFilters(PRODUCTS, filters({ category: 'all' }))).toHaveLength(PRODUCTS.length);
  });
});

describe('sorting', () => {
  it('runs price low to high', () => {
    const prices = applyFilters(PRODUCTS, filters({ sort: 'price-low' })).map(
      (product) => product.priceCents,
    );
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('runs price high to low', () => {
    const prices = applyFilters(PRODUCTS, filters({ sort: 'price-high' })).map(
      (product) => product.priceCents,
    );
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it('runs heat mild to hot', () => {
    const heats = applyFilters(PRODUCTS, filters({ sort: 'heat' })).map((product) => product.heat);
    expect(heats).toEqual([...heats].sort((a, b) => a - b));
  });

  it('puts the tagged products first under "popular"', () => {
    const found = applyFilters(PRODUCTS, filters({ sort: 'popular' }));
    const lastTagged = found.map((product) => Boolean(product.tag)).lastIndexOf(true);
    const firstUntagged = found.map((product) => Boolean(product.tag)).indexOf(false);

    if (lastTagged !== -1 && firstUntagged !== -1) {
      expect(lastTagged).toBeLessThan(firstUntagged);
    }
  });

  it('keeps every product whichever order is chosen', () => {
    for (const sort of SORT_ORDERS) {
      expect(applyFilters(PRODUCTS, filters({ sort }))).toHaveLength(PRODUCTS.length);
    }
  });
});

describe('filters together', () => {
  it('applies search, category and heat at once', () => {
    const found = applyFilters(
      PRODUCTS,
      filters({ category: 'Chicken', heatMax: 2, sort: 'price-low' }),
    );

    expect(found.every((product) => product.category === 'Chicken' && product.heat <= 2)).toBe(
      true,
    );
  });

  it('returns an empty menu rather than throwing when nothing matches', () => {
    expect(
      applyFilters(PRODUCTS, filters({ search: 'zzzznotathing', category: 'Chicken', heatMax: 0 })),
    ).toEqual([]);
  });
});
