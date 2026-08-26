#!/usr/bin/env node
/**
 * Type in your address and see whether the branch will deliver to it.
 *
 * `missingFulfilmentRequirement` refuses a delivery whose address falls outside
 * the branch's `deliveryRadiusKm`. That is the right rule and was added for a
 * good reason: against a real network of two branches, most addresses in the
 * country are out of range and were being quoted a delivery anyway.
 *
 * The rule needs a coordinate for the address. The add-address form has no
 * geocoder behind it, so it stamped every address a customer typed with
 * `DEFAULT_COORDINATES` — the Johannesburg CBD — under a comment saying a real
 * implementation would geocode here. Harmless while nothing read the field.
 * The radius rule reads it, and together they decide where a customer lives
 * from a constant:
 *
 *     REFUSES    Sandton City      10.8 km from the stamped coordinate
 *     DELIVERS   Rosebank           6.4 km
 *     REFUSES    Fourways          21.1 km
 *     REFUSES    Menlyn Park       52.1 km
 *     REFUSES    V&A Waterfront  1260.3 km
 *     REFUSES    Canal Walk      1253.1 km
 *     REFUSES    Gateway          491.3 km
 *
 * Six of the seven branches refuse every address a customer types, wherever it
 * is; the seventh accepts every address a customer types, wherever it is. The
 * customer standing across the road from bb.q Chicken Sandton City is told
 * "bb.q Chicken Sandton City does not deliver to Sandhurst — collect instead".
 *
 * So this drives the journey nobody had: type an address in and try to have it
 * delivered from the branch it is nearest to.
 *
 * What it asserts is only the half that is knowable without a geocoder — an
 * address the app has never located must not be *refused* on distance — plus
 * the guard that keeps the fix from being "stop checking the radius": an
 * address that *does* carry coordinates must still be refused when it is out
 * of range. The remaining half, a typed address that really is out of range
 * being accepted, cannot be closed here; `audit:launch` reports it, because
 * connecting a geocoding service is not something this repo can do for you.
 *
 * Run: npm run audit:delivery-range
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-delivery-range');
const PORT = 8197;
const BASE = `http://localhost:${PORT}`;

/** A Monday lunchtime, so every branch is trading and the clock is not the test. */
const LUNCHTIME = '2026-08-24T13:00:00+02:00';

const pinClock = (iso) => `
  const fixed = new Date('${iso}').getTime();
  const Real = Date;
  Date = class extends Real {
    constructor(...args) { super(...(args.length ? args : [fixed])); }
    static now() { return fixed; }
  };
  Date.parse = Real.parse;
  Date.UTC = Real.UTC;
`;

/**
 * An address a few hundred metres from the Sandton branch.
 *
 * Maude Street runs past Sandton City. Nothing in the app knows that — which is
 * the point: the app cannot tell this apart from an address in another
 * province, and must therefore not pretend it can.
 */
const NEAR_SANDTON = {
  label: 'Work',
  line1: '12 Maude Street',
  suburb: 'Sandhurst',
  city: 'Johannesburg',
  postalCode: '2196',
  province: 'Gauteng',
};

/** The Johannesburg CBD, as `DEFAULT_COORDINATES` has it. */
const CBD = { latitude: -26.2041, longitude: 28.0473 };

const TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf',
  '.ico': 'image/x-icon', '.json': 'application/json', '.svg': 'image/svg+xml',
};

