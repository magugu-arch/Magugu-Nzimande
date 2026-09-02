import { PROMOTIONS, REWARDS } from '@bbq/seed';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST as quoteRoute } from '@/app/api/delivery/quote/route';
import { GET as zonesRoute } from '@/app/api/delivery/zones/route';
import { GET as productRoute } from '@/app/api/products/[slug]/route';
import { GET as productsRoute } from '@/app/api/products/route';
import { GET as promotionsRoute } from '@/app/api/promotions/route';
import { GET as rewardsRoute } from '@/app/api/rewards/catalog/route';
import { GET as storesRoute } from '@/app/api/stores/route';
import { setHidden, setService, setSoldOut } from '@/lib/catalogue-state';
import type { Product, Store } from '@bbq/types';
import {
  aChickenProduct,
  aDeliveryStore,
  bodyOf,
  params,
  request,
  resetState,
} from './fixtures';

/**
 * The read side of the API, through the route handlers.
 *
 * Sold out and hidden are different states and the difference is the whole
 * point of these: a sold-out item is *returned and flagged* so the menu can
 * grey it out, a hidden one is absent entirely. Getting that backwards shows a
 * customer an item that cannot be bought, or hides one that can.
 */

const product = aChickenProduct();

beforeEach(resetState);

describe('GET /api/products', () => {
  it('serves the catalogue', async () => {
    const { products } = await bodyOf<{ products: Product[] }>(await productsRoute());
    expect(products.length).toBeGreaterThan(0);
  });

  it('returns a sold-out product, flagged, so the menu can say so', async () => {
    setSoldOut(product.slug, true);
    const { products } = await bodyOf<{ products: Product[] }>(await productsRoute());

    const found = products.find((candidate) => candidate.slug === product.slug);
    expect(found?.soldOut).toBe(true);
  });

  it('leaves a hidden product out altogether', async () => {
    setHidden(product.slug, true);
    const { products } = await bodyOf<{ products: Product[] }>(await productsRoute());

    expect(products.some((candidate) => candidate.slug === product.slug)).toBe(false);
  });

  it('flags nothing as sold out on a fresh deployment', async () => {
    const { products } = await bodyOf<{ products: Product[] }>(await productsRoute());
    expect(products.every((candidate) => candidate.soldOut === false)).toBe(true);
  });
});

describe('GET /api/products/:slug', () => {
  it('serves one product with the options a customer has to choose', async () => {
    const response = await productRoute(
      request(`/api/products/${product.slug}`),
      params({ slug: product.slug }),
    );

    expect(response.status).toBe(200);
    const { product: served } = await bodyOf<{ product: { optionGroups: unknown[] } }>(response);
    expect(served.optionGroups.length).toBeGreaterThan(0);
  });

  it('is a 404 for a slug that was never on the menu', async () => {
    const response = await productRoute(
      request('/api/products/gold-plated-bird'),
      params({ slug: 'gold-plated-bird' }),
    );
    expect(response.status).toBe(404);
  });

  it('is a 404 for a hidden product, not a 200 with a hidden flag', async () => {
    setHidden(product.slug, true);
    const response = await productRoute(
      request(`/api/products/${product.slug}`),
      params({ slug: product.slug }),
    );

    // A deep link to a withdrawn item has to fail, or it is orderable by URL.
    expect(response.status).toBe(404);
  });

  it('still serves a sold-out product, because the page has to explain why', async () => {
    setSoldOut(product.slug, true);
    const response = await productRoute(
      request(`/api/products/${product.slug}`),
      params({ slug: product.slug }),
    );

    expect(response.status).toBe(200);
  });
});

describe('GET /api/stores', () => {
  it('serves the stores with their hours and zones', async () => {
    const { stores } = await bodyOf<{ stores: Store[] }>(await storesRoute());

    expect(stores.length).toBeGreaterThan(0);
    expect(stores.every((store) => Array.isArray(store.zones))).toBe(true);
  });

  it('reflects a service the console has switched off', async () => {
    const store = aDeliveryStore();
    setService(store.id, 'Delivery', false);

    const { stores } = await bodyOf<{ stores: Store[] }>(await storesRoute());
    expect(stores.find((candidate) => candidate.id === store.id)?.services.Delivery).toBe(false);
  });
});

