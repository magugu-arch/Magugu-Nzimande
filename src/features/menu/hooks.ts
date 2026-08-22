import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/services/queryKeys';
import {
  fetchBestSellers,
  fetchCategories,
  fetchMenu,
  fetchNewProducts,
  fetchPopular,
  fetchProduct,
  fetchProductsByCategory,
  fetchProductsByIds,
  searchProducts,
} from '@/services/menuService';

/** The menu changes rarely — cache it hard so navigation feels instant. */
const MENU_STALE_TIME = 5 * 60 * 1000;

export function useMenu() {
  return useQuery({ queryKey: queryKeys.menu, queryFn: fetchMenu, staleTime: MENU_STALE_TIME });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
    staleTime: MENU_STALE_TIME,
  });
}

export function useCategoryProducts(categoryId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.category(categoryId ?? ''),
    queryFn: () => fetchProductsByCategory(categoryId as string),
    enabled: Boolean(categoryId),
    staleTime: MENU_STALE_TIME,
  });
}

export function useProduct(productId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.product(productId ?? ''),
    queryFn: () => fetchProduct(productId as string),
    enabled: Boolean(productId),
    staleTime: MENU_STALE_TIME,
  });
}

export function useProductsByIds(ids: string[]) {
  return useQuery({
    queryKey: queryKeys.products(ids),
    queryFn: () => fetchProductsByIds(ids),
    enabled: ids.length > 0,
    staleTime: MENU_STALE_TIME,
  });
}

export function useBestSellers(limit?: number) {
  return useQuery({
    queryKey: queryKeys.bestSellers,
    queryFn: () => fetchBestSellers(limit),
    staleTime: MENU_STALE_TIME,
  });
}

export function usePopularProducts(limit?: number) {
  return useQuery({
    queryKey: queryKeys.popular,
    queryFn: () => fetchPopular(limit),
    staleTime: MENU_STALE_TIME,
  });
}

export function useNewProducts(limit?: number) {
  return useQuery({
    queryKey: queryKeys.newProducts,
    queryFn: () => fetchNewProducts(limit),
    staleTime: MENU_STALE_TIME,
  });
}

export function useProductSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.search(trimmed.toLowerCase()),
    queryFn: () => searchProducts(trimmed),
    // Single characters match almost everything — wait for a real query.
    enabled: trimmed.length >= 2,
    staleTime: 60 * 1000,
  });
}
