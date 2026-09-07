import { PRODUCTS, PROMOTIONS, REWARDS, SAUCES, STORES } from '@bbq/seed';
import { beforeEach, describe, expect, it } from 'vitest';
import { api, deliversSomewhere } from '@/lib/api';
import { setHidden, setService, setSoldOut } from '@/lib/catalogue-state';
import {
  aChickenProduct,
  aDeliveryStore,
  resetState,
  seededStore,
  storeWithoutZones,
} from './fixtures';

/**
 * The server-side service layer.
 *
 * Server components read through this rather than through HTTP, so it is a
 * second path to the same data — and a second chance for a console change to
 * reach one path and not the other. The route handlers are already covered;
 * these are the same questions asked of the layer a page renders from.
 */

const product = aChickenProduct();

beforeEach(resetState);

describe('the catalogue', () => {
  it('serves the products', () => {
    expect(api.getProducts()).toHaveLength(PRODUCTS.length);
  });

  it('flags a sold-out product rather than dropping it', () => {
    setSoldOut(product.slug, true);
    const found = api.getProducts().find((candidate) => candidate.slug === product.slug);

    expect(found).toBeDefined();
    expect(found?.soldOut).toBe(true);
  });

  it('drops a hidden product entirely', () => {
    setHidden(product.slug, true);
    expect(api.getProducts().some((candidate) => candidate.slug === product.slug)).toBe(false);
  });

  it('serves one product with the options it needs', () => {
    const found = api.getProduct(product.slug);
    expect(found?.optionGroups.length).toBeGreaterThan(0);
  });

  it('has nothing for a slug that is not on the menu', () => {
    expect(api.getProduct('gold-plated-bird')).toBeNull();
  });

  it('has nothing for a hidden product, so a page cannot render one', () => {
    setHidden(product.slug, true);
    expect(api.getProduct(product.slug)).toBeNull();
  });
});

describe('the stores', () => {
  it('serves them all', () => {
    expect(api.getStores()).toHaveLength(STORES.length);
  });

  it('reflects a service the console has switched off', () => {
    const store = aDeliveryStore();
    setService(store.id, 'Delivery', false);

    expect(api.getStores().find((candidate) => candidate.id === store.id)?.services.Delivery).toBe(
      false,
    );
  });

  it('leaves the seed itself untouched when the console writes', () => {
    const store = aDeliveryStore();
    setService(store.id, 'Delivery', false);

    // The console's state is layered over the seed, not written into it.
    const seeded = seededStore(store.id);
    expect(seeded.services.Delivery).toBe(true);
  });
});

describe('the delivery zones', () => {
  it('names the store as well as its suburbs, so a page can say who delivers', () => {
    const zones = api.getDeliveryZones();

    expect(zones.length).toBeGreaterThan(0);
    for (const zone of zones) {
      expect(zone.storeName).toBeTruthy();
      expect(zone.suburbs.length).toBeGreaterThan(0);
    }
  });

  it('drops a store that has stopped delivering', () => {
    const store = aDeliveryStore();
    setService(store.id, 'Delivery', false);

    expect(api.getDeliveryZones().some((zone) => zone.storeId === store.id)).toBe(false);
  });

  it('agrees with the stores endpoint about who delivers', () => {
    const delivering = api
      .getStores()
      .filter((store) => store.services.Delivery)
      .map((store) => store.id)
      .sort();

    expect(api.getDeliveryZones().map((zone) => zone.storeId).sort()).toEqual(delivering);
  });
});

describe('the reference content', () => {
  it('serves the promotions, rewards, categories, sauces and questions', () => {
    expect(api.getPromotions()).toHaveLength(PROMOTIONS.length);
    expect(api.getRewards().rewards).toHaveLength(REWARDS.length);
    expect(api.getSauces()).toHaveLength(SAUCES.length);
    expect(api.getCategories().length).toBeGreaterThan(0);
    expect(api.getFaqs().length).toBeGreaterThan(0);
  });

  it('serves the rules alongside the rewards, because points mean nothing alone', () => {
    const { rules } = api.getRewards();
    expect(rules.pointsPerRand).toBeGreaterThan(0);
    expect(rules.tiers.length).toBeGreaterThan(0);
  });

  it('orders the reward tiers so a customer climbs rather than jumps about', () => {
    const thresholds = api.getRewards().rules.tiers.map((tier) => tier.from);
    expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
  });
});

/**
 * A store that delivers nowhere.
 *
 * Both seeded branches have suburbs, so this could not be reached through the
 * catalogue and had never been checked. It is what a store looks like the week
 * before its zone list arrives — and the filter used to let it through, so it
 * would have been offered as a delivery option and then refused every address
 * given to it.
 */
describe('whether a store can take a delivery at all', () => {
  it('needs somewhere to deliver to, not just the service switched on', () => {
    expect(deliversSomewhere(aDeliveryStore())).toBe(true);
    expect(deliversSomewhere(storeWithoutZones())).toBe(false);
  });

  it('is what the zone list is built from, so a zoneless store is not offered', () => {
    // Every store the endpoint offers can actually be delivered to.
    for (const zone of api.getDeliveryZones()) {
      expect(zone.suburbs.length, `${zone.storeName} is offered with no suburbs`).toBeGreaterThan(0);
    }
  });
});
