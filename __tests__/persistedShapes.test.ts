import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  arrayOfShaped,
  isBoolean,
  isString,
  isStringArray,
  keepValid,
  nullOrShaped,
  oneOf,
  PERSIST_VERSION,
  PERSISTED_KEYS,
} from '@/store/persistence';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const STORES = [
  'src/store/authStore.ts',
  'src/store/cartStore.ts',
  'src/store/favouritesStore.ts',
  'src/store/fulfilmentStore.ts',
];

/**
 * 1 — the state nothing had ever produced, because only this app writes it.
 *
 * Four stores persist through `zustand/persist` and not one declared a
 * `version` or a `migrate`. The default rehydration is a shallow merge:
 * whatever sits in storage under that key wins over the initial state, field
 * by field, unexamined.
 *
 * That is safe while the only writer is this build. It is not safe for a
 * shipped app, which updates — `updates.url` is configured — so a customer can
 * be carrying a basket written by last month's binary when this month's code
 * reads it. A field whose shape changed between those two builds is the
 * ordinary consequence of shipping twice.
 */
describe('every persisted store declares a version and checks what it reads', () => {
  it.each(STORES)('%s', (file) => {
    const store = code(file);

    expect(store).toMatch(/version: PERSIST_VERSION/);
    expect(store).toMatch(/merge: \(persisted, current\) => \(\{/);
    expect(store).toMatch(/keepValid</);
  });

  it('keeps one version across all four, because the question has one answer', () => {
    expect(PERSIST_VERSION).toBeGreaterThan(0);
    expect(PERSISTED_KEYS).toEqual(['bbq.auth', 'bbq.cart', 'bbq.favourites', 'bbq.fulfilment']);
  });

  /** Every key the stores actually write is one the escape hatch can clear. */
  it('names every key the stores write, so none can be left behind', () => {
    for (const file of STORES) {
      // Anchored on the `bbq.` prefix, not on the first `name:` in the file —
      // the cart store's own demo basket has a `name: 'Rose Ddeok-Bokki'` in
      // it, and the looser regex picked that up.
      const name = /name: '(bbq\.[^']+)'/.exec(code(file))?.[1];
      expect(name).toBeDefined();
      expect(PERSISTED_KEYS as readonly string[]).toContain(name!);
    }
  });
});

/**
 * 2 — the three shapes that crashed the app, driven in Chromium before this
 * existed.
 *
 *     lines: null                    → priceBasket     → null.map
 *     a line with no selectedOptions → describeOptions → undefined.map
 *     a store with no openingHours   → closureReason   → undefined.length
 */
describe('the shapes that crashed it', () => {
  const CART_LINE = {
    id: 'x',
    productId: 'golden-original',
    name: 'Golden Original Chicken',
    assetKey: 'goldenOriginal',
    unitBasePrice: 149,
    quantity: 1,
    selectedOptions: [],
    unitPrice: 149,
    lineTotal: 149,
  };

  const lines = arrayOfShaped([
    'id',
    'productId',
    'name',
    'assetKey',
    'unitBasePrice',
    'quantity',
    'selectedOptions',
    'unitPrice',
    'lineTotal',
  ]);

  it('drops a null basket rather than handing it to the pricer', () => {
    expect(keepValid<{ lines: unknown }>({ lines: null }, { lines })).toEqual({});
  });

  it('drops a basket that is not a list at all', () => {
    for (const nonsense of ['[]', 42, {}, true]) {
      expect(keepValid<{ lines: unknown }>({ lines: nonsense }, { lines })).toEqual({});
    }
  });

  /**
   * 3 — and the line that is *nearly* right, which is the shape an old build
   * actually leaves behind. One missing field, eight present.
   */
  it('drops a line written before a field existed', () => {
    const old = { id: 'x', productId: 'golden-original', name: 'Golden Original', quantity: 1 };

    expect(keepValid<{ lines: unknown }>({ lines: [old] }, { lines })).toEqual({});
  });

  /** 4 — one bad line poisons the basket, because a partial basket is a lie. */
  it('drops the whole basket when one line is broken', () => {
    const broken = { ...CART_LINE, selectedOptions: undefined };
    delete (broken as Record<string, unknown>).selectedOptions;

    expect(keepValid<{ lines: unknown }>({ lines: [CART_LINE, broken] }, { lines })).toEqual({});
  });

  it('keeps a basket every line of which is whole', () => {
    expect(keepValid<{ lines: unknown }>({ lines: [CART_LINE] }, { lines })).toEqual({
      lines: [CART_LINE],
    });
  });

  /** 5 — the branch record that predates a field the first render reads. */
  it('drops a saved branch with no opening hours', () => {
    const store = nullOrShaped(['id', 'name', 'openingHours', 'isOpenNow']);

    expect(store({ id: 'store-gone', name: 'bb.q Chicken Nowhere' })).toBe(false);
    expect(store({ id: 's', name: 'n', openingHours: [], isOpenNow: true })).toBe(true);
    // Null is the ordinary state — nobody has chosen a branch yet.
    expect(store(null)).toBe(true);
  });
});

