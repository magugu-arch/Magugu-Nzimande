#!/usr/bin/env node
/**
 * The first five minutes, driven as one journey instead of five fragments.
 *
 * Every sweep in this repository starts in the middle. They seed a customer,
 * or navigate straight to the route they are about to measure, because that is
 * the screen they are interested in — correct for each of them, and it leaves
 * the sequence every new customer actually walks completely undriven.
 *
 * Last round `audit:single` opened the app at its own entry point for the first
 * time and the welcome carousel did not work: `index` was fed only by
 * `onMomentumScrollEnd`, which react-native-web never fires for a programmatic
 * scroll, so the headline never moved off slide one and "Get started" never
 * appeared. That bug had shipped in thirty-nine builds. Nothing had opened the
 * screen.
 *
 * The screen after it has still never been opened by anything.
 *
 * So this walks the whole thing, in order, as somebody with empty storage:
 *
 *     splash → welcome carousel → sign-in → continue as guest
 *            → location permission → home
 *
 * and then does the part that cannot be checked from one pass. `postAuthRoute`
 * makes a promise in its own doc — *"Once asked (granted or declined), we never
 * ask again on sign-in and go straight to Home"* — and nothing has ever tested
 * it. A second entry, in the same browser, has to land on Home and not on the
 * permission screen again. A customer asked for their location every single
 * time they open an app is a customer who turns it off.
 *
 * What each case is allowed to conclude:
 *
 *   1. the journey completes, screen by screen, and every step is named — a
 *      stall reports *which* screen it stalled on, because "onboarding is
 *      broken" is not something anybody can act on;
 *   2. the permission screen offers both answers and both of them work — "Use
 *      my location" and "Not now" must each reach Home, since a pre-permission
 *      screen whose decline is a dead end is worse than no screen at all;
 *   3. having answered once, the app does not ask again.
 *
 * Case 3 runs in a context that has already been through case 1, which is the
 * only way to ask the question — a fresh context has nothing to remember.
 *
 * Run: npm run audit:firstrun
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-firstrun');
const APP_PORT = 8371;
const BASE = `http://localhost:${APP_PORT}`;

const LUNCHTIME = Date.UTC(2026, 8, 9, 10, 30);

/**
 * The journey, as a list of what has to be on screen and what to press next.
 *
 * Written as data rather than a script of clicks so a stall names the step it
 * stalled on, and so the order is readable at a glance by somebody deciding
 * whether it is the right order.
 */
const JOURNEY = [
  { name: 'welcome carousel', see: '[data-testid="onboarding-next"]' },
  { name: 'sign-in', see: '[data-testid="sign-in-screen"]', press: '[data-testid="sign-in-guest"]' },
  {
    name: 'location permission',
    see: '[data-testid="location-permission-screen"]',
    press: '[data-testid="location-skip"]',
  },
  { name: 'home', see: '[data-testid="home-screen"], [data-testid="tab-bar"]' },
];

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

/** Wait for a selector by polling, and say what was on screen if it never came. */
async function waitFor(page, selector, ms = 15000) {
  for (let waited = 0; waited < ms; waited += 200) {
    if ((await page.$(selector)) !== null) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

/** Whatever is on screen now, for a finding that has to describe a stall. */
const whatIsShowing = (page) =>
  page.evaluate(() =>
    document.body.innerText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(' / '),
  );

async function freshContext() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Africa/Johannesburg',
  });
  await context.addInitScript(pinClock(LUNCHTIME));
  return context;
}

/**
 * Walk the journey from a cold start, pressing whatever each step says to.
 *
 * `stopAfter` lets case 2 take the same walk and answer the permission screen
 * the other way, rather than keeping a second copy of the route to it.
 */
async function walk(page, { answerLocationWith } = {}) {
  const steps = [];
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });

  for (const step of JOURNEY) {
    const arrived = await waitFor(page, step.see);
    steps.push({ name: step.name, arrived });
    if (!arrived) return { steps, stalledOn: step.name, showing: await whatIsShowing(page) };

    if (step.name === 'welcome carousel') {
      /*
        Press Next until the carousel is finished rather than a fixed three
        times. The deck's length is the app's business, and a sweep that
        hard-codes it starts lying the day somebody adds a slide.
      */
      for (let press = 0; press < 8; press += 1) {
        if ((await page.$(step.see)) === null) break;
        await page.click(step.see);
        await page.waitForTimeout(900);
      }
      if ((await page.$(step.see)) !== null) {
        return {
          steps,
          stalledOn: 'welcome carousel',
          showing: 'the carousel never finished after 8 presses of Next',
        };
      }
      continue;
    }

    const press =
      step.name === 'location permission' && answerLocationWith ? answerLocationWith : step.press;
    if (press) {
      await page.click(press);
      await page.waitForTimeout(1200);
    }
  }
  return { steps, stalledOn: null, showing: await whatIsShowing(page) };
}

