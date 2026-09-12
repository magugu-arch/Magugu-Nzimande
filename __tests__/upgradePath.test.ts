import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PERSIST_VERSION, PERSISTED_KEYS, migrateByRevalidating } from '@/store/persistence';

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

/*
  ───────────────────────────────────────────────────────────────────────────
  The customer who updates the app.

  `src/store/persistence.ts` opens by saying the four stores declared "no
  `version` or a `migrate`". The version arrived and the migrate did not — and
  zustand only calls `merge` when the stored version matches. On a mismatch it
  calls `migrate`, finds none, and discards the slice, routing around the one
  piece of validation that file exists to perform, on the single occasion it
  was written for.

  So the next bump of `PERSIST_VERSION` — the ordinary consequence of shipping
  a shape change, which is exactly what the constant is for — signed every
  customer in the field out, emptied their basket, forgot their favourites and
  dropped the branch they had chosen. Silently, on first launch after an
  update.

  Not reasoned about. `audit:offline` seeded storage at `version: 0` for six
  rounds and five signed-in routes rendered "Sign in to see your orders" the
  whole time. That is this mechanism, already observed, pointed at a sweep
  instead of a phone.
  ───────────────────────────────────────────────────────────────────────────
*/

/**
 * FIXTURE 1 — every store has the door, not just the one somebody looked at.
 *
 * The version is deliberately shared across the four: "the question 'is this
 * data from a build that thought differently' has one answer per release, not
 * four". The answer to it has to be shared too, or a bump keeps three slices
 * and drops the fourth.
 */
