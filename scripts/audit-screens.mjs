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
 *   · §32.6: every interactive element has an accessible name, and every
 *     focusable one shows a visible focus ring
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
];

/** Screens worth tabbing through; they cover every interactive primitive. */
const A11Y_ROUTES = ['/menu', '/sign-in', '/account/preferences'];

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
  // Not /orders: it opens on the Active tab, and a cold app has nothing
  // cooking — both seeded orders are completed and sit under Past orders. An
  // empty Active tab is the correct screen, so asserting a reference here
  // would be asserting a bug. /order/order-4821 covers an order rendering.
  '/order/order-4821': /BBQ-4821/,
  '/rewards': /\d+\s*(points|pts)|Gold|Silver|Bronze/i,
  '/offers': /R\s?\d|%/,
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

const a11yProbe = () => {
  const visibleOnly = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const unnamed = [];
  const interactive = [
    ...document.querySelectorAll('[role="button"],[role="tab"],[role="link"],[role="switch"],button,input,a'),
  ].filter(visibleOnly);
  for (const el of interactive) {
    const name =
      el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? (el.textContent ?? '').trim();
    if (!name) unnamed.push(el.getAttribute('role') ?? el.tagName.toLowerCase());
  }

  const focusable = [
    ...document.querySelectorAll('[tabindex]:not([tabindex="-1"]),button,input,a[href]'),
  ].filter(visibleOnly);
  const noRing = [];
  for (const el of focusable.slice(0, 30)) {
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
  return { unnamed, noRing, focusableCount: focusable.length };
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

      if (width === WIDTHS[0] && A11Y_ROUTES.includes(route)) {
        const a = await page.evaluate(a11yProbe);
        for (const u of a.unnamed) findings.push(`${route} — ${u} has no accessible name (§32.6)`);
        for (const n of a.noRing) findings.push(`${route} — "${n}" has no visible focus ring (§32.6)`);
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
  console.log('No overflow, no blank screens, no console errors, no accessibility gaps.');
  process.exit(0);
}
console.log(`\n${findings.length} finding(s):\n`);
for (const f of findings) console.log(`  ${f}`);
process.exit(1);
