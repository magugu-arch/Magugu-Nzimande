#!/usr/bin/env node
/**
 * Render every screen and look for what a test suite cannot see.
 *
 * The app targets web as well as native, so the whole thing can be loaded in a
 * headless browser and driven for real. React Native Web is not a device —
 * gestures, haptics, push and native scrolling all differ — but layout,
 * typography and flow are honest, and that is where the defects were: a
 * wrapping CTA, a clipped tab label, a banner covering every screen title, a
 * memo that left checkout permanently disabled. None of those failed a test.
 *
 * Checks, per route, at both a normal and a narrow phone width:
 *   · the page never scrolls sideways, and nothing sits past the right edge
 *     (carousels excluded — they are supposed to)
 *   · the screen rendered something, and the content routes rendered the
 *     data they exist to show — not just an empty state
 *   · no console errors or uncaught exceptions
 *   · §32.6: every interactive element has an accessible name, every focusable
 *     one shows a visible focus ring, and every control with a state says what
 *     it is — a switch that never announces on or off is a switch a screen
 *     reader cannot use
 *   · no control is nested inside another — invalid HTML, and ambiguous to a
 *     screen reader. Checked structurally, because this runs against a release
 *     build where React's own warning about it is compiled out
 *
 * Needs Playwright's Chromium once: npx playwright install chromium
 * On a machine that already has one (a CI image, a sandbox), point at it with
 * CHROMIUM_PATH instead of downloading a second copy.
 *
 * Run: npm run audit:screens
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-web');
const PORT = 8123;

const ROUTES = [
  '/welcome', '/location', '/sign-in', '/register', '/verify', '/forgot-password',
  // Both states of the reset-link landing: the form, and what somebody sees
  // when the link arrived truncated. Only reachable from an email, so nothing
  // else in the app renders it.
  '/reset-password?token=probe-token', '/reset-password',
  '/home', '/menu', '/rewards', '/orders', '/more',
  '/product/golden-original', '/cart', '/checkout', '/checkout/store',
  '/checkout/address', '/checkout/schedule', '/offers', '/rewards/vouchers',
  '/account/profile', '/account/preferences', '/account/notifications',
  '/account/payment-methods', '/account/contact', '/account/help', '/account/legal',
  // Tracking needs an order to track, so these were missing from the sweep
  // until the seeded ledger was noticed: `fetchOrder` seeds on first call, so
  // both are reachable cold. 4821 is a delivery and 4610 a collection, which
  // is the branch that decides whether the store rows render.
  '/order/order-4821', '/order/order-4610', '/order/order-4610/rate',
  // The states the seed never produced until now, and so the sweep never saw:
  // a cancelled order (grey card, warning badge), a dine-in order carrying a
  // table number, and a scheduled order where "ordered at" and "due at" differ.
  '/order/order-4788', '/order/order-4802', '/order/order-4655',
  // A kids meal, which is a product shape the sweep had no example of: every
  // one of its option groups is required and priced at zero, because the drink
  // and the dip are part of the meal rather than additions to it. The picker
  // renders a price delta beside each option everywhere else.
  '/product/little-crunch-chicken-meal',
  // The offer detail screen, in both states the seed can now produce. It was
  // never swept: only the list was, and the list cannot render either of
  // these. `promo-heritage-braai` is a campaign that closed, which is the one
  // somebody reaches from an old push notification or a forwarded link.
  '/offers/promo-free-delivery', '/offers/promo-heritage-braai',
  '/offers/promo-sweet-potato-launch',
  // An order that is actually happening. The seed had four completed and one
  // cancelled, so the Orders tab's Active list was empty by construction and
  // no sweep had ever rendered a driver, a moving progress bar or an estimate
  // with time left on it.
  '/order/order-4830',
  // The birthday reward, in the month it is supposed to unlock. The seeded
  // date of birth was fixed, so eleven months in twelve this screen was
  // correctly locked — and the twelfth would have been locked too, because
  // the whole category was excluded from redeemability.
  '/rewards/reward-birthday',
  // The one product in the catalogue that declares no allergens. Its screen
  // used to draw the whole allergen block — the shared-kitchen notice
  // included — only when there was something to list, so this was the one
  // product shown nothing at all.
  '/product/sweet-potato-fries',
  // An order that used a voucher *and* a reward. Five seeded orders carried
  // one or the other and never both, so the receipt had never drawn the two
  // discount lines together — and they are separate money.
  '/order/order-4795',
  // A courier that gave up, and the states nothing had produced cold: a
  // delivery reported FAILED, and a nine-line collection order sitting on the
  // counter at `ready`. The second is also the widest basket the sweep has,
  // which is what makes 320pt worth checking on it.
  '/order/order-4840', '/order/order-4842',
  // A product the kitchen has run out of. Every one of the 28 was available,
  // so the menu, the card grid and this screen had never drawn the other case.
  '/product/rose-ddeok-bokki',
  // A dine-in order in flight, which the seed had only ever had `completed`.
  // The table number and the directions rule both hang off it.
  '/order/order-4844',
  // The last rung of the sequence, carrying a note at the 200-character cap
  // that every screen used to clamp to a fifth of itself.
  '/order/order-4846',
  // A finished order whose only product has since been withdrawn, so "Order
  // this again" has nothing to add.
  '/order/order-4838',
  // A product still marked available whose one required group has emptied.
  '/product/cheesling-fries',
];

/** Screens worth tabbing through; they cover every interactive primitive. */
/**
 * Where the *expensive* accessibility check runs.
 *
 * Only the focus-ring probe is slow: it focuses up to thirty elements a route
 * and reads the computed style back each time. The rest of `a11yProbe` is a
 * couple of DOM reads and now runs on all 29 routes.
 *
 * It used to be all of it, on these three. That is how the README came to say
 * "every pressable clears the 44pt minimum touch target" while six did not —
 * the quantity stepper on every cart line, the "See all" links on Home, the
 * store row, the product screen's back button, the menu's search suggestions
 * and the map pins. None of those screens was ever looked at. A check that
 * covers a tenth of the app reads exactly like one that covers all of it.
 */
