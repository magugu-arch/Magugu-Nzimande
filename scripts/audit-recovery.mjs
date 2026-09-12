#!/usr/bin/env node
/**
 * The customer who cannot get in.
 *
 * Every route in this app is *rendered* by `audit:screens`, and about
 * twenty-five are actually *used* by a sweep — signed into, typed into,
 * submitted. Comparing the two lists leaves four routes that have only ever
 * been looked at, and two of them are the whole of password recovery:
 * `/forgot-password` and `/reset-password`.
 *
 * That is the one journey with no sweep and the worst one to be missing.
 * Everything else in the app has an alternative — a customer who cannot place
 * an order can ring the store, a customer who cannot see their points can
 * order anyway. A customer who cannot reset their password has no way back
 * into their account at all, and no way to tell anyone, because the support
 * form is behind the account they cannot reach.
 *
 * Six cases, three of them failures:
 *
 *   1. the ordinary path — ask for a link, and be told where it went
 *   2. the server refuses — and must not produce a confirmation anyway
 *   3. a link with no token on it
 *   4. the ordinary path — set a new password and be offered the way back in
 *   5. two passwords that do not match — caught here, with nothing sent
 *   6. a token the server rejects, which is what an expired link is
 *
 * Cases 2 and 6 are the ones worth the build: a recovery screen that shows a
 * tick after a failed request has told somebody to go and wait for an email
 * that is not coming.
 *
 * Run: npm run audit:recovery
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-recovery');
const APP_PORT = 8241;
const API_PORT = 8242;

const EMAIL = 'locked.out@example.co.za';
const TOKEN = 'reset-token-abc123';

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

function serveApp() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(OUT, pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(OUT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(APP_PORT, '127.0.0.1', () => resolve(server)));
}

/** Set per case: how the backend answers the recovery endpoints. */
let answer = 'ok';
let seen = [];

function serveApi() {
  const server = createServer((req, res) => {
    const pathname = new URL(req.url, 'http://x').pathname;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*',
      });
      res.end();
      return;
    }

    const cors = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Date',
    };

    if (req.method === 'GET' || req.method === 'HEAD') {
      res.writeHead(200, cors);
      res.end('[]');
      return;
    }

    seen.push(`${req.method} ${pathname}`);

    if (answer === 'refuse' && pathname === '/v1/auth/password/reset') {
      res.writeHead(429, cors);
      res.end(JSON.stringify({ code: 'rate_limited', message: 'Too many attempts. Try later.' }));
      return;
    }

    if (answer === 'expired' && pathname === '/v1/auth/password/confirm') {
      res.writeHead(410, cors);
      res.end(JSON.stringify({ code: 'token_expired', message: 'That link has expired.' }));
      return;
    }

    res.writeHead(200, cors);
    res.end(
      pathname === '/v1/auth/password/reset'
        ? JSON.stringify({ sentTo: EMAIL })
        : JSON.stringify({}),
    );
  });
  return new Promise((resolve) => server.listen(API_PORT, '127.0.0.1', () => resolve(server)));
}

const CASES = [
  {
    name: 'asking for a reset link',
    backend: 'ok',
    route: '/forgot-password',
    reaches: 'POST /v1/auth/password/reset',
    act: async (page) => {
      await page.locator('[data-testid="forgot-password-email"]').first().fill(EMAIL);
      await page.locator('[data-testid="forgot-password-submit"]').first().click({ timeout: 8000 });
    },
    // Told where it went, in the words they typed.
    expect: new RegExp(EMAIL.replace('.', '\\.'), 'i'),
  },
  {
    name: 'the server refuses to send it',
    backend: 'refuse',
    route: '/forgot-password',
    reaches: 'POST /v1/auth/password/reset',
    act: async (page) => {
      await page.locator('[data-testid="forgot-password-email"]').first().fill(EMAIL);
      await page.locator('[data-testid="forgot-password-submit"]').first().click({ timeout: 8000 });
    },
    expect: /too many attempts/i,
    // The worst outcome on this screen: a tick over an email nobody sent.
    forbid: /check your inbox/i,
  },
  {
    name: 'a link with no token on it',
    backend: 'ok',
    route: '/reset-password',
    act: async () => {},
    expect: /link/i,
    // And a way onwards, not a dead end.
    requires: '[data-testid="reset-password-no-token"]',
  },
  {
    name: 'setting a new password',
    backend: 'ok',
    route: `/reset-password?token=${TOKEN}`,
    reaches: 'POST /v1/auth/password/confirm',
    act: async (page) => {
      await page.locator('[data-testid="reset-password-new"]').first().fill('Str0ng-New-Pass');
      await page.locator('[data-testid="reset-password-confirm"]').first().fill('Str0ng-New-Pass');
      await page.locator('[data-testid="reset-password-submit"]').first().click({ timeout: 8000 });
    },
    requires: '[data-testid="reset-password-sign-in"]',
  },
  {
    name: 'two passwords that do not match',
    backend: 'ok',
    route: `/reset-password?token=${TOKEN}`,
    act: async (page) => {
      await page.locator('[data-testid="reset-password-new"]').first().fill('Str0ng-New-Pass');
      await page.locator('[data-testid="reset-password-confirm"]').first().fill('Str0ng-Different');
      await page.locator('[data-testid="reset-password-submit"]').first().click({ timeout: 8000 });
    },
    expect: /match/i,
    // Caught here, so nothing is spent and no token is burned.
    sendsNothing: true,
  },
  {
    name: 'a link that has expired',
    backend: 'expired',
    route: `/reset-password?token=${TOKEN}`,
    reaches: 'POST /v1/auth/password/confirm',
    act: async (page) => {
      await page.locator('[data-testid="reset-password-new"]').first().fill('Str0ng-New-Pass');
      await page.locator('[data-testid="reset-password-confirm"]').first().fill('Str0ng-New-Pass');
      await page.locator('[data-testid="reset-password-submit"]').first().click({ timeout: 8000 });
    },
    expect: /expired/i,
    // A password that was never changed must not be reported as changed.
    forbid: /you can sign in with it now|password changed/i,
  },
];

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium',
  );
  process.exit(2);
}

