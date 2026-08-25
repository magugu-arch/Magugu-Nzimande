#!/usr/bin/env node
/**
 * One phone, two people.
 *
 * Favourites are local and outlive a sign-out on purpose — signing out to
 * browse should not take them away. Nothing asked whose they were, though, so
 * the next person to sign in inherited a stranger's hearted dishes, presented
 * as their own under a Favourites tab built to show them.
 *
 * Both halves have to hold, and they pull against each other: the same person
 * signing back in keeps their list, a different person does not get it. A fix
 * that clears on sign-out satisfies the second and breaks the first, which is
 * why this drives both.
 *
 * Two notes on how it gets there, both honest limits of the harness rather
 * than of the app:
 *
 *   The sign-out confirm is an `Alert.alert`, and React Native Web does not
 *   implement it — the button is there and tapping it does nothing. So the
 *   handover is made by dropping the persisted auth key, which is the state a
 *   completed sign-out leaves behind as far as the favourites store can see.
 *   Everything after that is the app's own doing.
 *
 *   Mock sign-in used to hand back one identity wearing whatever email was
 *   typed, so two accounts were literally the same `user.id` and this journey
 *   could not have failed. The id is derived from the email now.
 *
 * Run: npm run audit:handover
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-handover');
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
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1' },
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

  const signIn = async (email) => {
    await page.goto(BASE + '/sign-in', { waitUntil: 'networkidle', timeout: 45000 });
    await page.locator('[data-testid="sign-in-email"]').fill(email);
    await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
    await tap('sign-in-submit');
    await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'), { timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.getByText('Not now', { exact: false }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
  };

  /**
   * What this account's favourites are, from the device and from the screen.
   *
   * Both, because neither alone is enough. The Favourites chip is only
   * rendered when there is at least one — deliberately, so it never leads to a
   * dead end — so "no chip" would pass whether the list had been cleared or
   * the tab had simply been deleted. The stored list is the fact; the chip is
   * what a customer would actually meet.
   */
  const favouritesNow = async () => {
    const stored = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('bbq.favourites');
        const parsed = raw ? JSON.parse(raw)?.state : null;
        return { ids: parsed?.productIds ?? [], ownerId: parsed?.ownerId ?? null };
      } catch {
        return { ids: [], ownerId: null };
      }
    });

    await page.goto(BASE + '/menu', { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(2000);

    const chip = page.locator('[data-testid="menu-category-favourites"]').first();
    const hasChip = (await chip.count()) > 0;

    let listed = [];
    if (hasChip) {
      await chip.click({ timeout: 10000 });
      await page.waitForTimeout(1500);
      listed = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid]')]
          .map((element) => element.getAttribute('data-testid'))
          .filter((id) => id?.startsWith('menu-row-')),
      );
    }

    // The two must agree, or one of them is lying to somebody.
    if (stored.ids.length !== listed.length) {
      throw new Error(
        `the device holds ${stored.ids.length} favourite(s) and the menu shows ${listed.length}`,
      );
    }

    return { ...stored, listed, hasChip };
  };

  /** The handover: the previous owner's session gone, everything else as it was. */
  const handOverThePhone = async () => {
    await page.evaluate(() => window.localStorage.removeItem('bbq.auth'));
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500);
  };

  // ---- Thandi hearts a dish ----
  await signIn('thandi@example.co.za');
  await page.goto(BASE + '/product/golden-original', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1500);
  await tap('product-favourite');
  await page.waitForTimeout(1200);

  const hers = await favouritesNow();
  if (hers.ids.length === 0) throw new Error('hearting a dish did not put it in Favourites');
  if (!hers.hasChip) throw new Error('a hearted dish produced no Favourites tab to find it in');
  if (hers.ownerId === null) throw new Error('the favourites were saved belonging to nobody');
  step(`hearted a dish — Favourites lists ${hers.ids.length}, owned by ${hers.ownerId}`);

  // ---- She signs out and back in. Still hers. ----
  await handOverThePhone();
  await signIn('thandi@example.co.za');

  const stillHers = await favouritesNow();
  if (stillHers.ids.length !== hers.ids.length) {
    throw new Error(
      `signing back in lost her favourites: ${hers.ids.length} before, ${stillHers.ids.length} after`,
    );
  }
  step('signing back in keeps them, which is the point of keeping them local');

  // ---- Somebody else signs in on the same phone ----
  await handOverThePhone();
  await signIn('sipho@example.co.za');

  const theirs = await favouritesNow();
  if (theirs.ids.length > 0) {
    throw new Error(
      `a different account inherited ${theirs.ids.length} of somebody else's favourites`,
    );
  }
  if (theirs.ownerId === hers.ownerId) {
    throw new Error(
      `both accounts came back as the same person (${theirs.ownerId}) — ` +
        'this journey cannot tell them apart',
    );
  }
  step(`a different account starts empty, and is a different person — ${theirs.ownerId}`);
} catch (error) {
  failed = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
  server.close();
}

console.log('');
if (failed) {
  console.log(`The handover went wrong after ${steps.length} step(s): ${failed}`);
  process.exit(1);
}
console.log(`Favourites follow the person, not the handset, in ${steps.length} steps.`);
process.exit(0);