const FOCUS_RING_ROUTES = ['/menu', '/sign-in', '/account/preferences'];

/**
 * What each content-bearing route must actually be showing.
 *
 * The blank check below only asks whether *some* text rendered, and an empty
 * state is plenty of text. That gap was found by accident: turning the mock
 * layer off left every screen with no data at all — an empty menu, an empty
 * rewards page — and this sweep called all 29 routes clean. It was verifying
 * that screens laid out, never that they had anything in them.
 *
 * Deliberately a handful of routes, not all of them. These are the ones whose
 * whole purpose is to show data that came from somewhere.
 */
const MUST_SHOW = {
  '/menu': /Golden Original|Soy Garlic|Half & Half/,
  '/home': /Golden Original|Soy Garlic|Wings|Chicken/,
  '/product/golden-original': /R\s?\d/,
  // /orders can be asserted now. It used to open on an Active tab that a cold
  // app left empty — every seeded order was finished — so an empty list was
  // the correct screen and asserting a reference here would have been
  // asserting a bug. The seed carries a live order, so the tab has something
  // to show and the card that shows it is worth checking.
  '/orders': /BBQ-4830/,
  // The reference, and the note the customer typed. `specialInstructions` was
  // drawn on the cart row and again in the checkout review, then dropped by
  // the receipt — the app showed somebody their own words at every step up to
  // the moment they paid, and then they were gone from the only record kept.
  '/order/order-4821': /BBQ-4821[\s\S]*Extra crispy please/,
  // Live tracking, with the courier on it. Both halves matter: the status
  // sentence promises a driver, and the card underneath has to name one. The
  // note is asserted here too because this is the order where one matters —
  // somebody watching a courier approach, checking what they asked for.
  '/order/order-4830': /Out for delivery[\s\S]*Easy on the chilli/,
  '/rewards': /\d+\s*(points|pts)|Gold|Silver|Bronze/i,
  // Unlocked, in the seeded customer's birthday month. If this ever reads
  // "Not enough points yet" again, the gate has gone back to excluding the
  // category — and it would be saying it about a reward that costs nothing.
  '/rewards/reward-birthday': /It is your birthday month/,
  '/offers': /R\s?\d|%/,
  '/offers/promo-free-delivery': /Free delivery|Terms and conditions/,
  // The point of the fixture: a promotion outside its window is refused, and
  // the screen says so in those words rather than in the app's generic "we
  // could not load that". If this ever reads as a failed fetch again, the
  // not-found plumbing under it has come apart.
  '/offers/promo-heritage-braai': /That offer has ended/,
  // And the other direction, which is the one that read as a lie: a campaign
  // that opens in twelve days must not be described as finished.
  '/offers/promo-sweet-potato-launch': /hasn't started yet/,
  // Both halves. The kitchen notice is the one that matters and the one that
  // used to disappear; "not confirmed" is what the screen is entitled to say
  // in place of a list it does not have.
  // Both notices on one product, which is the point of it. Its allergen list
  // is empty and its nutrition figures are absent, and until now only the
  // first of those said so — the nutrition panel simply vanished. One item,
  // two datasets the franchise has not confirmed, and one of them silent.
  '/product/sweet-potato-fries':
    /kitchen that handles other allergens[\s\S]*Nutritional information for this item is not confirmed/,
  // The fourth notification category, which the seed never had. Its row has
  // no destination, and every row used to be drawn as a pressable card — so
  // this was a button that did nothing. The sweep's own §32.6 pass is what
  // would catch a control with no accessible name; this asserts the row is
  // there at all.
  // Two shapes in one list: an advisory with no artwork, and a promotion with
  // a photograph on it. The second is what the row had no room for at all.
  '/account/notifications': /Load-shedding[\s\S]*Wings, four ways|Wings, four ways[\s\S]*Load-shedding/,
  // Both discount lines, attributed to the two different things that produced
  // them. A receipt that lumped them together would lose which was which.
  '/order/order-4795': /Promo · WELCOME50[\s\S]*Reward ·/,
  // A courier that gave up. `FAILED` was in the type and the mock walked
  // straight from ON_THE_WAY to DELIVERED, so nothing had ever reported one:
  // the hero went on reading "Out for delivery · Your driver has collected the
  // order and is on the way" with an estimate counting down, about food going
  // back to the store. Both halves are asserted — the heading, and the courier
  // card that used to print "the progress below is updated as your order
  // moves" over a journey that had stopped.
  '/order/order-4840': /Delivery unsuccessful[\s\S]*could not complete this delivery/,
  // Nine lines and a status the ledger had never held cold. "Ready for
  // collection" is the heading, not "Ready": the timeline three lines below
  // has said the longer phrase since it was written, and the hero used to say
  // the vaguer one. Chicken Burger is the ninth line, so asserting it proves
  // the whole basket rendered.
  '/order/order-4842': /Ready for collection[\s\S]*Chicken Burger/,
  // A product the kitchen has run out of. `Product.available` was read only by
  // `reorder` and `reconcileCart`, so this screen offered "Add to cart R
  // 82.00" for a dish nobody can cook.
  '/product/rose-ddeok-bokki': /Sold out[\s\S]*cannot be added to your basket/,
  // The table, which used to live on the confirmation screen alone — seen once,
  // immediately after paying, and gone by the time somebody at the table
  // looked again. "Ready at your table" is the dine-in branch of
  // `readyLabelFor`, which no seeded order had ever reached either.
  '/order/order-4844': /Ready at your table[\s\S]*Table 14/,
  // The whole note, not the first fifth of it. At 320pt the receipt showed 57
  // pixels of 285, cut mid-word with no ellipsis.
  '/order/order-4846': /Driver assigned[\s\S]*sat in the hut all evening/,
  '/order/order-4838': /BBQ-4838[\s\S]*Rose Ddeok-Bokki/,
  // Available, and unorderable: a till marks options out, not products, and
  // the button used to ask for a size on a screen where none could be chosen.
  '/product/cheesling-fries': /Sold out[\s\S]*Every choice under "Size" is sold out/,
};

