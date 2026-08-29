'use client';

import type { Category, CategoryKey, Product } from '@bbq/types';
import { useMemo, useState } from 'react';
import { ProductCard } from '@/components/menu/ProductCard';
import { Button } from '@/components/ui/Button';
import {
  applyFilters,
  DEFAULT_FILTERS,
  SORT_LABELS,
  SORT_ORDERS,
  type MenuFilters,
} from '@/lib/menu-filters';

export function MenuBrowser({
  products,
  categories,
  initialCategory,
}: {
  products: readonly Product[];
  categories: readonly Category[];
  initialCategory: CategoryKey | 'all';
}) {
  const [filters, setFilters] = useState<MenuFilters>({
    ...DEFAULT_FILTERS,
    category: initialCategory,
  });

  const results = useMemo(() => applyFilters(products, filters), [products, filters]);
  const update = (patch: Partial<MenuFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  const activeCategory = categories.find((category) => category.key === filters.category);

  return (
    <div className="mx-auto w-full max-w-[1240px] gap-10 px-5 py-10 lg:grid lg:grid-cols-[210px_1fr]">
      <aside className="hidden lg:block">
        <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Categories</h2>
        <ul className="mt-3 space-y-1">
          {[{ key: 'all' as const, label: 'Everything' }, ...categories].map((category) => (
            <li key={category.key}>
              <button
                type="button"
                onClick={() => update({ category: category.key })}
                aria-pressed={filters.category === category.key}
                className={[
                  'w-full rounded-sm px-3 py-2 text-left text-sm font-bold transition-colors',
                  filters.category === category.key
                    ? 'bg-red text-white'
                    : 'text-black hover:bg-paper',
                ].join(' ')}
              >
                {category.label}
              </button>
            </li>
          ))}
        </ul>

        <h2 className="mt-7 text-xs font-bold uppercase tracking-[0.1em] text-muted">
          Maximum heat
        </h2>
        <label className="mt-3 block">
          <span className="sr-only">Maximum heat, 0 to 5</span>
          <input
            type="range"
            min={0}
            max={5}
            step={1}
            value={filters.heatMax}
            onChange={(event) => update({ heatMax: Number(event.target.value) })}
            className="w-full accent-red"
          />
        </label>
        <p className="mt-1 text-xs text-muted" aria-live="polite">
          {filters.heatMax === 5 ? 'Everything, up to hot' : `Up to heat ${filters.heatMax}`}
        </p>
      </aside>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-52 flex-1">
            <span className="sr-only">Search the menu</span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) => update({ search: event.target.value })}
              placeholder="Search chicken, wings, sauces"
              className="h-11 w-full rounded-full border border-line bg-white px-4 text-sm placeholder:text-muted"
            />
          </label>

          <label className="flex items-center gap-2">
            <span className="sr-only">Sort by</span>
            <select
              value={filters.sort}
              onChange={(event) => update({ sort: event.target.value as MenuFilters['sort'] })}
              className="h-11 cursor-pointer rounded-full border border-line bg-white px-4 text-sm font-semibold"
            >
              {SORT_ORDERS.map((order) => (
                <option key={order} value={order}>
                  {SORT_LABELS[order]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {[{ key: 'all' as const, label: 'Everything' }, ...categories].map((category) => (
            <li key={category.key}>
              <button
                type="button"
                onClick={() => update({ category: category.key })}
                aria-pressed={filters.category === category.key}
                className={[
                  'whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-bold transition-colors',
                  filters.category === category.key
                    ? 'border-red bg-red text-white'
                    : 'border-line bg-white',
                ].join(' ')}
              >
                {category.label}
              </button>
            </li>
          ))}
        </ul>

        {activeCategory && (
          <p className="mt-5 max-w-[62ch] text-sm text-muted">{activeCategory.note}</p>
        )}

        <p className="mt-5 text-xs font-semibold text-muted" aria-live="polite">
          {results.length} {results.length === 1 ? 'item' : 'items'}
        </p>

        {results.length === 0 ? (
          <div className="mt-8 rounded-md border border-line bg-white p-10 text-center">
            <p className="display text-2xl text-black-60">Nothing matches that</p>
            <p className="mt-2 text-sm text-muted">
              Try a different word, or widen the heat filter.
            </p>
            <div className="mt-5">
              <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear filters
              </Button>
            </div>
          </div>
        ) : (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((product, index) => (
              <li key={product.slug}>
                <ProductCard
                  product={product}
                  priority={index < 3}
                  sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 88vw"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
