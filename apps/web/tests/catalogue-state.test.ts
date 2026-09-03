import { PRODUCTS, STORES } from '@bbq/seed';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  currentStores,
  deliversTo,
  findProduct,
  findStore,
  hiddenSlugs,
  isHidden,
  isSoldOut,
  readAudit,
  recordAudit,
  servesMode,
  setHidden,
  setService,
  setSoldOut,
  visibleProducts,
} from '@/lib/catalogue-state';
import {
  aChickenProduct,
  aDeliveryStore,
  aSuburbNotServedBy,
  aSuburbOf,
  blankState,
  storeWithout,
} from './fixtures';

/**
 * Availability, per-store services and delivery coverage, read directly.
 *
 * The writers here are exercised all over the suite — as the setup line before
 * a route test — but nothing has ever asked this module a question. So the
 * routes prove that setting a product sold out changes what the endpoint says,
 * and nothing proves what "sold out" means, that clearing it works, or that
 * writing it twice does not leave the slug in the list twice.
 */

const product = aChickenProduct();

beforeEach(blankState);

describe('what the customer is shown', () => {
  it('shows the whole menu when the console has touched nothing', () => {
    expect(visibleProducts()).toHaveLength(PRODUCTS.length);
  });

  it('keeps a sold-out product on the menu, flagged', () => {
    setSoldOut(product.slug, true);
    const found = visibleProducts().find((candidate) => candidate.slug === product.slug);

    // Flagged rather than removed: a customer looking for the thing they came
    // for is owed "not today" rather than a menu that never had it.
    expect(found?.soldOut).toBe(true);
  });

  it('takes a hidden product off the menu entirely', () => {
    setHidden(product.slug, true);
    expect(visibleProducts().some((candidate) => candidate.slug === product.slug)).toBe(false);
  });

  it('leaves the seed catalogue itself unmarked', () => {
    setSoldOut(product.slug, true);

    // The flag is layered on a copy. Written into the seed it would survive the
    // reset, and every later suite would inherit one sold-out product.
    const seeded = PRODUCTS.find((candidate) => candidate.slug === product.slug);
    expect(seeded).not.toHaveProperty('soldOut', true);
  });

  it('serves one product with the options that belong to it', () => {
    expect(findProduct(product.slug)?.optionGroups.length).toBeGreaterThan(0);
  });

  it('has nothing for a slug that was never on the menu', () => {
    expect(findProduct('gold-plated-bird')).toBeNull();
  });

  it('has nothing for a hidden one, so no page can render it by URL', () => {
    setHidden(product.slug, true);
    expect(findProduct(product.slug)).toBeNull();
  });

  it('still serves a sold-out one, because the page has to say so', () => {
    setSoldOut(product.slug, true);
    expect(findProduct(product.slug)?.soldOut).toBe(true);
  });
});

describe('switching a product back on', () => {
  it('clears sold out', () => {
    setSoldOut(product.slug, true);
    setSoldOut(product.slug, false);

    expect(isSoldOut(product.slug)).toBe(false);
    expect(visibleProducts().find((candidate) => candidate.slug === product.slug)?.soldOut).toBe(
      false,
    );
  });

  it('clears hidden', () => {
    setHidden(product.slug, true);
    setHidden(product.slug, false);

    expect(isHidden(product.slug)).toBe(false);
    expect(hiddenSlugs()).toEqual([]);
  });

  /**
   * The setters filter before they append. Written as a push, marking a product
   * sold out twice would list it twice, and one clear would leave it sold out —
   * an operator switching something off and on again and finding it still off.
   */
  it('takes one clear, however many times it was set', () => {
    setSoldOut(product.slug, true);
    setSoldOut(product.slug, true);
    setSoldOut(product.slug, true);
    setSoldOut(product.slug, false);

    expect(isSoldOut(product.slug)).toBe(false);
  });

  it('does not list the same slug twice while it is set', () => {
    setHidden(product.slug, true);
    setHidden(product.slug, true);

    expect(hiddenSlugs()).toEqual([product.slug]);
  });

  it('leaves the other products alone', () => {
    const other = PRODUCTS.find((candidate) => candidate.slug !== product.slug);
    setSoldOut(product.slug, true);

    expect(isSoldOut(other?.slug ?? '')).toBe(false);
  });
});