describe('1 — all four stores survive a version they did not write', () => {
  it.each(STORES)('%s declares a migrate as well as a version', (file) => {
    const source = code(file);

    expect(source).toMatch(/version: PERSIST_VERSION,/);
    expect(source).toMatch(/migrate: migrateByRevalidating,/);
  });

  it('uses one shared migrate rather than four copies of a rule', () => {
    for (const file of STORES) {
      expect(code(file)).toMatch(/migrateByRevalidating/);
      // Nobody re-implements it locally.
      expect(code(file)).not.toMatch(/migrate: \(/);
    }
  });

  it('covers exactly the keys the app persists', () => {
    // `PERSISTED_KEYS` is what `ErrorBoundary` clears; the store list here is
    // what has a migrate. If one grows and the other does not, a slice ships
    // with no upgrade path and nothing says so.
    expect(PERSISTED_KEYS).toHaveLength(STORES.length);
  });
});

/**
 * FIXTURE 2 — what the migrate is, and why it is that.
 *
 * Returning the persisted state unchanged hands it to `merge`, which is where
 * `keepValid` lives. A bump then re-validates every field against the checks
 * *of the build doing the reading* — which is the right default because the
 * checks travel with the shapes: a commit that changes a persisted field
 * changes its check in the same breath, and the old value fails it and is
 * dropped field by field rather than slice by slice.
 */
describe('2 — a bump means look again, not forget', () => {
  it('hands the state on rather than deciding about it', () => {
    const basket = { lines: [{ id: 'line-1' }], fulfilmentType: 'delivery' };
    expect(migrateByRevalidating(basket)).toBe(basket);
  });

  it('passes through the shapes that would be dropped later, not earlier', () => {
    // It is not the migrate's job to judge: `merge` does that, with the
    // checks. Handing back rubbish is correct here and safe there.
    expect(migrateByRevalidating({ lines: null })).toEqual({ lines: null });
    expect(migrateByRevalidating(undefined)).toBeUndefined();
  });

  it('leaves the validation exactly where it was', () => {
    // Every store still merges through `keepValid`; the migrate adds a door,
    // it does not move the lock.
    for (const file of STORES) {
      expect(code(file)).toMatch(/merge: \(persisted, current\) => \(\{/);
      expect(code(file)).toMatch(/keepValid</);
    }
  });
});

/**
 * FIXTURE 3 — the constraint that comes with it, written down.
 *
 * The version exists for changes `keepValid` cannot express. If somebody makes
 * one, dropping the old value is their commit's job — a deliberate line in a
 * diff rather than something that happens to everybody on every release. That
 * is a rule a future reader has to find, so it lives beside the function.
 */
describe('3 — the rule for the next person who bumps it', () => {
  const persistence = read('src/store/persistence.ts');

  it('says what a bump now costs and what it does not', () => {
    expect(persistence).toMatch(/look again, not forget/i);
    expect(persistence).toMatch(/dropping the old value is your\s+\* commit's job/);
  });

  it('records the evidence rather than asserting the behaviour', () => {
    expect(persistence).toMatch(/audit:offline/);
    expect(persistence).toMatch(/version: 0/);
  });
});

/**
 * FIXTURE 4 — the sweep drives an actual upgrade.
 *
 * Storage written by last month's build, loaded by this one. Both arms, so a
 * pass means "an update changed nothing" rather than "neither run worked".
 */
describe('4 — audit:upgrade', () => {
  const audit = code('scripts/audit-upgrade.mjs');

  it('loads storage from this build and from the one before it', () => {
    expect(audit).toMatch(/const LAST_MONTH = PERSIST_VERSION - 1;/);
    expect(audit).toMatch(/for \(const written of \[PERSIST_VERSION, LAST_MONTH\]\)/);
  });

  it('reads the version from the app rather than choosing one', () => {
    expect(audit).toMatch(/import \{ PERSIST_VERSION \} from '\.\/lib\/persist-version\.mjs'/);
  });

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:upgrade']).toBe('node scripts/audit-upgrade.mjs');
  });
});

/**
 * FIXTURE 5 — the measurement that could not fail, three times.
 *
 * Worth keeping as a fixture because each version looked reasonable and none
 * of them could report the outcome it existed to report.
 *
 *   1. It read `bbq.favourites` back out of `localStorage`. A store that
 *      discards its persisted slice does not necessarily write over it, so the
 *      old value sits there and the count is the one that went in.
 *   2. It counted filled hearts — but `favouritesStore` seeds three of its own
 *      in a mock build, so a discarded slice still renders hearts.
 *   3. It asked whether a demo *id* contained a rendered *name*, backwards, so
 *      the check never fired even on the run where everything had been
 *      dropped.
 *
 * The counterfactual now separates all three: 4 of 4 with the migrate, 0 of 4
 * without, and the demo's own favourites named on screen in their place.
 */
describe('5 — a check that can actually fail', () => {
  const audit = code('scripts/audit-upgrade.mjs');

  it('seeds favourites the app would never seed itself', () => {
    expect(audit).toMatch(/const SEEDED_BY_THE_APP = \['honey-garlic', 'cheesling-fries'/);
    // And the customer's own share nothing with them.
    const seeded = /productIds: \[([^\]]*)\]/.exec(audit)?.[1] ?? '';
    for (const demo of ['honey-garlic', 'cheesling-fries', 'korean-rice-bowl']) {
      expect(seeded).not.toContain(demo);
    }
  });

  it('reads the store through the screen, not the storage it was seeded into', () => {
    expect(audit).toMatch(/aria-label\^="Remove "/);
    expect(audit).not.toMatch(/getItem\('bbq\.favourites'\)/);
  });

  it('reports the demo set by name when it appears', () => {
    expect(audit).toMatch(/the app's demo favourites are on screen/);
  });

  it('measures the session from the store rather than from rendered text', () => {
    // The profile screen puts the name in an input *value*, which `innerText`
    // does not carry — the first version looked for it there and reported both
    // runs as signed out.
    expect(audit).toMatch(/getItem\('bbq\.auth'\)/);
    expect(audit).toMatch(/state\?\.user\?\.id/);
  });
});

/**
 * FIXTURE 6 — the version itself, which nothing else may restate.
 */
describe('6 — one version, read everywhere', () => {
  it('is a number the stores share', () => {
    expect(typeof PERSIST_VERSION).toBe('number');
    expect(PERSIST_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('is declared in the one shape the sweeps parse for', () => {
    expect(read('src/store/persistence.ts')).toMatch(/export const PERSIST_VERSION = \d+;/);
  });
});