console.log('Building with the mock layer off, pointed at a stub backend…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: {
    ...process.env,
    EXPO_PUBLIC_USE_MOCK_API: '0',
    EXPO_PUBLIC_API_BASE_URL: `http://localhost:${API_PORT}`,
  },
});

const appServer = await serveApp();
const apiServer = await serveApi();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const CRASHED = /Something broke/i;

const findings = [];
const rows = [];

try {
  for (const testCase of CASES) {
    answer = testCase.backend;
    seen = [];

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      timezoneId: 'Africa/Johannesburg',
    });
    const page = await context.newPage();
    const crashes = [];
    page.on('pageerror', (error) => crashes.push(String(error).slice(0, 120)));

    await page.goto(`http://localhost:${APP_PORT}${testCase.route}`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    await page.waitForTimeout(2500);

    let acted = true;
    await testCase.act(page).catch(() => {
      acted = false;
    });
    await page.waitForTimeout(3500);

    const text = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
    const caught = await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="error-boundary"]')),
    );
    const present = testCase.requires
      ? await page.evaluate(
          (selector) => Boolean(document.querySelector(selector)),
          testCase.requires,
        )
      : true;

    const reached = testCase.reaches === undefined || seen.includes(testCase.reaches);
    const told = testCase.expect ? testCase.expect.test(text) : true;
    const lied = testCase.forbid ? testCase.forbid.test(text) : false;
    const quiet = testCase.sendsNothing ? seen.length === 0 : true;

    if (!acted) {
      findings.push(
        `${testCase.name}: could not work its own screen, so this case proved nothing. ` +
          `Screen reads: ${text.slice(0, 120)}`,
      );
    } else if (!reached) {
      findings.push(
        `${testCase.name}: never sent ${testCase.reaches}. The app sent: ${seen.join(', ') || '(nothing)'}`,
      );
    }
    if (crashes.length > 0 || caught || CRASHED.test(text)) {
      findings.push(
        `${testCase.name}: crashed the screen — ${crashes[0] ?? 'caught by the error boundary'}`,
      );
    }
    if (!told) {
      findings.push(
        `${testCase.name}: never said ${testCase.expect} — screen reads: ${text.slice(0, 150)}`,
      );
    }
    if (lied) {
      findings.push(
        `${testCase.name}: said ${testCase.forbid.exec(text)?.[0]} about something that did not happen`,
      );
    }
    if (!present) {
      findings.push(`${testCase.name}: ${testCase.requires} never appeared`);
    }
    if (!quiet) {
      findings.push(
        `${testCase.name}: sent ${seen.join(', ')} for a form the app could have refused itself`,
      );
    }

    rows.push({
      name: testCase.name,
      ok: acted && reached && told && !lied && present && quiet && crashes.length === 0 && !caught,
    });
    await context.close();
  }
} finally {
  await browser.close();
  appServer.close();
  apiServer.close();
}

console.log('\ncase');
for (const row of rows) console.log(`  ${row.ok ? '✓' : '✗'} ${row.name}`);

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) wrong on the way back into an account.`);
  process.exit(1);
}

console.log(`${CASES.length} steps of password recovery, and the app was honest about every one.`);