describe('GET /api/delivery/zones', () => {
  it('lists the suburbs each delivering store covers', async () => {
    const { zones } = await bodyOf<{ zones: { storeId: string; suburbs: string[] }[] }>(
      await zonesRoute(),
    );

    expect(zones.length).toBeGreaterThan(0);
    expect(zones.every((zone) => zone.suburbs.length > 0)).toBe(true);
  });

  /** A store not delivering today should not be advertising a delivery area. */
  it('drops a store whose delivery the console has switched off', async () => {
    const store = aDeliveryStore();
    setService(store.id, 'Delivery', false);

    const { zones } = await bodyOf<{ zones: { storeId: string }[] }>(await zonesRoute());
    expect(zones.some((zone) => zone.storeId === store.id)).toBe(false);
  });
});

describe('POST /api/delivery/quote', () => {
  const store = aDeliveryStore();
  const covered = store.zones[0] as string;

  const quote = (body: unknown) => quoteRoute(request('/api/delivery/quote', { body }));

  type Quote = {
    serviceable: boolean;
    feeCents?: number;
    etaMinutes?: number;
    reason?: string;
    storeId?: string;
  };

  it('quotes a covered suburb', async () => {
    const { quote: result } = await bodyOf<{ quote: Quote }>(
      await quote({ suburb: covered, subtotalCents: 15_000 }),
    );

    expect(result.serviceable).toBe(true);
    expect(result.etaMinutes).toBeGreaterThan(0);
    expect(Number.isInteger(result.feeCents)).toBe(true);
  });

  it('refuses a suburb nobody covers, and says why rather than erroring', async () => {
    const response = await quote({ suburb: 'Nowhere Bay', subtotalCents: 15_000 });
    const { quote: result } = await bodyOf<{ quote: Quote }>(response);

    expect(response.status).toBe(200);
    expect(result.serviceable).toBe(false);
    expect(result.reason).toMatch(/do not deliver/i);
  });

  it('matches a suburb however it was typed', async () => {
    const { quote: result } = await bodyOf<{ quote: Quote }>(
      await quote({ suburb: `  ${covered.toUpperCase()}  `, subtotalCents: 15_000 }),
    );
    expect(result.serviceable).toBe(true);
  });

  it('stops charging delivery once the basket clears the threshold', async () => {
    const { quote: small } = await bodyOf<{ quote: Quote }>(
      await quote({ suburb: covered, subtotalCents: 1_000 }),
    );
    const { quote: large } = await bodyOf<{ quote: Quote }>(
      await quote({ suburb: covered, subtotalCents: 10_000_000 }),
    );

    expect(small.feeCents).toBeGreaterThan(0);
    expect(large.feeCents).toBe(0);
  });

  it('will not quote for a store that has stopped delivering', async () => {
    setService(store.id, 'Delivery', false);
    const { quote: result } = await bodyOf<{ quote: Quote }>(
      await quote({ suburb: covered, subtotalCents: 15_000 }),
    );

    expect(result.serviceable).toBe(false);
  });

  it('refuses a request that is not a quote request', async () => {
    expect((await quote({ suburb: '' })).status).toBe(400);
    expect((await quote(null)).status).toBe(400);
  });
});

describe('the endpoints that only serve seed data', () => {
  it('serves the promotions', async () => {
    const { promotions } = await bodyOf<{ promotions: unknown[] }>(await promotionsRoute());
    expect(promotions).toHaveLength(PROMOTIONS.length);
  });

  it('serves the rewards catalogue with the rules that govern it', async () => {
    const body = await bodyOf<{ rewards: unknown[]; rules: unknown }>(await rewardsRoute());
    expect(body.rewards).toHaveLength(REWARDS.length);
    expect(body.rules).toBeTruthy();
  });
});
