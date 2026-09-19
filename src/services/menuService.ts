import { config } from '@/constants/config';
import type { Category, MenuSnapshot, Product } from '@/types';
import { delay, request } from './apiClient';
import { menuSnapshot } from './data/menuData';
import { checkedMenu, checkedProduct } from './wireChecks';
import { matchProducts } from '@/features/menu/search';

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
  if (query.trim().length === 0) return [];

  // Matching lives in `matchProducts` — a substring test over one joined string
  // was hiding half the menu from the spellings people actually type.
  const menu = await fetchMenu();
  return matchProducts(menu.products, query);
}

/**
 * Search suggestions — things that are actually on this menu.
 *
 * These read "Honey Garlic, Wings, Boneless, Cheesling Fries, Spicy, Rice
 * bowl" until now: the chicken-shop vocabulary of the app Pappas was built
 * from, offered as suggestions on a Greek and Mediterranean menu where not
 * one of the six returns a single dish. A suggestion chip that finds nothing
 * is worse than no chip — it teaches a customer that search is broken on
 * their first use of it.
 *
 * Every term below matches something in `menuData`, which the accompanying
 * test enforces rather than trusts. `menuSearch` covers name, description,
 * tags and category name, so a category term such as "Mezedakia" returns the
 * whole section and a dish term returns the dish.
 *
 * Not called "popular", and the heading above them does not say it either.
 * Nobody has supplied what sells; §15 forbids inventing it, and "popular" is
 * exactly the kind of quiet claim that gets invented because it sounds like
 * chrome rather than like a business fact.
 */
export const POPULAR_SEARCH_TERMS = [
  'Mezedakia',
  'Souvlaki',
  'Calamari',
  'Lamb',
  'Halloumi',
  'Baklava',
] as const;
