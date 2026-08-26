import { config } from '@/constants/config';
import type { Category, MenuSnapshot, Product } from '@/types';
import { delay, request } from './apiClient';
import { menuSnapshot } from './data/menuData';
import { checkedMenu, checkedProduct } from './wireChecks';

/**
 * Menu service. Screens never touch `menuData` directly — they call these
 * functions, so the switch from mock to live API is invisible upstream.
 */

export async function fetchMenu(): Promise<MenuSnapshot> {
  if (config.useMockApi) return delay(menuSnapshot);
  return request<MenuSnapshot>('/v1/menu', { parse: checkedMenu });
}

export async function fetchCategories(): Promise<Category[]> {
  const menu = await fetchMenu();
  return [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function fetchProductsByCategory(categoryId: string): Promise<Product[]> {
  const menu = await fetchMenu();
  return menu.products.filter((product) => product.categoryId === categoryId);
}

export async function fetchProduct(productId: string): Promise<Product> {
  if (config.useMockApi) {
    const product = menuSnapshot.products.find(
      (candidate) => candidate.id === productId || candidate.slug === productId,
    );
    if (!product) {
      throw Object.assign(new Error('That item is no longer on the menu.'), {
        code: 'not_found',
      });
    }
    return delay(product, 180);
  }
  return request<Product>(`/v1/menu/products/${encodeURIComponent(productId)}`, {
    parse: checkedProduct,
  });
}

export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  const menu = await fetchMenu();
  // Preserve the caller's ordering — "recommended" lists are deliberately ranked.
  return ids
    .map((id) => menu.products.find((product) => product.id === id))
    .filter((product): product is Product => product !== undefined);
}

export async function fetchBestSellers(limit = 6): Promise<Product[]> {
  const menu = await fetchMenu();
  return menu.products.filter((product) => product.tags.includes('bestseller')).slice(0, limit);
}

export async function fetchPopular(limit = 8): Promise<Product[]> {
  const menu = await fetchMenu();
  return menu.products
    .filter((product) => product.tags.includes('popular') || product.tags.includes('bestseller'))
    .slice(0, limit);
}

export async function fetchNewProducts(limit = 4): Promise<Product[]> {
  const menu = await fetchMenu();
  return menu.products.filter((product) => product.tags.includes('new')).slice(0, limit);
}

/** Case-insensitive search across name, description and tags. */
export async function searchProducts(query: string): Promise<Product[]> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return [];

  const menu = await fetchMenu();
  return menu.products.filter((product) => {
    const haystack = [product.name, product.shortDescription, product.description, ...product.tags]
      .join(' ')
      .toLowerCase();
    return haystack.includes(trimmed);
  });
}

export const POPULAR_SEARCH_TERMS = [
  'Honey Garlic',
  'Wings',
  'Boneless',
  'Cheesling Fries',
  'Spicy',
  'Rice bowl',
] as const;
