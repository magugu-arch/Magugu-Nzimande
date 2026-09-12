import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Every source file in the app, found rather than listed. */
function sourceFiles(dir = 'src'): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const here = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(here);
    return /\.tsx?$/.test(entry.name) ? [here] : [];
  });
}

/*
  ───────────────────────────────────────────────────────────────────────────
  The way back.

  Every sweep in this repository drove the app forwards. A customer does not:
  they open a push notification onto a screen in the middle of a journey, they
  follow a shared link to a product, they press Back on the confirmation after
  paying to check it really went through.

  `router.canGoBack()` is false whenever a screen is the first one — a deep
  link, a notification, a shared link, and on the web build every refresh. Six
  places in the app called `router.back()` behind that guard with nothing after
  it, so on those screens the control was drawn, was labelled, took the tap and
  did nothing:

    ScreenHeader          the back arrow at the top of every stack screen
    product/[id]          "Add to cart" — the line went in, the screen sat still
    order/[id]/rate       "Not now", on the screen a notification lands on
    checkout/address      choosing an address
    checkout/schedule     confirming a time, and the "Go back" in its empty state

  `audit:back` found the two checkout ones by driving them. A grep for the same
  line found the other four — the fix follows the sweep, and wherever the sweep
  never went the hole stayed open, which is this repository's oldest lesson
  about itself. The product one is the worst for a customer: the obvious
  response to a tap that does nothing is to tap again, which is how somebody
  ends up with three of the same thing in their basket.

  So the rule is enforced structurally rather than screen by screen. A seventh
  instance cannot be written without this failing.
  ───────────────────────────────────────────────────────────────────────────
*/

/** Files that navigate backwards at all, derived. */
const GOES_BACK = sourceFiles().filter((file) => code(file).includes('router.back()'));

/**
 * FIXTURE 1 — every way back has somewhere to go.
 *
 * Two halves, because either alone passes something broken: an unguarded
 * `back()` throws on a screen with no history, and a guarded one with no
 * `else` is the silent version this round found six of.
 */
