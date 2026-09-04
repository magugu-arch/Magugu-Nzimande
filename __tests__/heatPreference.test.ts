import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Product } from '@/types';
import { menuSnapshot } from '@/services/data/menuData';
import { mildestFirst, orderedForHeat, showsHeatBadge } from '@/features/menu/heat';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import { stores } from '@/services/data/storeData';

/**
 * A switch that was read by nothing.
 *
 * The Preferences screen offers "Show milder items first — Puts the gentler
 * flavours at the top of every list". Flipping it wrote to the auth store,
 * persisted to storage and survived a sign-out. No screen ever asked for it:
 * a grep for `preferMildFirst` found the toggle, the default, and nothing
 * else. Every list came back in the order it was already in and every chilli
 * badge stayed exactly where it was.
 *
 * The same shape as the birthday reward one commit ago — a rule stated in the
 * interface and kept nowhere — and the type's own comment had been describing
 * the missing behaviour the whole time: "Hides spice badges and hot items
 * first for heat-averse customers."
 */
const product = (id: string, spiceLevel: 0 | 1 | 2 | 3): Product =>
  ({ id, name: id, spiceLevel }) as Product;

describe('putting the gentler flavours first', () => {
  it('orders by heat, mildest first', () => {
    const list = [product('hot', 3), product('plain', 0), product('warm', 2)];

    expect(mildestFirst(list).map((p) => p.id)).toEqual(['plain', 'warm', 'hot']);
  });

  /**
   * The part that matters more than the sort. A category list is in
   * merchandising order, a search result is in relevance order, and
   * favourites are newest-hearted first. Somebody who asked for milder things
   * first has not asked for any of those to be thrown away.
   */
  it('keeps the order it was given inside a heat level', () => {
    const list = [
      product('mild-c', 1),
      product('plain-a', 0),
      product('mild-a', 1),
      product('plain-b', 0),
      product('mild-b', 1),
    ];

    expect(mildestFirst(list).map((p) => p.id)).toEqual([
      'plain-a',
      'plain-b',
      'mild-c',
      'mild-a',
      'mild-b',
    ]);
  });

  it('does not mutate the array a query handed it', () => {
    const list = [product('hot', 3), product('plain', 0)];
    const before = list.map((p) => p.id);

    mildestFirst(list);
    expect(list.map((p) => p.id)).toEqual(before);
  });

  it('hands the list straight back when the preference is off', () => {
    const list = [product('hot', 3), product('plain', 0)];

    expect(orderedForHeat(list, false)).toBe(list);
    expect(orderedForHeat(list, true)).not.toBe(list);
  });

  it('copes with an empty list and a single item', () => {
    expect(mildestFirst([])).toEqual([]);
    expect(mildestFirst([product('one', 2)]).map((p) => p.id)).toEqual(['one']);
  });
});

describe('the heat badge', () => {
  it('is drawn for a hot item by default', () => {
    expect(showsHeatBadge(3, false)).toBe(true);
  });

  it('is withheld from somebody who asked not to see them', () => {
    expect(showsHeatBadge(3, true)).toBe(false);
  });

  it('was never drawn below level 3 either way', () => {
    for (const level of [0, 1, 2]) {
      expect(showsHeatBadge(level, false)).toBe(false);
      expect(showsHeatBadge(level, true)).toBe(false);
    }
  });
});

/**
 * Against the real catalogue, not a hand-built list.
 *
 * The seed has a genuine spread — fifteen products at zero, six at one, four
 * at two, three at three — so the preference has something to do. A menu that
 * was all one heat would make every assertion above pass and mean nothing.
 */
describe('the catalogue this runs against', () => {
  it('has a spread of heat levels, or none of this is visible', () => {
    const levels = new Set(menuSnapshot.products.map((p) => p.spiceLevel));

    expect(levels.size).toBeGreaterThan(2);
    expect(menuSnapshot.products.some((p) => p.spiceLevel >= 3)).toBe(true);
    expect(menuSnapshot.products.some((p) => p.spiceLevel === 0)).toBe(true);
  });

  it('really does move the hot ones down', () => {
    const sorted = mildestFirst(menuSnapshot.products);
    const firstHot = sorted.findIndex((p) => p.spiceLevel >= 3);
    const lastMild = sorted.map((p) => p.spiceLevel).lastIndexOf(0);

    expect(lastMild).toBeLessThan(firstHot);
  });
});

/**
 * Nobody reads the preference by hand again.
 *
 * The defect was not that one screen forgot; it was that the rule lived in a
 * boolean nothing obliged anyone to consult. A grep is the right shape of
 * test for that, the same as the one guarding `utils/linking`.
 */
describe('every list goes through the helper', () => {
  const code = (file: string) =>
    readFileSync(path.join(__dirname, '..', file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it.each([
    'src/app/(tabs)/menu.tsx',
    'src/features/menu/components/ProductCard.tsx',
    'src/features/menu/components/ProductRow.tsx',
  ])('%s asks the helper rather than comparing spiceLevel itself', (file) => {
    const source = code(file);

    // Either it does not care about heat at all, or it goes through `heat.ts`.
    if (/spiceLevel/.test(source)) {
      expect(source).toMatch(/showsHeatBadge|orderedForHeat|mildestFirst/);
    }
  });

  it('would catch a screen that compared it by hand', () => {
    const raw = '{product.spiceLevel >= 3 ? <Badge label="Hot" /> : null}';
    expect(/spiceLevel/.test(raw) && !/showsHeatBadge/.test(raw)).toBe(true);
  });
});

/**
 * The other switch on the same screen, silent in the same way.
 *
 * "Default order type — What we pre-select when you open the app."
 * `defaultFulfilment` was written to the auth store, persisted across
 * restarts, and read by nobody: a grep found the segmented control, the
 * default value, and a comment explaining why the field is not synced to the
 * server. Nothing consulted it. A customer who set Collection opened the app
 * on Delivery every time, for as long as they used it.
 *
 * "Pre-select" is a claim about a fresh start, not a licence to overrule
 * somebody mid-order, so the rule defers to a branch already chosen.
 */
describe('the order type the app opens on', () => {
  beforeEach(() => {
    useFulfilmentStore.getState().forgetPerson();
  });

  it('adopts the preference when nothing is under way', () => {
    useFulfilmentStore.getState().applyDefaultFulfilment('collection');

    expect(useFulfilmentStore.getState().fulfilmentType).toBe('collection');
  });

  it('leaves an order in progress alone', () => {
    useFulfilmentStore.getState().setStore(stores[1]!);
    useFulfilmentStore.getState().setFulfilmentType('delivery');

    useFulfilmentStore.getState().applyDefaultFulfilment('collection');

    // A chosen branch means the customer is mid-order. The preference waits.
    expect(useFulfilmentStore.getState().fulfilmentType).toBe('delivery');
  });

  it('applies again once the order is over and the branch is cleared', () => {
    useFulfilmentStore.getState().setStore(stores[1]!);
    useFulfilmentStore.getState().reset();

    useFulfilmentStore.getState().applyDefaultFulfilment('dinein');
    expect(useFulfilmentStore.getState().fulfilmentType).toBe('dinein');
  });

  it('does nothing at all when it already matches', () => {
    useFulfilmentStore.getState().setFulfilmentType('collection');
    const before = useFulfilmentStore.getState();

    useFulfilmentStore.getState().applyDefaultFulfilment('collection');
    expect(useFulfilmentStore.getState().fulfilmentType).toBe(before.fulfilmentType);
  });
});
