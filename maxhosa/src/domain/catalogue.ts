import type { ShopFilters } from '@/store/shop';
import { toMinor } from './money';
import type { Category, PriceBand, Product, StockStatus } from './types';

export type AvailabilitySummary = { tone: 'ok' | 'warn' | 'bad'; label: string };

/** One honest line about stock, built only from the product's own variants. */
export function availabilitySummary(product: Product): AvailabilitySummary {
  const has = (s: StockStatus) => product.variants.some((v) => v.stock === s);
  if (has('available') && !has('unavailable') && !has('preorder'))
    return { tone: 'ok', label: 'Available' };
  if (has('available')) return { tone: 'ok', label: 'Available in some sizes' };
  if (has('preorder')) return { tone: 'warn', label: 'Pre-order' };
  return { tone: 'bad', label: 'Unavailable' };
}

function score(product: Product, query: string, categories: Category[]): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  const category = categories.find((c) => c.id === product.category)?.label ?? '';
  const haystack = [product.name, product.code, category, product.colours.join(' ')]
    .join(' ')
    .toLowerCase();
  let total = 0;
  for (const t of terms) {
    if (!haystack.includes(t)) return 0;
    total += product.name.toLowerCase().includes(t) ? 3 : 1;
  }
  return total;
}

/** Search, facets and sort. Every facet here is one the sample data really has. */
export function filterProducts(
  products: Product[],
  f: ShopFilters,
  categories: Category[],
  bands: PriceBand[] = [],
): Product[] {
  const band = bands.find((b) => b.id === f.band);
  const scored = products
    .map((p) => ({ p, s: score(p, f.query, categories) }))
    .filter(({ p, s }) => {
      if (!s) return false;
      if (f.category !== 'all' && p.category !== f.category) return false;
      if (
        f.sizes.length &&
        !p.variants.some((v) => f.sizes.includes(v.size) && v.stock !== 'unavailable')
      )
        return false;
      if (f.colours.length && !p.colours.some((c) => f.colours.includes(c))) return false;
      if (f.availability === 'available' && !p.variants.some((v) => v.stock === 'available'))
        return false;
      if (f.availability === 'preorder' && !p.variants.some((v) => v.stock === 'preorder'))
        return false;
      if (band) {
        const minor = toMinor(p.price);
        if (minor < band.minMinor || (band.maxMinor !== null && minor >= band.maxMinor))
          return false;
      }
      return true;
    });
  scored.sort((a, b) => {
    switch (f.sort) {
      case 'price-asc':
        return toMinor(a.p.price) - toMinor(b.p.price);
      case 'price-desc':
        return toMinor(b.p.price) - toMinor(a.p.price);
      case 'relevance':
        if (f.query.trim()) return b.s - a.s;
        return b.p.releasedAt.localeCompare(a.p.releasedAt);
      default:
        return b.p.releasedAt.localeCompare(a.p.releasedAt);
    }
  });
  return scored.map((x) => x.p);
}

export function activeFilterCount(f: ShopFilters): number {
  return (
    f.sizes.length +
    f.colours.length +
    (f.availability !== 'any' ? 1 : 0) +
    (f.band !== 'any' ? 1 : 0)
  );
}