/**
 * Copy that means a screen gave up, as opposed to a screen with nothing in it
 * yet. Only genuine error states: "Nothing here yet" belongs to an empty
 * notifications list on a cold app, which is correct, and the menu's own empty
 * case is already covered by MUST_SHOW above.
 */
const FAILURE_COPY = /Something went wrong|Our kitchen is having a moment|We can't reach bb\.q/;

const WIDTHS = [390, 320];

const TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf',
  '.ico': 'image/x-icon', '.json': 'application/json', '.svg': 'image/svg+xml',
};

function serve() {
  // app.json sets web output to "single", so every route falls back to
  // index.html and the router takes it from there.
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(OUT, pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(OUT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const probe = (viewportWidth) => {
  const inScroller = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX;
      if (o === 'scroll' || o === 'auto') return true;
    }
    return false;
  };

  const past = [];
  for (const el of document.querySelectorAll('div,span,p,button,input')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || inScroller(el)) continue;
    if (r.right > viewportWidth + 1 && r.left < viewportWidth) {
      const txt = (el.textContent ?? '').trim().slice(0, 40);
      if (txt) past.push({ px: Math.round(r.right - viewportWidth), txt });
    }
  }
  const seen = new Set();
  return {
    scrollsSideways: Math.max(0, document.documentElement.scrollWidth - viewportWidth),
    past: past.filter((c) => !seen.has(c.txt) && seen.add(c.txt)).sort((a, b) => b.px - a.px).slice(0, 3),
    blank: (document.body.innerText ?? '').trim().length < 12,
    text: (document.body.innerText ?? '').trim(),
    // Measured, not read. The banner's copy sits in the DOM at all times and
    // is hidden by animating this container to zero height, so any check
    // against `innerText` reports it showing on every route forever — which
    // is exactly the wrong answer, and the one I got the first time I looked.
    offlineBannerPx: Math.round(
      document.querySelector('[data-testid="offline-banner"]')?.getBoundingClientRect().height ?? 0,
    ),
  };
};

