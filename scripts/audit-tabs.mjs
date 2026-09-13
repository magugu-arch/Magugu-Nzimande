#!/usr/bin/env node
/**
 * The same customer, in two tabs.
 *
 * Every sweep in this repository has driven one page. That is the right model
 * for a phone and the wrong one for the web build — which is what every
 * preview, every demo and every desktop customer actually uses, and where
 * opening a second tab costs one keystroke.
 *
 * Two tabs of this app share one `localStorage`, and four stores persist into
 * it: the customer, the basket, the chosen branch, the favourites. None of them
 * listens for the other tab. There is no `storage` listener anywhere in `src`,
 * so a tab reads that storage exactly once — at load — and then believes what
 * it read for as long as it stays open.
 *
 * Two consequences, and they are different kinds of bad:
 *
 *   the basket   Tab A pays. The order is placed, the basket is cleared, the
 *                money is gone. Tab B is still holding the basket it loaded,
 *                with a live Pay button under it.
 *
 *   the session  Tab A signs out. The tokens are cleared and the customer is
 *                sent to the sign-in screen. Tab B still shows their name,
 *                their address and their order history — on, for instance, a
 *                shared laptop in an internet café, which is the situation a
 *                sign-out button exists for.
 *
 * Measured from B, and B is never reloaded. A reload would read the new
 * storage and hide the whole question; the point is what an *already open* tab
 * shows somebody who is looking at it.
 *
 * Run: npm run audit:tabs
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { preconditionFailures } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-tabs');
const APP_PORT = 8321;
const BASE = `http://localhost:${APP_PORT}`;

/** Lunchtime on a Wednesday, so every branch is open. */
const LUNCHTIME = Date.UTC(2026, 8, 9, 10, 30);

/**
 * How long the second tab is given to notice.
 *
 * A `storage` event is delivered on the next turn of the other tab's event
 * loop, so this is generous by three orders of magnitude. It is set this high
 * on purpose: a sweep that reported "B did not update" because it looked after
 * 50ms would be a sweep about its own timing.
 */
const NOTICE_MS = 4000;

const TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

function serve() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = path.resolve(OUT, '.' + pathname);
    if (file !== OUT && !file.startsWith(OUT + path.sep)) file = path.join(OUT, 'index.html');
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(OUT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(APP_PORT, '127.0.0.1', () => resolve(server)));
}

const pinClock = (fixed) => `
  (() => {
    const Real = Date;
    const fixed = ${fixed};
    class Pinned extends Real {
      constructor(...args) {
        if (args.length === 0) super(fixed);
        else super(...args);
      }
      static now() { return fixed; }
    }
    globalThis.Date = Pinned;
  })();
`;

/** What the page is showing, in the two terms these cases are about. */
const STATE_PROBE = () => {
  const has = (selector) => document.querySelector(selector) !== null;
  return {
    signInWall: has('[data-testid="account-required"], [data-testid$="-signed-out"]'),
    cartEmpty: has('[data-testid="cart-empty-screen"], [data-testid="cart-empty-state"]'),
    cartLines: document.querySelectorAll('[data-testid^="cart-line-"]').length,
    canPay: has('[data-testid="cart-checkout"], [data-testid="checkout-place-order"]'),
    storedAuth: (() => {
      try {
        const raw = window.localStorage.getItem('bbq.auth');
        return raw === null ? null : (JSON.parse(raw)?.state?.isAuthenticated ?? null);
      } catch {
        return null;
      }
    })(),
  };
};

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium',
  );
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

const findings = [];
const rows = [];

/*
  One context, two pages. That is the whole apparatus.

  A context is one browser profile, so both pages share an origin, a
  `localStorage` and the `storage` events that go with it — exactly two tabs of
  one browser. Two *contexts* would be two different browsers and would prove
  nothing about this.
*/
const context = await browser.newContext({
  viewport: { width: 1100, height: 800 },
  timezoneId: 'Africa/Johannesburg',
});
await context.addInitScript(pinClock(LUNCHTIME));