try {
  // ── 1. the whole journey, declining the permission ──────────────────────
  {
    const context = await freshContext();
    const page = await context.newPage();
    const crashes = [];
    page.on('pageerror', (e) => crashes.push(String(e).slice(0, 160)));

    const result = await walk(page);
    rows.push({ case: 'first run, "Not now"', ...result });

    if (result.stalledOn) {
      findings.push(
        `first run stalled at "${result.stalledOn}" — the screen showed: ${result.showing}. ` +
          `A customer with no account cannot get past it.`,
      );
    }
    if (crashes.length > 0) findings.push(`first run threw — ${crashes[0]}`);

    // ── 3. asked once, never again ────────────────────────────────────────
    if (!result.stalledOn) {
      /*
        Entered through sign-in, which is the only door `postAuthRoute` stands
        behind — and this took two goes to get right.

        The first version of this case just opened a second page at `/`. That
        passes through the splash, which branches on `hasCompletedOnboarding`
        and goes straight to Home without ever calling `postAuthRoute`. So it
        reported "went straight to Home" whatever the permission flag said: run
        with `markAsked()` deleted from both call sites, it stayed green. A
        check that cannot fail is worse than no check, and this one was
        measuring the onboarding flag while claiming to measure the location
        one.

        Going in through sign-in is what a returning customer does and what the
        promise is about, so that is what is driven.
      */
      const second = await context.newPage();
      await second.goto(BASE + '/sign-in', { waitUntil: 'networkidle', timeout: 45000 });
      const ready = await waitFor(second, '[data-testid="sign-in-guest"]');
      if (!ready) {
        findings.push('could not reach sign-in a second time, so the asked-once promise is untested.');
      } else {
        await second.click('[data-testid="sign-in-guest"]');
        await second.waitForTimeout(2000);
        const askedAgain =
          (await second.$('[data-testid="location-permission-screen"]')) !== null;
        const reachedHome =
          (await second.$('[data-testid="home-screen"], [data-testid="tab-bar"]')) !== null;
        rows.push({ case: 'in again through sign-in', askedAgain, reachedHome });

        if (askedAgain) {
          findings.push(
            `the permission screen came back on a second entry through sign-in, for a customer ` +
              `who had already answered it. postAuthRoute promises "once asked (granted or ` +
              `declined), we never ask again" — an app that asks every time is one whose ` +
              `location permission gets switched off for good.`,
          );
        } else if (!reachedHome) {
          findings.push(
            `a second entry through sign-in reached neither Home nor the permission screen — ` +
              `${await whatIsShowing(second)}`,
          );
        }
      }
      await second.close();
    }
    await context.close();
  }

  // ── 2. the other answer ─────────────────────────────────────────────────
  {
    const context = await freshContext();
    const page = await context.newPage();
    /*
      "Use my location" opens the OS prompt, which a browser answers through
      permissions rather than a dialogue. Granted here so the path under test
      is the one a customer who says yes actually takes.
    */
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -26.1076, longitude: 28.0567 });

    const result = await walk(page, { answerLocationWith: '[data-testid="location-allow"]' });
    rows.push({ case: 'first run, "Use my location"', ...result });

    if (result.stalledOn) {
      findings.push(
        `pressing "Use my location" stalled at "${result.stalledOn}" — the screen showed: ` +
          `${result.showing}. Both answers on a pre-permission screen have to lead somewhere.`,
      );
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\nfirst run, step by step');
for (const row of rows) {
  if (row.steps) {
    const path = row.steps.map((s) => `${s.arrived ? '✓' : '✗'} ${s.name}`).join('  →  ');
    console.log(`  ${row.stalledOn ? '✗' : '✓'} ${row.case}`);
    console.log(`      ${path}`);
  } else {
    console.log(
      `  ${row.askedAgain ? '✗' : '✓'} ${row.case}` +
        `      ${row.askedAgain ? 'asked for location again' : 'went straight to Home'}`,
    );
  }
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) between a new customer and their first order.`);
  process.exit(1);
}

console.log('A new customer walks from the splash to Home, either answer, and is asked once.');