const a11yProbe = (checkFocusRings) => {
  const visibleOnly = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  /**
   * Whether assistive tech and a thumb both skip this.
   *
   * Some components draw a control and hand its behaviour to a wrapper. `Toggle`
   * does: the row is the switch, and the `Switch` inside it only paints the
   * state — hidden with `aria-hidden` and made untappable with
   * `pointerEvents="none"`. React Native Web renders that as a real
   * `<input role="switch">` all the same, so a flat `querySelectorAll` finds a
   * second, unnamed switch that nobody can reach.
   *
   * Both conditions, never one. `aria-hidden` alone on something a thumb can
   * still press is not a decoration, it is a control that screen-reader users
   * cannot find — so that stays a finding, below.
   */
  const decorative = (el) =>
    el.closest('[aria-hidden="true"]') !== null && getComputedStyle(el).pointerEvents === 'none';

  const unnamed = [];
  const hiddenButLive = [];
  const all = [
    ...document.querySelectorAll('[role="button"],[role="tab"],[role="link"],[role="switch"],button,input,a'),
  ].filter(visibleOnly);

  for (const el of all) {
    if (el.closest('[aria-hidden="true"]') === null) continue;
    if (getComputedStyle(el).pointerEvents === 'none') continue;
    hiddenButLive.push(
      (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName.toLowerCase()).trim().slice(0, 32),
    );
  }

  const interactive = all.filter((el) => !decorative(el));
  for (const el of interactive) {
    const name =
      el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? (el.textContent ?? '').trim();
    if (!name) unnamed.push(el.getAttribute('role') ?? el.tagName.toLowerCase());
  }

  /**
   * A control that has a state, saying what it is.
   *
   * The README claimed this was measured here. It was not: this probe checked
   * names and focus rings, and the app expressed state only through React
   * Native's `accessibilityState`, which React Native Web 0.21 does not map. So
   * every switch on `/account/preferences` announced "Order updates, switch"
   * and never whether order updates were on — before or after being toggled —
   * and the whole screen carried zero state attributes.
   *
   * A role with a required state and no attribute to carry it is the defect.
   * `aria-selected` is checked the other way round, because it is only
   * meaningful on a few roles and is worse than silence anywhere else.
   */
  const REQUIRED_STATE = {
    switch: 'aria-checked',
    radio: 'aria-checked',
    checkbox: 'aria-checked',
    tab: 'aria-selected',
  };
  const SELECTABLE = ['tab', 'option', 'row', 'gridcell', 'treeitem'];

  const stateless = [];
  const misstated = [];
  for (const el of interactive) {
    const role = el.getAttribute('role');
    const needs = role ? REQUIRED_STATE[role] : undefined;
    const label = (el.getAttribute('aria-label') ?? el.textContent ?? role ?? '').trim().slice(0, 32);
    if (needs && !el.hasAttribute(needs)) stateless.push(`${role} "${label}" has no ${needs}`);
    if (el.hasAttribute('aria-selected') && !SELECTABLE.includes(role ?? '')) {
      misstated.push(`${role ?? el.tagName.toLowerCase()} "${label}" carries aria-selected`);
    }
  }

  /**
   * One control inside another.
   *
   * `<button>` inside `<button>` is invalid HTML, and a screen reader has the
   * parser's problem: two controls at one position and no way to say which a
   * tap meant. It is easy to write, because a `Pressable` inside a `Pressable`
   * is ordinary in React Native and only becomes illegal once React Native Web
   * compiles both to buttons — which is how the menu shipped with every product
   * row wrapping its own favourite heart.
   *
   * Checked structurally rather than by listening for React's warning about it,
   * because this sweep runs against `expo export` — a release build, where
   * those warnings are compiled out. The console this sweep watches is not the
   * console that would have told us.
   */
  const nested = [];
  for (const el of interactive) {
    const inner = [
      ...el.querySelectorAll('[role="button"],[role="tab"],[role="link"],[role="switch"],button,input,a[href]'),
    ].filter((child) => visibleOnly(child) && !decorative(child));
    for (const child of inner) {
      nested.push(
        `${(el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 28)} ` +
          `contains ${(child.getAttribute('aria-label') ?? child.textContent ?? child.tagName).trim().slice(0, 28)}`,
      );
    }
  }

  const focusable = [
    ...document.querySelectorAll('[tabindex]:not([tabindex="-1"]),button,input,a[href]'),
  ]
    .filter(visibleOnly)
    .filter((el) => !decorative(el));
  const noRing = [];
  for (const el of checkFocusRings ? focusable.slice(0, 30) : []) {
    el.focus();
    const active = document.activeElement;
    if (!active || active === document.body) continue;
    const cs = getComputedStyle(active);
    const ring =
      (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
    if (!ring) {
      noRing.push((active.getAttribute('aria-label') ?? active.textContent ?? '?').trim().slice(0, 28));
    }
    active.blur?.();
  }
  /**
   * §22.9: 44x44, measured rather than asserted.
   *
   * The README said every pressable cleared it. Six did not, and they were the
   * ones people tap most: the quantity stepper on every cart line (38, and
   * "decrease" is "remove" when the line holds one), the "See all" links on
   * Home (19), the store row that chooses which branch cooks the food (35), the
   * back button on the product screen (40), the menu's search suggestions (31),
   * and the pins on the store map (32).
   *
   * `hitSlop` is honoured on a handset and is a no-op in React Native Web, so
   * the box measured here is the whole target on the web build and only part of
   * it on a phone. Rather than keep a list of which small boxes are fine — a
   * list that stops matching the code and then passes — the controls that
   * compensate say so in `data-slop-x` / `data-slop-y`, and this does the
   * arithmetic. A new small control that compensates declares it; one that does
   * not, fails.
   */
  const small = [];
  const seen = new Set();
  for (const el of interactive) {
    const rect = el.getBoundingClientRect();
    const slopX = Number(el.dataset.slopX ?? 0);
    const slopY = Number(el.dataset.slopY ?? 0);
    const width = rect.width + 2 * (Number.isFinite(slopX) ? slopX : 0);
    const height = rect.height + 2 * (Number.isFinite(slopY) ? slopY : 0);
    if (width >= 44 && height >= 44) continue;

    const label = (el.getAttribute('aria-label') ?? el.textContent ?? '?').trim().slice(0, 40);
    const key = `${label}|${Math.round(width)}x${Math.round(height)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    small.push({ label, w: Math.round(width), h: Math.round(height) });
  }

  return { unnamed, noRing, small, hiddenButLive, nested, stateless, misstated, focusableCount: focusable.length };
};

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed.\n' +
      '  npm i -D playwright && npx playwright install chromium',
  );
  process.exit(2);
}

console.log('Building the web bundle…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  // `expo export` is a release build, where the mock layer is off by default.
  // This sweep has no backend to talk to, so it asks for the mock by name —
  // the same thing eas.json's preview profile does, and for the same reason.
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1' },
});

const server = await serve();
// A provisioned image usually has a Chromium already, and its build number
// rarely matches the one this Playwright wants to fetch.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const findings = [];

try {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: width === 320 ? 568 : 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();

    let errors = [];
    page.on('pageerror', (e) => errors.push('uncaught: ' + String(e).slice(0, 120)));
    page.on('console', (m) => {
      const t = m.text();
      if (m.type() === 'error' && !t.includes('Failed to load resource')) errors.push(t.slice(0, 120));
    });

    /**
     * Signed in before the sweep starts, because that is who these screens are
     * for.
     *
     * This used to walk the whole app as an unauthenticated visitor and assert
     * that /rewards showed a points balance — which passed only because the
     * app was handing the seeded customer's rewards, addresses and cards to
     * anybody who had not signed in. The audit was asserting the bug. Once
     * that was fixed the assertion failed, correctly, and the fix is here
     * rather than in a looser expectation: an account screen swept in its
     * signed-out state is not the screen anybody uses.
     */
    await page.goto(`http://localhost:${PORT}/sign-in`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.locator('[data-testid="sign-in-email"]').fill('sweep@example.co.za');
    await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
    await page.locator('[data-testid="sign-in-submit"]').first().click({ timeout: 15000 });
    await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'), { timeout: 20000 });
    await page.waitForTimeout(1200);
    await page
      .getByText('Not now', { exact: false })
      .first()
      .click({ timeout: 5000 })
      .catch(() => {});
    errors = [];

    for (const route of ROUTES) {
      errors = [];
      try {
        await page.goto(`http://localhost:${PORT}${route}`, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });
      } catch {
        findings.push(`${route} @${width} — did not finish loading`);
        continue;
      }
      await page.waitForTimeout(700);

      const r = await page.evaluate(probe, width);
      if (r.blank) findings.push(`${route} @${width} — rendered almost no text`);
      // This sweep runs on the mock layer, where the app is served entirely
      // from the device — so an offline bar is always a wrong claim, and it
      // eats the bottom of every screen while it makes it. It sat open on all
      // 29 routes for weeks: the reachability probe pointed at an API host
      // that does not answer yet, and nothing here was looking.
      if (r.offlineBannerPx > 2) {
        findings.push(
          `${route} @${width} — offline bar showing (${r.offlineBannerPx}px) on a mock build`,
        );
      }
      if (r.scrollsSideways) {
        findings.push(`${route} @${width} — page scrolls ${r.scrollsSideways}px sideways`);
      }
      for (const c of r.past) findings.push(`${route} @${width} — "${c.txt}" sits ${c.px}px past the edge`);

      // Laid out is not the same as populated. A screen full of empty states
      // passes every check above.
      const expected = MUST_SHOW[route];
      if (expected && !expected.test(r.text)) {
        findings.push(`${route} @${width} — rendered, but shows no ${expected.source.split('|')[0]}`);
      }
      const failure = FAILURE_COPY.exec(r.text);
      if (failure) findings.push(`${route} @${width} — shows "${failure[0]}"`);
      for (const e of [...new Set(errors)]) findings.push(`${route} @${width} — ${e}`);

      if (width === WIDTHS[0]) {
        const a = await page.evaluate(a11yProbe, FOCUS_RING_ROUTES.includes(route));
        for (const u of a.unnamed) findings.push(`${route} — ${u} has no accessible name (§32.6)`);
        for (const n of a.noRing) findings.push(`${route} — "${n}" has no visible focus ring (§32.6)`);
        for (const h of a.hiddenButLive) {
          findings.push(
            `${route} — "${h}" is hidden from a screen reader but still takes taps (§32.6)`,
          );
        }
        for (const t of a.small) {
          findings.push(
            `${route} — "${t.label}" is ${t.w}x${t.h} to a thumb, under the 44x44 of §22.9`,
          );
        }
        for (const n of a.nested) {
          findings.push(`${route} — nested control: ${n} (invalid HTML, ambiguous to a reader)`);
        }
        for (const s of a.stateless) findings.push(`${route} — ${s} (§32.6)`);
        for (const m of a.misstated) {
          findings.push(`${route} — ${m}, which means nothing on that role (§32.6)`);
        }
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\nSwept ${ROUTES.length} routes at ${WIDTHS.join('pt and ')}pt.`);
if (findings.length === 0) {
  console.log(
  'No overflow, no blank screens, no console errors, no accessibility gaps,\n' +
    'and every tappable thing clears 44x44 once its declared slop is counted.',
);
  process.exit(0);
}
console.log(`\n${findings.length} finding(s):\n`);
for (const f of findings) console.log(`  ${f}`);
process.exit(1);
