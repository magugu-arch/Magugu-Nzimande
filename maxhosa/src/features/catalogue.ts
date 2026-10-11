import { useMemo } from 'react';
import { providers } from '@/providers';
import { usePrefs } from '@/store/prefs';
import { formatMoney } from '@/domain/money';
import type { Market, Money } from '@/domain/types';
import { useAsync } from './async';
import catalogue from '@data/sample-catalogue.json';

const { commerce } = providers;

export function useMarket(): Market {
  const id = usePrefs((s) => s.market);
  return useMemo(() => catalogue.markets.find((m) => m.id === id) ?? catalogue.markets[0]!, [id]);
}

export function useFormatMoney(): (money: Money) => string {
  const market = useMarket();
  return (money) => formatMoney(money, market);
}

export function useProducts() {
  const market = usePrefs((s) => s.market);
  return useAsync(() => commerce.listProducts(market), [market]);
}

export function useProduct(id: string) {
  const market = usePrefs((s) => s.market);
  return useAsync(() => commerce.getProduct(id, market), [id, market]);
}

export function useCategories() {
  return useAsync(() => commerce.listCategories(), []);
}

export function useStories() {
  return useAsync(() => commerce.listStories(), []);
}

export function useOrders(refreshKey = 0) {
  return useAsync(() => commerce.listOrders(), [refreshKey]);
}
