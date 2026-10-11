import { create } from 'zustand';
import type { CategoryId } from '@/domain/types';

export type SortId = 'new' | 'price-asc' | 'price-desc' | 'relevance';
export type Availability = 'any' | 'available' | 'preorder';

export const SORT_LABEL: Record<SortId, string> = {
  new: 'New arrivals',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  relevance: 'Best match',
};

export type ShopFilters = {
  query: string;
  category: CategoryId | 'all';
  sizes: string[];
  colours: string[];
  availability: Availability;
  sort: SortId;
};

export const DEFAULT_FILTERS: ShopFilters = {
  query: '',
  category: 'all',
  sizes: [],
  colours: [],
  availability: 'any',
  sort: 'new',
};

/**
 * Shop filters live outside the screen, so opening a product and coming back
 * finds them exactly as they were. Not persisted across launches on purpose.
 */
export const useShopFilters = create<{
  filters: ShopFilters;
  set: (patch: Partial<ShopFilters>) => void;
  reset: () => void;
}>((set) => ({
  filters: DEFAULT_FILTERS,
  set: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  reset: () => set({ filters: DEFAULT_FILTERS }),
}));