/**
 * 6 — the one that did not crash, and was worse for it.
 *
 * A stored `fulfilmentType` of 'curbside' — from a build that offered it —
 * throws nothing. It falls through every branch in the app: checkout rendered
 * with no fulfilment chip selected and delivery's wording underneath, which is
 * a screen nobody designed and nobody would report as a crash.
 */
describe('a stored enum member that is no longer a member', () => {
  const fulfilment = oneOf(['delivery', 'collection', 'dinein']);

  it('accepts the three that exist', () => {
    for (const value of ['delivery', 'collection', 'dinein']) {
      expect(fulfilment(value)).toBe(true);
    }
  });

  it('refuses one that has been withdrawn, and anything that is not a string', () => {
    for (const value of ['curbside', '', 'DELIVERY', 0, null, undefined, ['delivery']]) {
      expect(fulfilment(value)).toBe(false);
    }
  });
});

/**
 * 7 — what the merge does with what it rejects.
 *
 * Dropped, never repaired. A basket line missing its options cannot be
 * reconstructed, and guessing would put food in front of somebody they did not
 * order. Returning a partial is what lets zustand's merge leave the initial
 * value in place for exactly the fields that failed.
 */
describe('what survives a rejection', () => {
  it('keeps the fields that passed and only those', () => {
    const kept = keepValid<{ a: unknown; b: unknown }>(
      { a: 'yes', b: 12 },
      { a: isString, b: isString },
    );

    expect(kept).toEqual({ a: 'yes' });
  });

  /**
   * 8 — a field nobody declared a check for is carried through. This is a
   * guard against the shapes that crash, not a schema: treating every unlisted
   * field as suspect would mean every new field needed a line here before it
   * could be saved at all.
   */
  it('carries an unchecked field through untouched', () => {
    expect(keepValid<{ a: unknown }>({ a: 1, extra: 'kept' }, { a: () => true })).toEqual({
      a: 1,
      extra: 'kept',
    });
  });

  it('returns nothing at all for storage that is not an object', () => {
    for (const nonsense of [null, undefined, 'string', 7, []]) {
      expect(keepValid<{ a: unknown }>(nonsense, { a: () => true })).toEqual({});
    }
  });
});

/** 9 — the smaller checks, which are the ones easiest to get subtly wrong. */
describe('the shape checks themselves', () => {
  it('isStringArray refuses a list with one non-string in it', () => {
    expect(isStringArray(['a', 'b'])).toBe(true);
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(['a', 2])).toBe(false);
    expect(isStringArray('ab')).toBe(false);
  });

  it('isBoolean refuses the values that are merely falsy', () => {
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean(0)).toBe(false);
    expect(isBoolean('')).toBe(false);
    expect(isBoolean(null)).toBe(false);
  });

  it('arrayOfShaped accepts an empty list, which is an empty basket', () => {
    expect(arrayOfShaped(['id'])([])).toBe(true);
    expect(arrayOfShaped(['id'])([{ id: 'a' }])).toBe(true);
    expect(arrayOfShaped(['id'])([{ id: 'a' }, {}])).toBe(false);
    // An array of primitives is not an array of records.
    expect(arrayOfShaped(['id'])(['a'])).toBe(false);
  });
});

/**
 * 10 — the escape hatch, for the shape nobody anticipated.
 *
 * Validation covers the three that crashed and the classes around them. The
 * fourth one — the shape that passes every check here and still breaks
 * something downstream — is the only kind that ever gets through, and before
 * this there was no way out of it from inside the app. The screen said "Your
 * cart is saved, so nothing is lost" and offered a Try again that re-read the
 * same value and crashed again; a customer would have had to delete the app.
 */
describe('the way out of a crash retrying cannot fix', () => {
  const boundary = code('src/components/ErrorBoundary.tsx');

  it('clears every persisted key, from the one list that names them', () => {
    expect(boundary).toMatch(/AsyncStorage\.multiRemove\(\[\.\.\.PERSISTED_KEYS\]\)/);
  });

  it('appears only after a retry has already failed', () => {
    expect(boundary).toMatch(/const retriedAlready = this\.state\.retries > 0/);
    expect(boundary).toMatch(/\{retriedAlready \? \(/);
  });

  it('stops claiming the cart is safe, because the cart is often the cause', () => {
    expect(boundary).not.toMatch(/cart is saved/);
    expect(boundary).toMatch(/Nothing has been ordered/);
  });

  it('reports a storage layer that refuses to delete rather than swallowing it', () => {
    const clear = boundary.slice(boundary.indexOf('handleClearSavedData'));

    expect(clear.slice(0, 900)).toMatch(/reportError\(/);
  });
});
