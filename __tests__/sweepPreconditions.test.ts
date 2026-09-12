import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { PERSIST_VERSION } from '@/store/persistence';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
  ───────────────────────────────────────────────────────────────────────────
  The sweep that stops testing and keeps reporting.

  Four sweeps seed a customer into `localStorage` and then drive an app they
  believe is signed in. For six rounds `audit:offline` was wrong about that:
  it stamped its envelope `version: 0`, Zustand dropped every slice on load,
  and six signed-in routes rendered "Sign in to see your orders" while the
  sweep went on reporting, route by route, that they "said nothing about the
  server at all". True, and about itself.

  `lib/persist-version.mjs` closed the version hole. It did not close the
  class. A seed can fail to arrive because a key was renamed, because
  `keepValid` rejected a field, because a store's `merge` changed, or because
  the route gated for a reason nothing to do with storage — and in every one
  of those the sweep keeps printing ticks over an app nobody chose.

  It is the worst failure a sweep can have because there is nothing to see: no
  crash, no empty output, no red. It was found once, by accident, by running
  everything and noticing a number that looked wrong.

  So the state is now asserted before anything is measured, and these fixtures
  are about the assertion: that it exists in every sweep that seeds, that its
  result is a finding rather than a note, and — the part a source scan cannot
  show — that it can actually fail.
  ───────────────────────────────────────────────────────────────────────────
*/

/** Every sweep that writes app state into a browser, derived, not listed. */
const SEEDING_SWEEPS = readdirSync(path.join(root, 'scripts'))
  .filter((file) => file.endsWith('.mjs'))
  .filter((file) => read(path.join('scripts', file)).includes("setItem('bbq."));

/**
 * Run `preconditionFailures` for real, in the runtime the sweeps run in.
 *
 * Jest cannot import an `.mjs` here without `--experimental-vm-modules`, and
 * a fixture that re-implemented the helper in TypeScript would be a mock
 * agreeing with itself. A subprocess runs the actual file, against a page
 * object that answers `evaluate` by executing the callback over a stubbed
 * `window` and `document` — the same two things a browser gives it.
 */
function drive(
  cases: { seeds: Record<string, string>; wall: string | null; options: unknown }[],
): string[][] {
  const script = `
    import { preconditionFailures } from ${JSON.stringify(
      path.join(root, 'scripts/lib/preconditions.mjs'),
    )};
    const cases = ${JSON.stringify(cases)};
    const out = [];
    for (const { seeds, wall, options } of cases) {
      const page = {
        async evaluate(fn, arg) {
          globalThis.window = {
            localStorage: { getItem: (key) => (key in seeds ? seeds[key] : null) },
          };
          globalThis.document = {
            querySelector: () =>
              wall === null ? null : { getAttribute: () => wall },
          };
          return fn(arg);
        },
      };
      out.push(await preconditionFailures(page, options));
    }
    process.stdout.write(JSON.stringify(out));
  `;
  return JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }),
  ) as string[][];
}

/**
 * The same, for the half of the check that never opens a browser.
 *
 * `seedProblems` is pure, so this only needs the module loaded — but it is the
 * same module in the same runtime, for the same reason.
 */
function inspect(seeds: Record<string, unknown>, options?: unknown): string[] {
  const script = `
    import { seedProblems } from ${JSON.stringify(
      path.join(root, 'scripts/lib/preconditions.mjs'),
    )};
    process.stdout.write(
      JSON.stringify(seedProblems(${JSON.stringify(seeds)}, ${JSON.stringify(options ?? {})})),
    );
  `;
  return JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' }),
  ) as string[];
}

/** The common case: one page, one set of options, the sentences it produced. */
function driveOne(one: {
  seeds: Record<string, string>;
  wall: string | null;
  options: unknown;
}): string[] {
  const [failures] = drive([one]);
  if (failures === undefined) throw new Error('the helper returned nothing for its one case');
  return failures;
}

const session = (state: Record<string, unknown>, version = PERSIST_VERSION) =>
  JSON.stringify({ state, version });

const SIGNED_IN = { isAuthenticated: true, isGuest: false, user: { id: 'user-1' } };

/**
 * FIXTURE 1 — every sweep that seeds, checks.
 *
 * Derived from the scripts directory rather than from a list, because a list
 * is the thing that goes stale: the fifth sweep to seed a customer is written
 * by somebody who has never read this file.
 */