describe('the stores the console can change', () => {
  it('layers a switched-off service over the seeded one', () => {
    const store = aDeliveryStore();
    setService(store.id, 'Delivery', false);

    expect(findStore(store.id)?.services.Delivery).toBe(false);
    expect(STORES.find((candidate) => candidate.id === store.id)?.services.Delivery).toBe(true);
  });

  it('changes only the service it was given', () => {
    const store = aDeliveryStore();
    setService(store.id, 'Delivery', false);

    expect(findStore(store.id)?.services.Collection).toBe(store.services.Collection);
  });

  it('changes only the store it was given', () => {
    const store = aDeliveryStore();
    const other = STORES.find((candidate) => candidate.id !== store.id);
    setService(store.id, 'Delivery', false);

    expect(findStore(other?.id ?? '')?.services.Delivery).toBe(other?.services.Delivery);
  });

  it('has nothing for a store id that does not exist', () => {
    expect(findStore('ST-NOWHERE')).toBeNull();
  });

  it('keeps every seeded store in the list', () => {
    expect(currentStores().map((store) => store.id).sort()).toEqual(
      STORES.map((store) => store.id).sort(),
    );
  });
});

describe('whether a store will take the order', () => {
  it('says yes to a service it offers', () => {
    expect(servesMode(aDeliveryStore(), 'Delivery')).toBe(true);
  });

  it('says no to one it does not', () => {
    expect(servesMode(storeWithout('Dine-in'), 'Dine-in')).toBe(false);
  });

  /**
   * Compared against `true` rather than read for truthiness, so a store whose
   * services object has never heard of a mode refuses it instead of returning
   * undefined into an `if`.
   */
  it('says no to a mode the store has no opinion about', () => {
    const store = { ...aDeliveryStore(), services: {} } as Parameters<typeof servesMode>[0];
    expect(servesMode(store, 'Delivery')).toBe(false);
  });
});

describe('whether a store delivers there', () => {
  const store = aDeliveryStore();

  it('covers a suburb on its own list', () => {
    expect(deliversTo(store, aSuburbOf(store))).toBe(true);
  });

  /**
   * The case that reached the kitchen queue as work nobody could do: a real
   * suburb, delivered to by a real branch, ordered from the branch that does
   * not cover it.
   */
  it('does not cover another branch’s suburb', () => {
    expect(deliversTo(store, aSuburbNotServedBy(store))).toBe(false);
  });

  it('ignores the case the customer typed it in', () => {
    expect(deliversTo(store, aSuburbOf(store).toUpperCase())).toBe(true);
    expect(deliversTo(store, aSuburbOf(store).toLowerCase())).toBe(true);
  });

  it('ignores space around it, because an address field collects it', () => {
    expect(deliversTo(store, `  ${aSuburbOf(store)} \t`)).toBe(true);
  });

  it('refuses an empty suburb rather than matching everything', () => {
    expect(deliversTo(store, '')).toBe(false);
    expect(deliversTo(store, '   ')).toBe(false);
  });

  /**
   * Whole-name matching. A prefix match would have "Sand" covered by a store
   * that delivers to Sandton, and a driver sent somewhere nobody agreed to.
   */
  it('matches the whole suburb, not the start of it', () => {
    const suburb = aSuburbOf(store);
    expect(deliversTo(store, suburb.slice(0, Math.max(1, suburb.length - 1)))).toBe(false);
    expect(deliversTo(store, `${suburb} Extension 4`)).toBe(false);
  });
});

describe('the audit trail', () => {
  it('records what was done and who did it', () => {
    recordAudit('operations', 'marked the wings sold out');

    expect(readAudit()[0]).toMatchObject({
      who: 'operations',
      what: 'marked the wings sold out',
    });
  });

  it('reads newest first', () => {
    recordAudit('operations', 'first');
    recordAudit('operations', 'second');

    expect(readAudit().map((entry) => entry.what).slice(0, 2)).toEqual(['second', 'first']);
  });

  /**
   * Written through the shared file rather than a module variable, for the same
   * reason as everything else here: the console renders in one worker process
   * and the change was made in another.
   */
  it('survives being read back by somebody else', () => {
    recordAudit('kitchen', 'started the fryer');
    expect(readAudit().some((entry) => entry.what === 'started the fryer')).toBe(true);
  });
});
