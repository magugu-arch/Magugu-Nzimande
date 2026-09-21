#!/usr/bin/env node
/**
 * Press the destructive buttons, in a browser, and check something happens.
 *
 * Every confirmation in this app went through `Alert.alert`. On React Native
 * Web that call is this, in full:
 *
 *     class Alert { static alert() {} }
 *
 * An empty body. So in the published HTML build — the build the client was
 * handed, the one they pressed — Clear cart did nothing. Not "showed the
 * wrong dialog": nothing. No dialog, no cart emptied, no console error. The
 * same was true of Sign out, Remove address, Remove payment method, Cancel
 * order and Delete account: sixteen controls that looked live and were not.
 *
 * Nothing in the suite could have caught it. The unit tests mock `Alert` and
 * assert it was called, which it was. The type checker is satisfied, because
 * the function exists. The screen sweep photographs a cart that still has
 * things in it and cannot know that it should not. The defect only exists in
 * the built web bundle, and only when somebody presses the button.
 *
 * So that is what this does. It builds the real bundle, opens it in a real
 * browser, puts a real dish in a cart, presses Clear, presses the confirming
 * button in the dialog that ought to appear, and checks the cart is empty.
 * Then it does the same to Sign out, which is the other end of the app.
 *
 * Run: npm run audit:dialogs
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-dialogs');
const PORT = 8197;
const BASE = `http://localhost:${PORT}`;

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
  // Demo prices, because this journey has to get a dish into a cart before it
  // can empty one, and §15 leaves the shipped catalogue unpriced with every
  // dish unavailable.
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1', EXPO_PUBLIC_DEMO_PRICES: '1' },
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const steps = [];
let failed = null;

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Africa/Johannesburg',
  });
  const page = await context.newPage();

  const tap = (id) => page.locator(`[data-testid="${id}"]`).first().click({ timeout: 10000 });
  const step = (name) => {
    steps.push(name);
    console.log(`  ✓ ${name}`);
  };

  const openTab = async (route) => {
    await page.locator(`a[href="${route}"]:visible`).first().click({ timeout: 10000 });
    await page.waitForTimeout(1800);
  };

  /** Is the app's own dialog on screen? */
  const dialogShowing = () =>
    page.locator('[data-testid="app-dialog-card"]').isVisible().catch(() => false);

  await page.goto(BASE + '/sign-in', { waitUntil: 'networkidle', timeout: 45000 });
  await page.locator('[data-testid="sign-in-email"]').fill('loyal@example.co.za');
  await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
  await tap('sign-in-submit');
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'), { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.getByText('Not now', { exact: false }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  step('signed in');

  // ── Put something in the cart ──────────────────────────────────────────
  await openTab('/menu');
  await page.locator('[data-testid^="menu-row-"]').first().click({ timeout: 10000 });
  await page.waitForURL(/product\//, { timeout: 15000 });
  await tap('product-add-to-cart');
  await page.waitForTimeout(1500);

  await page.goto(BASE + '/cart', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1800);

  if (await page.locator('[data-testid="cart-empty-state"]').isVisible().catch(() => false)) {
    throw new Error('nothing reached the cart, so there is nothing to clear');
  }
  step('a dish is in the cart');

  // ── The button that was dead ───────────────────────────────────────────
  if (await dialogShowing()) throw new Error('a dialog was already open before Clear was pressed');

  await tap('cart-clear');
  await page.waitForTimeout(900);

  /**
   * This is the assertion the whole script exists for. Before the fix, this
   * is where it stopped: the press landed, `Alert.alert` ran, and no dialog
   * ever appeared.
   */
  if (!(await dialogShowing())) {
    throw new Error(
      'pressing Clear raised no dialog — the confirmation is dead in the web build',
    );
  }
  step('Clear raises a confirmation');

  /**
   * And it has to be a real choice, not a notice with an OK on it. A
   * destructive confirmation whose only button is the destructive one is not
   * a confirmation.
   */
  const buttonCount = await page.locator('[data-testid^="app-dialog-button-"]').count();
  if (buttonCount < 2) {
    throw new Error(`the confirmation offers ${buttonCount} button(s), so there is no way to decline`);
  }
  step(`the confirmation offers a way out — ${buttonCount} buttons`);

  // Decline first. Cancelling must leave the cart alone.
  await tap('app-dialog-button-0');
  await page.waitForTimeout(900);
  if (await dialogShowing()) throw new Error('declining did not close the dialog');
  if (await page.locator('[data-testid="cart-empty-state"]').isVisible().catch(() => false)) {
    throw new Error('declining the confirmation emptied the cart anyway');
  }
  step('declining leaves the cart alone');

  // Now confirm, and the cart must actually empty.
  await tap('cart-clear');
  await page.waitForTimeout(900);
  await tap('app-dialog-button-1');
  await page.waitForTimeout(1500);

  if (!(await page.locator('[data-testid="cart-empty-state"]').isVisible().catch(() => false))) {
    const remaining = await page.evaluate(() => document.body.innerText.slice(0, 300));
    throw new Error(`confirming did not empty the cart. The screen still reads:\n${remaining}`);
  }
  step('confirming empties the cart');

  // ── The other end of the app ───────────────────────────────────────────
  //
  // Sign out was dead in exactly the same way, and it is worth driving a
  // second one: a fix that happened to work on the cart screen and nowhere
  // else would pass everything above.
  //
  // Out through the empty state's own button rather than a tab link. The cart
  // is a modal route outside the tab navigator, so once it is empty there is
  // no tab bar on screen to click — which is correct, and cost this script a
  // run to notice.
  await tap('cart-empty-state-action');
  await page.waitForTimeout(2000);
  await openTab('/more');
  await page.waitForTimeout(800);
  await page.getByText('Sign out', { exact: false }).first().click({ timeout: 10000 });
  await page.waitForTimeout(900);

  if (!(await dialogShowing())) {
    throw new Error('Sign out raised no dialog either — the fix did not reach the rest of the app');
  }
  step('Sign out raises a confirmation too');

  await tap('app-dialog-button-1');
  await page.waitForTimeout(2500);

  const signedOut = await page.evaluate(() => document.body.innerText);
  if (/sign out/i.test(signedOut) && !/sign in/i.test(signedOut)) {
    throw new Error('confirming Sign out left the customer signed in');
  }
  step('confirming signs the customer out');
} catch (error) {
  failed = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
  server.close();
}

console.log('');
if (failed) {
  console.log(`The confirmations are not working after ${steps.length} step(s): ${failed}`);
  process.exit(1);
}
console.log(`Destructive confirmations work in the built web app, in ${steps.length} steps.`);
process.exit(0);