try {
  const a = await context.newPage();
  const b = await context.newPage();
  const crashes = [];
  for (const page of [a, b]) {
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 160)));
  }

  const go = (page, route) =>
    page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
  const tap = (page, id) =>
    page.locator(`[data-testid="${id}"]`).first().click({ timeout: 10000 });

  // --- one customer, signed in once -------------------------------------

  await go(a, '/sign-in');
  await a.locator('[data-testid="sign-in-email"]').fill('thandi@example.co.za');
  await a.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
  await tap(a, 'sign-in-submit');
  await a.waitForURL((u) => !u.pathname.endsWith('/sign-in'), { timeout: 20000 });

  await go(a, '/product/golden-original');
  await a.waitForTimeout(900);
  await tap(a, 'product-add-to-cart');
  await a.waitForTimeout(600);

  // --- tab B opens the basket, and stays open ---------------------------

  await go(b, '/cart');
  await b.waitForTimeout(1800);

  const before = await b.evaluate(STATE_PROBE);
  for (const failure of await preconditionFailures(b, {
    where: 'the second tab',
    signedIn: true,
  })) {
    findings.push(failure);
  }
  if (before.cartLines === 0) {
    findings.push(
      'the second tab opened on an empty basket, so neither case below could ' +
        'have shown anything. This sweep measured nothing.',
    );
  }

  // --- case 1: tab A pays -----------------------------------------------

  await go(a, '/checkout');
  await a.waitForTimeout(2000);
  const collection = a.locator('[data-testid="fulfilment-collection"]').first();
  if ((await collection.count()) > 0) {
    await collection.click({ timeout: 10000 });
    await a.waitForTimeout(1500);
  }
  await tap(a, 'checkout-place-order');
  await a.waitForURL(/confirmation/, { timeout: 30000 });

  await b.waitForTimeout(NOTICE_MS);
  const afterOrder = await b.evaluate(STATE_PROBE);

  rows.push({
    name: 'tab A places the order',
    should: 'B lets go of the basket it can no longer pay for',
    ok: afterOrder.cartLines === 0 || afterOrder.cartEmpty,
    saw:
      afterOrder.cartLines === 0 || afterOrder.cartEmpty
        ? 'empty, as it now is'
        : `${afterOrder.cartLines} line(s) still shown` +
          (afterOrder.canPay ? ', with a live Pay button' : ''),
  });

  // --- case 2: tab A signs out ------------------------------------------

  /*
    B moves to a screen that has something to say about being signed in.

    `/cart` is not gated — a signed-out customer has a basket too — so it could
    never show a sign-in wall and using it here would have made this case
    unfalsifiable. `/orders` is gated and renders `orders-signed-out`, so there
    is a rendered difference to look for.

    Navigating B is a reload, and that is fine *here*: it happens while the
    session is still live, so B loads as a correctly signed-in tab. The
    question this case asks starts after that.
  */
  await go(b, '/orders');
  await b.waitForTimeout(1800);

  const beforeSignOut = await b.evaluate(STATE_PROBE);
  if (beforeSignOut.signInWall) {
    findings.push(
      'the second tab was already showing the sign-in wall before tab A signed ' +
        'out, so the case below cannot fail. Treat it as unproven.',
    );
  }

  await go(a, '/more');
  await a.waitForTimeout(1500);
  await tap(a, 'more-sign-out');
  await a.waitForTimeout(800);
  const confirm = a.locator('[data-testid="dialog-confirm"]').first();
  if ((await confirm.count()) > 0) {
    await confirm.click({ timeout: 10000 });
  }
  await a.waitForTimeout(2500);

  const signedOutInStorage = await a.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('bbq.auth');
      return raw === null ? true : JSON.parse(raw)?.state?.isAuthenticated !== true;
    } catch {
      return false;
    }
  });
  if (!signedOutInStorage) {
    findings.push(
      'tab A did not actually sign out, so the second case below is about a ' +
        'session that never ended. Treat it as unproven.',
    );
  }

  await b.waitForTimeout(NOTICE_MS);
  const afterSignOut = await b.evaluate(STATE_PROBE);

  /*
    Judged on what B draws, and only on that.

    The first version of this also accepted `storedAuth !== true`, and passed:
    of course it did — that is tab A's write, sitting in the shared storage
    both tabs read. It says nothing about whether B noticed. A check that reads
    the thing the other tab changed, rather than the thing this tab shows, is a
    check that cannot fail for the reason it exists.
  */
  rows.push({
    name: 'tab A signs out',
    should: 'B stops showing a signed-in app',
    ok: afterSignOut.signInWall,
    saw: afterSignOut.signInWall
      ? 'the sign-in wall, as it should'
      : 'still a signed-in app — the customer’s order history, on a screen that ' +
        'needs an account',
  });

  for (const row of rows) {
    if (!row.ok) findings.push(`${row.name}: ${row.saw} — ${row.should}.`);
  }
  if (crashes.length > 0) findings.push(`a tab crashed — ${crashes[0]}`);
} finally {
  await context.close();
  await browser.close();
  server.close();
}

console.log('\nwhat tab A did                  what tab B then showed');
for (const row of rows) {
  console.log(`  ${row.ok ? '✓' : '✗'} ${row.name.padEnd(28)} ${row.saw}`);
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) a second tab is not told.`);
  process.exit(1);
}

console.log('Two tabs of one account agree about the basket and the session.');
