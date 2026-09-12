#!/usr/bin/env node
/**
 * The way back.
 *
 * Every sweep in this repository drives the app forwards. A customer does not.
 * They pick a branch and change their mind, they open a push notification
 * straight onto a screen in the middle of checkout, they press Back on the
 * confirmation after paying to see whether it really went through.
 *
 * Three claims in the app are about going back, and nothing had ever tested
 * one of them:
 *
 *   1. `checkout/index.tsx`, beside the tap that takes the money: "clear it
 *      before navigating so back navigation can never resubmit". A comment
 *      about the single most expensive mistake this app could make.
 *   2. `checkout/store.tsx`: `if (router.canGoBack()) router.back(); else
 *      router.replace('/(tabs)/home')` — a screen that knows it might be the
 *      first one the customer sees.
 *   3. `checkout/address.tsx` and `checkout/schedule.tsx`: the same line
 *      *without* the else. Two screens that assume somebody arrived from
 *      somewhere.
 *
 * Nothing had noticed the difference between 2 and 3 because every sweep that
 * visits those screens navigates to them by URL and navigates away by URL —
 * `smoke:order` does exactly that — so the app's own way back is never the
 * thing under test.
 *
 * Cases:
 *
 *   1. a branch chosen on a screen opened cold — the control, which has the
 *      fallback and should pass
 *   2. an address chosen on a screen opened cold
 *   3. a time confirmed on a screen opened cold
 *   4. Back from the confirmation, after the money has moved
 *   5. Back out of the sign-in the app sent them to
 *
 * Cases 2 and 3 are asserted twice over, because "did not navigate" and
 * "nothing happened" are different bugs and only one of them is this one: the
 * choice is read back out of `bbq.fulfilment` as well. A screen that took the
 * customer's answer and then sat there is worse than one that refused it.
 *
 * Run: npm run audit:back
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-back');
const PORT = 8251;
const BASE = `http://localhost:${PORT}`;

/** Lunchtime on a Wednesday, so every branch is open and nothing is scheduled. */
const LUNCHTIME = Date.UTC(2026, 8, 9, 10, 30);

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
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

/*
  The device clock, pinned before any app code runs.

  Copied in shape from `audit:writes` rather than shared, because a sweep that
  imports its fixture from another sweep starts agreeing with it.
*/
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

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium',
  );
  process.exit(2);
}

console.log('Building with the mock layer on, so the journey can be walked…');
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

const here = (page) => new URL(page.url()).pathname;

/** A fresh phone, clock pinned, nothing else assumed. */
async function phone() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Africa/Johannesburg',
  });
  await context.addInitScript(pinClock(LUNCHTIME));
  return context;
}

async function signIn(page) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.locator('[data-testid="sign-in-email"]').fill('back@example.co.za');
  await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
  await page.locator('[data-testid="sign-in-submit"]').first().click({ timeout: 10000 });
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'), { timeout: 20000 });
}

/** The first test id on the page that starts with this prefix. */
const firstIdStartingWith = (page, prefix) =>
  page.evaluate(
    (wanted) =>
      [...document.querySelectorAll('[data-testid]')]
        .map((node) => node.getAttribute('data-testid'))
        .find((id) => id?.startsWith(wanted)) ?? null,
    prefix,
  );

/** What the app has recorded about where and when this order is going. */
const fulfilment = (page) =>
  page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('bbq.fulfilment');
      return raw ? (JSON.parse(raw).state ?? null) : null;
    } catch {
      return null;
    }
  });

/*
  ── Cases 1–3: a screen opened cold ────────────────────────────────────────

  Signed in, with a session, and then sent straight to one screen — which is
  what a deep link does, what a push notification does, and what a browser
  refresh does on the web build. There is no history behind the page, so
  `router.canGoBack()` is false and the screen's own answer to that is the
  whole test.
*/
const COLD = [
  {
    name: 'choosing a branch on a screen opened cold',
    route: '/checkout/store',
    prefix: 'store-card-',
    // The control. This screen has the fallback, so a failure here means the
    // sweep is broken rather than the app.
    control: true,
    took: (state) => state?.store?.id !== undefined && state?.store?.id !== null,
  },
  {
    name: 'choosing an address on a screen opened cold',
    route: '/checkout/address',
    prefix: 'address-card-',
    took: (state) => state?.address?.id !== undefined && state?.address?.id !== null,
  },
];