function serve() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(OUT, pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(OUT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

console.log('Building…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1' },
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const steps = [];
/**
 * Wrong answers, collected rather than thrown on.
 *
 * The invented coordinate and the refusal it produces are one bug seen twice —
 * once in the data, once in what the customer is told — and stopping at the
 * first hides the second, which is the half that matters to anybody who is not
 * reading the source.
 */
const findings = [];
let failed = null;

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Africa/Johannesburg',
  });
  await context.addInitScript(pinClock(LUNCHTIME));

  const page = await context.newPage();
  const go = (route) => page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
  const tap = (id) =>
    page.locator(`[data-testid="${id}"]:visible`).first().click({ timeout: 10000 });
  const tapText = (text) => page.getByText(text, { exact: false }).first().click({ timeout: 10000 });
  const settle = () => page.waitForTimeout(1400);
  const step = (name) => {
    steps.push(name);
    console.log(`  ✓ ${name}`);
  };

  /** Why the Place Order button is disabled, in the customer's own words. */
  const blocker = async () => {
    const disabled = await page
      .locator('[data-testid="checkout-place-order"]')
      .first()
      .getAttribute('aria-disabled');
    if (disabled !== 'true') return null;
    return page.evaluate(() => {
      const button = document.querySelector('[data-testid="checkout-place-order"]');
      const footer = button?.parentElement;
      const caption =
        footer &&
        [...footer.children].find((child) => child !== button && child.textContent?.trim());
      return caption?.textContent?.trim() ?? '(no reason shown)';
    });
  };

  /** The address the device is holding right now. */
  const heldAddress = () =>
    page.evaluate(() => {
      const raw = window.localStorage.getItem('bbq.fulfilment');
      return JSON.parse(raw ?? '{}')?.state?.address ?? null;
    });

  // ---- sign in and fill a basket ----
  await go('/sign-in');
  await page.locator('[data-testid="sign-in-email"]').fill('regular@example.co.za');
  await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
  await tap('sign-in-submit');
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'), { timeout: 20000 });

  await go('/menu');
  await page.getByText('Golden Original Chicken', { exact: false }).first().click({ timeout: 10000 });
  await page.waitForURL(/product\//, { timeout: 15000 });
  await tap('product-add-to-cart');
  step('signed in with something in the basket');

  /**
   * From here on, everything is tapped rather than navigated to by URL.
   *
   * A `page.goto` reloads the bundle, and the mock's address ledger is module
   * state — an address added by hand would vanish from the list on the very
   * next navigation. The cold-start audit was rewritten for the same reason.
   */
  await go('/checkout');
  await settle();
  await tap('fulfilment-delivery');
  await settle();

  // ---- the rule where the app really does know: a located address, far branch ----
  //
  // Done first, and deliberately. Without it the fix could simply be "stop
  // checking the radius", which puts back the bug the radius rule was added
  // for. This account's seeded addresses carry real coordinates, so the rule
  // has something to stand on.
  await tapText('Cooked at');
  await page.waitForURL(/checkout\/store/, { timeout: 15000 });
  await settle();

  /**
   * The same bug wearing its other face, on the screen before checkout.
   *
   * Nothing has granted this browser location, which is the ordinary state of
   * an app on a phone whose owner tapped "Don't allow". `fetchStores` used to
   * default its origin to the Johannesburg CBD, so every card carried a
   * distance badge measured from there, the list was sorted by it, and the map
   * put a "you are here" dot in the middle of Gauteng. A customer in Durban
   * read "bb.q Chicken Rosebank · 6.4 km", nearest first.
   */
  const picker = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
  const distances = picker.match(/\d+(?:\.\d+)?\s?(?:km|m)\b/g) ?? [];
  if (distances.length > 0) {
    findings.push(
      `the store picker printed ${distances.length} distance(s) — ${distances
        .slice(0, 3)
        .join(', ')} — with no idea where the customer is`,
    );
    console.log(`  ✗ distances shown without a location: ${distances.slice(0, 3).join(', ')}`);
  } else {
    step('no distance is claimed when the app has no location');
  }

  if (/nearby|from the city centre/i.test(picker)) {
    findings.push(
      'the store picker still describes the branches as nearby, or as measured from ' +
        'the city centre, without a location to measure from',
    );
    console.log('  ✗ still calls them nearby');
  } else {
    step('the picker does not call them nearby either');
  }

  await tap('store-card-store-vanda');
  await page.waitForURL((url) => !url.pathname.includes('/store'), { timeout: 15000 });
  await settle();

  await tapText('Delivering to');
  await page.waitForURL(/checkout\/address/, { timeout: 15000 });
  await settle();
  await tap('address-card-address-home');
  await page.waitForURL((url) => !url.pathname.includes('/address'), { timeout: 15000 });
  await settle();

  const located = await heldAddress();
  if (!Number.isFinite(located?.latitude)) {
    throw new Error('this account was supposed to have an address with real coordinates');
  }

  const capeTown = await blocker();
  console.log(`\n  V&A Waterfront says: ${capeTown ?? '(nothing — the order can be placed)'}`);
  if (!capeTown || !/does not deliver/i.test(capeTown)) {
    throw new Error(
      'a Johannesburg address was offered delivery from the V&A Waterfront — the ' +
        'radius rule has stopped biting where the app does know the coordinates',
    );
  }
  step('an address the app has located is refused when it is out of range');

  // ---- and the case it cannot know: an address typed in by hand ----
  await tapText('Delivering to');
  await page.waitForURL(/checkout\/address/, { timeout: 15000 });
  await settle();
  await tap('address-add');
  await page.waitForTimeout(700);

  const type = (placeholder, value) =>
    page.getByPlaceholder(placeholder, { exact: false }).first().fill(value);
  await type('Home, Work', NEAR_SANDTON.label);
  await type('14 Acacia Road', NEAR_SANDTON.line1);
  await type('Melrose Arch', NEAR_SANDTON.suburb);
  await type('Johannesburg', NEAR_SANDTON.city);
  await type('2196', NEAR_SANDTON.postalCode);
  await type('Gauteng', NEAR_SANDTON.province);
  await tap('address-save');
  await settle();

  const typed = await heldAddress();
  if (!typed || typed.suburb !== NEAR_SANDTON.suburb) {
    throw new Error('the address the customer typed was not the one the app kept');
  }
  step(`typed in ${typed.line1}, ${typed.suburb}`);

  /**
   * A coordinate the app was never given is the whole story, so read it.
   *
   * While the form stamped `DEFAULT_COORDINATES` on, this came back as the
   * Johannesburg CBD for an address in Sandhurst — and would have come back as
   * the Johannesburg CBD for an address in Cape Town too.
   */
  const invented =
    Math.abs((typed.latitude ?? NaN) - CBD.latitude) < 0.0001 &&
    Math.abs((typed.longitude ?? NaN) - CBD.longitude) < 0.0001;
  if (invented) {
    findings.push(
      'the typed address was stamped with the Johannesburg CBD — the app decides ' +
        'where this customer lives from a constant',
    );
    console.log('  ✗ stamped with the Johannesburg CBD');
  } else {
    step('the app did not invent a coordinate for an address it cannot locate');
  }

  // Back out of the address screen, then pick the branch it is nearest to.
  await page.goBack();
  await settle();
  await tapText('Cooked at');
  await page.waitForURL(/checkout\/store/, { timeout: 15000 });
  await settle();
  await tap('store-card-store-sandton');
  await page.waitForURL((url) => !url.pathname.includes('/store'), { timeout: 15000 });
  await settle();

  const why = await blocker();
  console.log(`  Sandton City says: ${why ?? '(nothing — the order can be placed)'}`);

  if (why && /does not deliver/i.test(why)) {
    findings.push(
      `refused an address it has never located: "${why}" — Maude Street runs past ` +
        'that branch, and the app has no way of knowing otherwise either way',
    );
    console.log('  ✗ refused on a distance it cannot know');
  } else {
    step('an address the app cannot locate is not refused on distance');
  }

  await context.close();
} catch (error) {
  failed = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
  server.close();
}

if (failed) {
  console.log(`\n✗ the journey could not be driven: ${failed}\n`);
  console.log('Reached:');
  for (const done of steps) console.log(`  ✓ ${done}`);
  process.exit(1);
}

if (findings.length > 0) {
  console.log(`\n${findings.length} wrong answer(s) about where a customer lives:\n`);
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(
    '\nAn address the app has never located is not an address at the default\n' +
      'coordinate. Not knowing is a third answer, and the one that is true.',
  );
  process.exit(1);
}

console.log('\nA typed-in address is neither located nor pretended to be located.');
process.exit(0);