describe('1 — a sweep that seeds state proves it arrived', () => {
  it('finds the sweeps by what they do, not by name', () => {
    expect(SEEDING_SWEEPS.sort()).toEqual([
      'audit-answers.mjs',
      'audit-double-tap.mjs',
      'audit-notyours.mjs',
      'audit-offline.mjs',
      'audit-slow.mjs',
      'audit-sparse.mjs',
      'audit-upgrade.mjs',
      'audit-wire.mjs',
      'audit-writes.mjs',
    ]);
  });

  it.each(SEEDING_SWEEPS)('%s asserts its preconditions', (file) => {
    const source = code(path.join('scripts', file));

    expect(source).toMatch(
      /import \{ assertSeeds, preconditionFailures \} from '\.\/lib\/preconditions\.mjs'/,
    );
    expect(source).toMatch(/await preconditionFailures\(page, \{/);
    // And the half that has to run before a browser exists.
    expect(source).toMatch(/assertSeeds\(/);
  });

  it.each(SEEDING_SWEEPS)('%s treats a failed precondition as a finding', (file) => {
    // Not a warning, not a line in passing. A sweep that has failed its own
    // preconditions has not produced a weaker result; it has produced none.
    expect(code(path.join('scripts', file))).toMatch(
      /for \(const failure of wrongState\) findings\.push\(failure\);/,
    );
  });
});

/**
 * FIXTURE 2 — the two readings, and why one would not do.
 */
describe('2 — storage and the screen fail independently', () => {
  it('catches a seed that never landed, on a route with no gate', () => {
    const failures = driveOne({
      seeds: {},
      wall: null,
      options: { where: '/orders', signedIn: true },
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('bbq.auth');
    expect(failures[0]).toMatch(/never written/);
  });

  it('catches a seed the app refused, which storage still shows as perfect', () => {
    // Zustand does not write over a slice it discarded, so the seeded value
    // sits there looking right. Only the screen knows.
    const failures = driveOne({
      seeds: { 'bbq.auth': session(SIGNED_IN) },
      wall: 'orders-signed-out',
      options: { where: '/orders', signedIn: true },
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('orders-signed-out');
    expect(failures[0]).toMatch(/refused it/);
  });

  it('says nothing when the app is in the state the sweep claims', () => {
    const failures = driveOne({
      seeds: { 'bbq.auth': session(SIGNED_IN) },
      wall: null,
      options: { where: '/orders', signedIn: true },
    });

    expect(failures).toEqual([]);
  });

  it('does not invent work for a sweep that claims nothing', () => {
    const failures = driveOne({
      seeds: {},
      wall: 'orders-signed-out',
      options: { where: '/menu' },
    });

    expect(failures).toEqual([]);
  });
});

/**
 * FIXTURE 3 — the version, named in both directions.
 *
 * The original bug, kept as a case: a sweep can now only get this wrong
 * loudly.
 */
describe('3 — the envelope this build can open', () => {
  it('names the version it found and the version it wanted', () => {
    const failures = driveOne({
      seeds: { 'bbq.auth': session(SIGNED_IN, 0) },
      wall: null,
      options: { where: '/orders', signedIn: true },
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('version 0');
    expect(failures[0]).toContain(String(PERSIST_VERSION));
    // Said as what it means here: no store took the slice.
    expect(failures[0]).toMatch(/nothing took it/);
  });

  it('accepts either version where an upgrade legitimately restamps it', () => {
    const [older, current, neither] = drive(
      [PERSIST_VERSION - 1, PERSIST_VERSION, PERSIST_VERSION + 7].map((version) => ({
        seeds: { 'bbq.favourites': session({ productIds: ['a'] }, version) },
        wall: null,
        options: {
          where: 'upgrade',
          seeded: ['bbq.favourites'],
          atVersion: [PERSIST_VERSION - 1, PERSIST_VERSION],
        },
      })),
    );

    expect(older).toEqual([]);
    expect(current).toEqual([]);
    expect(neither).toHaveLength(1);
  });

  it('tells a corrupt envelope apart from a missing one', () => {
    const failures = driveOne({
      seeds: { 'bbq.auth': 'not json at all' },
      wall: null,
      options: { where: '/orders', signedIn: true },
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/is not JSON/);
  });
});

/**
 * FIXTURE 4 — the app's own rule, not half of it.
 *
 * `useIsSignedOut` is `!isAuthenticated || isGuest`. A seed carrying both
 * flags true renders the wall, and a check reading only the first would call
 * that signed in — a precondition agreeing with a mistake instead of catching
 * it.
 */
describe('4 — a guest is not a customer', () => {
  it('reads both flags, the way the app does', () => {
    const failures = driveOne({
      seeds: { 'bbq.auth': session({ ...SIGNED_IN, isGuest: true }) },
      wall: null,
      options: { where: '/rewards', signedIn: true },
    });

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/isAuthenticated=true/);
    expect(failures[0]).toMatch(/isGuest=true/);
  });

  it('quotes the rule where the next reader will look for it', () => {
    expect(read('scripts/lib/preconditions.mjs')).toMatch(/!isAuthenticated \|\| isGuest/);
    expect(read('src/features/system/AccountRequired.tsx')).toMatch(
      /return !isAuthenticated \|\| isGuest;/,
    );
  });
});

/**
 * FIXTURE 5 — the wall is matched as an element, not as a sentence.
 *
 * `AccountRequired` defaults `testID` to `account-required`; all six call
 * sites override it with `<screen>-signed-out`. Matching copy would mean a
 * rewrite of "Sign in to see your orders" switches the check off silently,
 * which is this file's entire subject.
 */
describe('5 — every shape of the sign-in wall', () => {
  const GATED = [
    'src/app/(tabs)/orders.tsx',
    'src/app/(tabs)/rewards.tsx',
    'src/app/account/notifications.tsx',
    'src/app/account/payment-methods.tsx',
    'src/app/checkout/address.tsx',
    'src/app/rewards/vouchers.tsx',
  ];

  it.each(GATED)('%s is covered by the selector', (file) => {
    const testID = /testID="([^"]+)"/.exec(
      code(file).slice(code(file).indexOf('<AccountRequired')),
    )?.[1];

    expect(testID).toBeDefined();
    expect(testID).toMatch(/-signed-out$/);
  });

  it('covers a seventh screen that takes the default instead', () => {
    expect(code('src/features/system/AccountRequired.tsx')).toMatch(
      /testID \?\? 'account-required'/,
    );
    expect(read('scripts/lib/preconditions.mjs')).toContain(
      '[data-testid="account-required"], [data-testid$="-signed-out"]',
    );
  });

  it('reports which wall it found rather than that there was one', () => {
    const named = driveOne({
      seeds: { 'bbq.auth': session(SIGNED_IN) },
      wall: 'payment-methods-signed-out',
      options: { where: '/account/payment-methods', signedIn: true },
    });

    expect(named[0]).toContain('payment-methods-signed-out');
  });
});

/**
 * FIXTURE 6 — the check that was run and could not fail.
 *
 * `audit:writes` was re-run with its envelope deliberately stamped `version:
 * 0` — the exact bug this whole line of work started from — and came back
 * green: six cases, twelve runs, not one complaint. The in-page reading was
 * right to say nothing. `migrateByRevalidating` arrived in the same round as
 * the version, so a mismatch no longer discards the slice: Zustand calls the
 * migrate, `merge` re-validates every field, and the store writes it straight
 * back under this build's number. By the time a page can be read, a wrong
 * stamp has been silently corrected.
 *
 * Which is good news about the app and bad news about the check, and the only
 * honest response to a check that cannot report its own outcome is to move it
 * somewhere it can. So the stamp is now read where it is still the sweep's
 * own: over the string, before the browser is built.
 */
describe('6 — the stamp, checked where it can still be wrong', () => {
  it('passes a seed written the way the sweeps write it', () => {
    expect(inspect({ 'bbq.auth': session(SIGNED_IN) })).toEqual([]);
  });

  it('catches the literal somebody typed instead of the shared constant', () => {
    const [problem] = inspect({ 'bbq.auth': session(SIGNED_IN, 0) });

    expect(problem).toContain('version 0');
    expect(problem).toContain('lib/persist-version.mjs');
  });

  it('catches an envelope with no version on it at all', () => {
    const [problem] = inspect({ 'bbq.cart': JSON.stringify({ state: { lines: [] } }) });

    expect(problem).toContain('bbq.cart');
    expect(problem).toContain('version undefined');
  });

  it('catches an envelope with no state in it', () => {
    const [problem] = inspect({ 'bbq.auth': JSON.stringify({ version: PERSIST_VERSION }) });

    expect(problem).toMatch(/no \{ state \} in its envelope/);
  });

  it('catches a seed handed over as an object rather than a string', () => {
    // `localStorage.setItem` would stringify it to "[object Object]", which
    // the app reads as a slice it cannot parse and drops without a word.
    const [problem] = inspect({ 'bbq.auth': { state: SIGNED_IN } as unknown as string });

    expect(problem).toMatch(/storage holds strings/);
  });

  it('lets a sweep about upgrading stamp the version it means', () => {
    const older = PERSIST_VERSION - 1;

    expect(inspect({ 'bbq.auth': session(SIGNED_IN, older) }, { atVersion: older })).toEqual([]);
    expect(inspect({ 'bbq.auth': session(SIGNED_IN) }, { atVersion: older })).toHaveLength(1);
  });

  it('stops the sweep rather than filing a finding about the app', () => {
    // Exit 2 is this repository's "could not run"; 1 means "ran, and found
    // something". A malformed seed is a bug in the script, and a sweep that
    // reported it under its own findings heading would read like a defect.
    const lib = read('scripts/lib/preconditions.mjs');

    expect(lib).toMatch(/export function assertSeeds\(seeds, options\) \{/);
    expect(lib).toMatch(/process\.exit\(2\);/);
    expect(lib).toMatch(/It is a sweep that cannot\s+\* run/);
  });
});