describe('1 — no button that goes nowhere', () => {
  it('knows which files navigate backwards', () => {
    expect(GOES_BACK.sort()).toEqual([
      'src/app/checkout/address.tsx',
      'src/app/checkout/schedule.tsx',
      'src/app/checkout/store.tsx',
      'src/app/order/[id]/rate.tsx',
      'src/app/product/[id].tsx',
      'src/components/ui/ScreenHeader.tsx',
    ]);
  });

  it.each(GOES_BACK)('%s guards every back with canGoBack', (file) => {
    const source = code(file);

    expect((source.match(/router\.back\(\)/g) ?? []).length).toBe(
      (source.match(/router\.canGoBack\(\)/g) ?? []).length,
    );
  });

  it.each(GOES_BACK)('%s follows every guard with somewhere else to go', (file) => {
    const source = code(file);
    const guards = [...source.matchAll(/router\.canGoBack\(\)/g)];

    expect(guards.length).toBeGreaterThan(0);
    for (const guard of guards) {
      /*
        Both shapes the app writes, because both are correct and one of them
        was already in the codebase: the `if`/`else` statement, and the ternary
        that `product/[id].tsx` uses for its floating back button — which had
        its fallback all along and is the reason this rule is matched on the
        branch keyword rather than on one spelling of it.

        160 characters covers the longest of them with room, and is short
        enough that an unrelated `replace` further down the file cannot stand
        in for a missing one here.
      */
      const after = source.slice(guard.index, guard.index + 160);
      expect(after).toMatch(/(else|:)\s*router\.replace\(/);
    }
  });
});

/**
 * FIXTURE 2 — the fallbacks are reasoned, not copied.
 *
 * Six screens, five destinations. A single shared "go home" would have been
 * easier to write and worse to meet: somebody who has just chosen an address
 * belongs at checkout, and somebody who has just added an item belongs where
 * they can see it went in.
 */
describe('2 — each screen falls back somewhere it makes sense', () => {
  const DESTINATIONS: [string, string][] = [
    // The header cannot know better than home; a screen that does passes onBack.
    ['src/components/ui/ScreenHeader.tsx', '/(tabs)/home'],
    // Also reachable by somebody just browsing branches, so also home.
    ['src/app/checkout/store.tsx', '/(tabs)/home'],
    // These two only exist to answer a question checkout asked.
    ['src/app/checkout/address.tsx', '/checkout'],
    ['src/app/checkout/schedule.tsx', '/checkout'],
    // Where the item they just added is.
    ['src/app/product/[id].tsx', '/cart'],
    // The order they were being asked about.
    ['src/app/order/[id]/rate.tsx', '/order/'],
  ];

  it.each(DESTINATIONS)('%s falls back to %s', (file, destination) => {
    expect(code(file)).toContain(`router.replace(`);
    expect(code(file)).toContain(destination);
  });

  it('does not send everybody to the same place', () => {
    const destinations = new Set(DESTINATIONS.map(([, to]) => to));

    expect(destinations.size).toBeGreaterThan(1);
  });
});

/**
 * FIXTURE 3 — the claim beside the money, now driven.
 *
 * `checkout/index.tsx` says the basket is cleared "before navigating so back
 * navigation can never resubmit". That is the most expensive claim in the app
 * and it was a comment. `audit:back` presses Back on the confirmation after a
 * real order and reads the place-order button: it landed on `/menu` with
 * nothing to press.
 *
 * The ordering is asserted here as well as driven, because the sweep can only
 * see the outcome and this is the reason for it.
 */
describe('3 — the basket is emptied before the navigation, not after', () => {
  const checkout = code('src/app/checkout/index.tsx');

  it('clears the cart before it replaces the route', () => {
    const cleared = checkout.indexOf('clearCart();');
    const navigated = checkout.indexOf('router.replace(`/order/');

    expect(cleared).toBeGreaterThan(-1);
    expect(navigated).toBeGreaterThan(-1);
    expect(cleared).toBeLessThan(navigated);
  });

  it('drops the idempotency key with it', () => {
    // Carrying it into the next order would have a backend suppress that order
    // as a duplicate of this one.
    const key = checkout.indexOf('attemptKey.current = null;');

    expect(key).toBeGreaterThan(-1);
    expect(key).toBeLessThan(checkout.indexOf('router.replace(`/order/'));
  });

  it('replaces rather than pushes, so the confirmation is not a layer', () => {
    expect(checkout).toMatch(
      /router\.replace\(`\/order\/\$\{outcome\.order\.id\}\/confirmation`\)/,
    );
  });
});

/**
 * FIXTURE 4 — the sweep, and the control that makes its green mean something.
 */
describe('4 — audit:back', () => {
  // Read, not stripped: two of these assertions are about what the sweep says
  // for itself, and `code()` would remove exactly that.
  const audit = read('scripts/audit-back.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:back']).toBe('node scripts/audit-back.mjs');
  });

  it('carries a case that already passed before the fix', () => {
    // `checkout/store.tsx` had the fallback all along. If that case ever fails,
    // the sweep is broken rather than the app — which is the only way a row of
    // ticks is a measurement rather than a shrug.
    expect(audit).toMatch(/control: true/);
    expect(audit).toMatch(
      /a failure here means the[\s\S]{0,40}sweep is broken rather than the app/,
    );
  });

  it('presses the control on each screen that had the hole', () => {
    for (const route of [
      '/checkout/address',
      '/checkout/schedule',
      '/account/help',
      '/product/golden-original',
      '/order/order-4610/rate',
    ]) {
      expect(audit).toContain(route);
    }
  });

  it('tells a screen that did nothing apart from one that did everything but move', () => {
    // Reading the choice back out of storage is what separates them, and they
    // are different bugs: one refused the customer, the other took their answer
    // and left them staring at the question.
    expect(audit).toMatch(/getItem\('bbq\.fulfilment'\)/);
    expect(audit).toMatch(/nothing happened/);
    expect(audit).toMatch(/recorded, and stayed put/);
  });

  it('reads whether the place-order button would actually accept a second tap', () => {
    // Present-and-refusing is a safe screen to land on; a finding for it would
    // be noise, and a check that could not tell them apart would be worse.
    expect(audit).toMatch(/aria-disabled/);
  });
});
