import { CATEGORIES, FAQS, PROMOTIONS, REWARDS, REWARDS_RULES, SAUCES } from '@bbq/seed';
import type {
  Category,
  Faq,
  Product,
  ProductWithOptions,
  Promotion,
  Reward,
  Sauce,
  Store,
} from '@bbq/types';
import { currentStores, findProduct, visibleProducts } from './catalogue-state';

/**
 * Whether a store can actually take a delivery order.
 *
 * Two conditions, and the second was missing. A store with delivery switched on
 * and no suburbs on its list was offered as a delivery option and then refused
 * every address given to it — the customer choosing it, typing their street and
 * being told nobody delivers there, with no way to tell that the store was the
 * problem rather than the address.
 *
 * Not reachable from the seed today, because both branches have suburbs, and
 * exactly what a store looks like the week before its zone list arrives.
 *
 * Its own function rather than a longer filter so a test can hand it the store
 * the seed cannot supply.
 */
export const deliversSomewhere = (store: Store): boolean =>
  store.services.Delivery && store.zones.length > 0;

/**
 * The service layer, server side. One function per documented endpoint, so
 * pointing a screen at a real API means changing a body here and nothing else.
 * No screen reads the seed modules directly.
 *
 * Client components use lib/client-api.ts, which calls the same endpoints over
 * HTTP and parses what comes back. This module is for server components and
 * route handlers, where an HTTP round trip to our own process would be waste.
 */

export const api = {
  /** GET /api/products */
  getProducts(): Product[] {
    return visibleProducts();
  },

  /** GET /api/products/:slug */
  getProduct(slug: string): ProductWithOptions | null {
    return findProduct(slug);
  },

  /** GET /api/stores */
  getStores(): Store[] {
    return currentStores();
  },

  /** GET /api/promotions */
  getPromotions(): readonly Promotion[] {
    return PROMOTIONS;
  },

  /** GET /api/rewards/catalog */
  getRewards(): { rewards: readonly Reward[]; rules: typeof REWARDS_RULES } {
    return { rewards: REWARDS, rules: REWARDS_RULES };
  },

  /** GET /api/delivery/zones */
  getDeliveryZones(): { storeId: string; storeName: string; suburbs: readonly string[] }[] {
    return currentStores()
      .filter(deliversSomewhere)
      .map((store) => ({ storeId: store.id, storeName: store.name, suburbs: store.zones }));
  },

  /** Reference content, served with the catalogue rather than fetched separately. */
  getCategories(): readonly Category[] {
    return CATEGORIES;
  },

  getSauces(): readonly Sauce[] {
    return SAUCES;
  },

  getFaqs(): readonly Faq[] {
    return FAQS;
  },
};
