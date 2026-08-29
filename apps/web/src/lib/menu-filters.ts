import type { CategoryKey, Product } from '@bbq/types';

export const SORT_ORDERS = ['popular', 'price-low', 'price-high', 'heat'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const SORT_LABELS: Record<SortOrder, string> = {
  popular: 'Most popular',
  'price-low': 'Price, low to high',
  'price-high': 'Price, high to low',
  heat: 'Heat, mild to hot',
};

export type MenuFilters = {
  search: string;
  category: CategoryKey | 'all';
  /** Upper bound on the heat ladder. 5 lets everything through. */
  heatMax: number;
  sort: SortOrder;
};

export const DEFAULT_FILTERS: MenuFilters = {
  search: '',
  category: 'all',
  heatMax: 5,
  sort: 'popular',
};

/**
 * Matches the words a customer actually types, not just the product name: the
 * sauce and the category are searchable too, so "spicy" and "wings" both land.
 */
function matchesSearch(product: Product, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [product.name, product.sauce, product.category, product.description]
    .join(' ')
    .toLowerCase();
  return needle
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

export function applyFilters(
  products: readonly Product[],
  filters: MenuFilters,
): Product[] {
  const filtered = products.filter(
    (product) =>
      matchesSearch(product, filters.search) &&
      (filters.category === 'all' || product.category === filters.category) &&
      product.heat <= filters.heatMax,
  );

  const sorted = [...filtered];
  switch (filters.sort) {
    case 'price-low':
      sorted.sort((a, b) => a.priceCents - b.priceCents);
      break;
    case 'price-high':
      sorted.sort((a, b) => b.priceCents - a.priceCents);
      break;
    case 'heat':
      sorted.sort((a, b) => a.heat - b.heat);
      break;
    case 'popular':
      // Tagged products first, then catalogue order, which is the order the
      // kitchen lists them in.
      sorted.sort((a, b) => Number(Boolean(b.tag)) - Number(Boolean(a.tag)));
      break;
  }
  return sorted;
}