try {
  for (const testCase of COLD) {
    const context = await phone();
    const page = await context.newPage();
    const crashes = [];
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 120)));

    await signIn(page);

    /*
      A fresh page in a fresh context, so nothing is behind it.

      Signing in above happens on another page of the same context: the
      session is in storage, and this one opens with an empty history. Doing
      both on one page would leave `/sign-in` behind it and `canGoBack()` true,
      which is the state this case exists to avoid.
    */
    await page.close();
    const cold = await context.newPage();
    cold.on('pageerror', (error) => crashes.push(String(error).slice(0, 120)));
    await cold.goto(`${BASE}${testCase.route}`, { waitUntil: 'networkidle', timeout: 45000 });
    await cold.waitForTimeout(2500);

    const target = await firstIdStartingWith(cold, testCase.prefix);
    let acted = target !== null;
    if (target) {
      await cold
        .locator(`[data-testid="${target}"]`)
        .first()
        .click({ timeout: 8000 })
        .catch(() => {
          acted = false;
        });
      await cold.waitForTimeout(2500);
    }

    const landed = here(cold);
    const left = landed !== testCase.route;
    const state = await fulfilment(cold);
    const recorded = testCase.took(state);

    if (!acted) {
      findings.push(
        `${testCase.name}: nothing on the screen to choose (no ${testCase.prefix}…), ` +
          `so this case proved nothing`,
      );
    } else if (!left) {
      findings.push(
        recorded
          ? `${testCase.name}: the app recorded the choice and left the customer on ` +
              `${landed} with no sign it had. There is no history behind this screen, so ` +
              `Back does nothing — the screen needs the fallback ${testCase.route === '/checkout/store' ? '' : '`checkout/store.tsx` already has'}.`
          : `${testCase.name}: the tap did nothing at all — still on ${landed}, and nothing recorded.`,
      );
    }
    if (crashes.length > 0) {
      findings.push(`${testCase.name}: crashed the screen — ${crashes[0]}`);
    }

    rows.push({
      name: testCase.name,
      ok: acted && left && crashes.length === 0,
      note: left ? `went to ${landed}` : recorded ? 'recorded, and stayed put' : 'nothing happened',
    });
    await context.close();
  }

  /*
    ── Case 3: the same screen, reached the way a customer reaches it ────────

    The schedule screen is only offered from checkout, so its cold case needs
    a basket and a branch first — otherwise it renders its own empty state and
    the confirm button is never there to press. Driven separately for that
    reason rather than being bent into the loop above.
  */
  {
    const name = 'confirming a time on a screen opened cold';
    const context = await phone();
    const page = await context.newPage();
    const crashes = [];
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 120)));

    await signIn(page);
    await page.goto(`${BASE}/checkout/store`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);
    const store = await firstIdStartingWith(page, 'store-card-');
    if (store) {
      await page
        .locator(`[data-testid="${store}"]`)
        .first()
        .click({ timeout: 8000 })
        .catch(() => {});
    }
    await page.waitForTimeout(1500);
    await page.close();

    const cold = await context.newPage();
    cold.on('pageerror', (error) => crashes.push(String(error).slice(0, 120)));
    await cold.goto(`${BASE}/checkout/schedule`, { waitUntil: 'networkidle', timeout: 45000 });
    await cold.waitForTimeout(2500);

    let acted = true;
    await cold
      .locator('[data-testid="schedule-confirm"]')
      .first()
      .click({ timeout: 8000 })
      .catch(() => {
        acted = false;
      });
    await cold.waitForTimeout(2500);

    const landed = here(cold);
    const left = landed !== '/checkout/schedule';

    if (!acted) {
      findings.push(`${name}: could not reach its own confirm button, so this case proved nothing`);
    } else if (!left) {
      findings.push(
        `${name}: the time was confirmed and the customer was left on ${landed}. ` +
          `There is no history behind this screen, so Back does nothing.`,
      );
    }
    if (crashes.length > 0) findings.push(`${name}: crashed the screen — ${crashes[0]}`);

    rows.push({ name, ok: acted && left && crashes.length === 0, note: `ended on ${landed}` });
    await context.close();
  }

  /*
    ── Case 4: Back from the confirmation, after the money has moved ─────────

    The claim under test is a comment in `checkout/index.tsx`: the basket is
    cleared "before navigating so back navigation can never resubmit". The
    navigation is a `replace`, so Back from the confirmation goes to whatever
    was before checkout — and if the basket were still there, that screen would
    be a fully armed checkout for an order already paid for.
  */
  {
    const name = 'Back from the confirmation, after paying';
    const context = await phone();
    const page = await context.newPage();
    const crashes = [];
    const orders = [];
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 120)));

    await signIn(page);

    await page.goto(`${BASE}/menu`, { waitUntil: 'networkidle', timeout: 45000 });
    await page
      .getByText('Golden Original Chicken', { exact: false })
      .first()
      .click({ timeout: 10000 });
    await page.waitForURL(/product\//, { timeout: 15000 });
    await page.locator('[data-testid="product-add-to-cart"]').first().click({ timeout: 10000 });
    await page.waitForTimeout(1000);

    await page.goto(`${BASE}/checkout/address`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500);
    const address = await firstIdStartingWith(page, 'address-card-');
    if (address) {
      await page
        .locator(`[data-testid="${address}"]`)
        .first()
        .click({ timeout: 8000 })
        .catch(() => {});
    }

    await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);

    let paid = true;
    await page
      .locator('[data-testid="checkout-place-order"]')
      .first()
      .click({ timeout: 10000 })
      .catch(() => {
        paid = false;
      });
    if (paid) {
      await page.waitForURL(/confirmation/, { timeout: 30000 }).catch(() => {
        paid = false;
      });
    }

    const reference = paid ? /BBQ-\d+/.exec(await page.locator('body').innerText())?.[0] : null;
    if (reference) orders.push(reference);

    let armed = null;
    let landed = null;
    if (paid) {
      await page.goBack({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);
      landed = here(page);

      /*
        Armed means: the button is there and the app would let them press it.
        `aria-disabled` is how this app says no on that control — checked
        rather than assumed, because a button that is present and refuses is a
        perfectly safe screen to land on and a finding would be noise.
      */
      armed = await page.evaluate(() => {
        const button = document.querySelector('[data-testid="checkout-place-order"]');
        if (button === null) return false;
        return button.getAttribute('aria-disabled') !== 'true';
      });
    }

    if (!paid) {
      findings.push(`${name}: could not place an order at all, so this case proved nothing`);
    } else if (armed) {
      findings.push(
        `${name}: Back landed on ${landed} with the place-order button live — the order ` +
          `${reference ?? 'just paid for'} could be placed a second time`,
      );
    }
    if (crashes.length > 0) findings.push(`${name}: crashed the screen — ${crashes[0]}`);

    rows.push({
      name,
      ok: paid && armed === false && crashes.length === 0,
      note: paid ? `Back went to ${landed}${armed ? ', armed' : ', nothing to press'}` : 'no order',
    });
    await context.close();
  }

  /*
    ── Cases 5–7: the buttons that went nowhere ─────────────────────────────

    `audit:back` found the missing fallback on two checkout screens; a grep for
    the same line found four more, and the widest was `ScreenHeader` — the back
    arrow at the top of every stack screen in the app, drawn and labelled and
    inert on any screen opened cold.

    The fix follows the sweep, and wherever the sweep never went the hole
    stayed open. So the sweep goes there now: each of these presses the control
    a customer would press on a screen with nothing behind it, and the only
    thing measured is whether they are still standing on it afterwards.
  */
  const DEAD_BUTTONS = [
    {
      name: 'the back arrow on a screen opened cold',
      route: '/account/help',
      signedIn: false,
      press: (page) => page.getByLabel('Go back').first().click({ timeout: 8000 }),
      why: 'the header arrow is on every stack screen in the app',
    },
    {
      name: 'adding to the basket from a shared link',
      route: '/product/golden-original',
      signedIn: false,
      press: (page) =>
        page.locator('[data-testid="product-add-to-cart"]').first().click({ timeout: 8000 }),
      why: 'a product page is the most-shared screen there is, and every share opens it cold',
      // And the line really did go in, so "did not move" is not "did nothing".
      basket: true,
    },
    {
      name: 'declining to rate an order opened from a notification',
      route: '/order/order-4610/rate',
      signedIn: true,
      press: (page) =>
        page.locator('[data-testid="rate-not-now"]').first().click({ timeout: 8000 }),
      why: 'rating is the one journey that is normally opened cold',
    },
  ];

  for (const testCase of DEAD_BUTTONS) {
    const context = await phone();
    const crashes = [];

    if (testCase.signedIn) {
      const warm = await context.newPage();
      warm.on('pageerror', (error) => crashes.push(String(error).slice(0, 120)));
      await signIn(warm);
      await warm.close();
    }

    const cold = await context.newPage();
    cold.on('pageerror', (error) => crashes.push(String(error).slice(0, 120)));
    await cold.goto(`${BASE}${testCase.route}`, { waitUntil: 'networkidle', timeout: 45000 });
    // The mock service answers with a deliberate delay, and a rating screen has
    // to have its order before it draws anything to press.
    await cold.waitForTimeout(5000);

    let pressed = true;
    await testCase.press(cold).catch(() => {
      pressed = false;
    });
    await cold.waitForTimeout(2500);

    const landed = here(cold);
    const left = landed !== testCase.route;
    const inBasket = testCase.basket
      ? await cold.evaluate(() => {
          try {
            const raw = window.localStorage.getItem('bbq.cart');
            return (JSON.parse(raw ?? '{}').state?.lines ?? []).length > 0;
          } catch {
            return false;
          }
        })
      : null;

    if (!pressed) {
      const text = (await cold.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
      findings.push(
        `${testCase.name}: could not find the control to press, so this proved nothing. ` +
          `Screen reads: ${text.slice(0, 160)}`,
      );
    } else if (!left) {
      findings.push(
        `${testCase.name}: the tap did nothing — still on ${landed}` +
          (inBasket === true ? ', though the item did go into the basket' : '') +
          `. There is no history behind this screen, and ${testCase.why}.`,
      );
    }
    if (crashes.length > 0) findings.push(`${testCase.name}: crashed the screen — ${crashes[0]}`);

    rows.push({
      name: testCase.name,
      ok: pressed && left && crashes.length === 0,
      note: left ? `went to ${landed}` : 'stayed put',
    });
    await context.close();
  }

  /*
    ── Case 8: Back out of the sign-in the app sent them to ──────────────────

    A guest taps into a gated screen, meets `AccountRequired`, and presses
    "Sign in" — which is a `push`. Back has to bring them to the screen they
    wanted, not out of the app and not to a blank one. Ordinary, constant, and
    never driven.
  */
  {
    const name = 'Back out of the sign-in the app offered';
    const context = await phone();
    const page = await context.newPage();
    const crashes = [];
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 120)));

    await page.goto(`${BASE}/account/payment-methods`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    await page.waitForTimeout(2500);

    const gated = await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="payment-methods-signed-out"]')),
    );

    let followed = true;
    await page
      .getByText('Sign in', { exact: true })
      .first()
      .click({ timeout: 8000 })
      .catch(() => {
        followed = false;
      });
    await page.waitForTimeout(2500);
    const atSignIn = /sign-in/.test(here(page));

    await page.goBack({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const back = here(page);

    if (!gated) {
      findings.push(`${name}: a guest was not gated out of payment methods, so this case is moot`);
    } else if (!followed || !atSignIn) {
      findings.push(`${name}: the offer did not lead to sign-in — ended on ${here(page)}`);
    } else if (back !== '/account/payment-methods') {
      findings.push(
        `${name}: Back from sign-in went to ${back}, not the screen they were trying to reach`,
      );
    }
    if (crashes.length > 0) findings.push(`${name}: crashed the screen — ${crashes[0]}`);

    rows.push({
      name,
      ok: gated && followed && atSignIn && back === '/account/payment-methods',
      note: `Back went to ${back}`,
    });
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\ncase');
for (const row of rows) console.log(`  ${row.ok ? '✓' : '✗'} ${row.name.padEnd(46)} ${row.note}`);

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) wrong on the way back.`);
  process.exit(1);
}

console.log(`${rows.length} ways back, and the app handled every one.`);
