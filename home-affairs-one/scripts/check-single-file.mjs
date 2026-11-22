#!/usr/bin/env node
/**
 * Opens share/Home_Affairs_One_Concept_Prototype.html straight from disk — no
 * server — and checks that it behaves like the hosted app:
 *   - every screen in tests/routes.json renders for the right person
 *   - sign-in works through the real mock sign-in screens
 *   - no request leaves the file
 *   - with scripts switched off (iPhone's file preview) a static preview shows
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'share', 'Home_Affairs_One_Concept_Prototype.html');
const fileUrl = pathToFileURL(file).href;
const screens = JSON.parse(readFileSync(path.join(root, 'tests', 'routes.json'), 'utf8'));
const shots = path.join(root, '.shots');
mkdirSync(shots, { recursive: true });
const problems = [];
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function settle(page) {
  await page.waitForTimeout(350);
  await page
    .getByRole('status')
    .filter({ hasText: /Loading|Checking/ })
    .first()
    .waitFor({ state: 'detached', timeout: 8000 })
    .catch(() => undefined);
}

async function signIn(page, persona) {
  const [kind, name] = persona.includes(':') ? persona.split(':') : ['citizen', persona];
  if (kind === 'staff' || kind === 'partner') {
    await page.goto(`${fileUrl}#/${kind}/`);
    await page
      .getByRole('button', { name: new RegExp(escape(name)) })
      .first()
      .click();
    await page.getByRole('button', { name: 'Sign out' }).first().waitFor();
    return;
  }
  await page.goto(`${fileUrl}#/sign-in/`);
  await page.getByRole('button', { name: new RegExp(escape(name)) }).click();
  const passkey = page.getByRole('button', { name: 'Continue with passkey' });
  if (await passkey.count()) await passkey.click();
  else {
    await page.getByLabel('6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Sign in with code' }).click();
  }
  await page.waitForFunction(() => window.location.hash.startsWith('#/home/'));
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
try {
  const personas = [...new Set(screens.map((screen) => screen.persona))];
  let visited = 0;
  for (const persona of personas) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    page.on('pageerror', (error) =>
      problems.push(`${persona ?? 'signed out'}: script error: ${error.message.slice(0, 160)}`),
    );
    page.on('console', (message) => {
      if (message.type() === 'error')
        problems.push(`${persona ?? 'signed out'}: console: ${message.text().slice(0, 160)}`);
    });
    // The file must be complete in itself: anything that is not the file or inline data is a failure.
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('file:') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        problems.push(`request left the file: ${url.slice(0, 120)}`);
      }
    });
    try {
      if (persona) await signIn(page, persona);
      else await page.goto(fileUrl);
    } catch (error) {
      problems.push(`${persona}: sign-in failed: ${String(error).slice(0, 160)}`);
    }
    for (const screen of screens.filter((item) => item.persona === persona)) {
      await page.goto(`${fileUrl}#${screen.path}`);
      await settle(page);
      visited += 1;
      const headings = await page.locator('h1').count();
      if (headings !== 1) problems.push(`${screen.name}: ${headings} h1 elements`);
      if (await page.getByRole('heading', { name: 'Something went wrong', exact: true }).count()) {
        problems.push(`${screen.name}: error state`);
      }
      if (await page.getByRole('heading', { name: 'We could not find that page' }).count()) {
        problems.push(`${screen.name}: route not found`);
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 1) problems.push(`${screen.name}: horizontal overflow ${overflow}px`);
      const broken = await page.evaluate(
        () =>
          [...document.images].filter((image) => image.complete && image.naturalWidth === 0).length,
      );
      if (broken) problems.push(`${screen.name}: ${broken} image(s) did not load`);
      if (['welcome', 'home', 'case-production', 'services'].includes(screen.name)) {
        await page.screenshot({ path: path.join(shots, `single-${screen.name}.png`) });
      }
    }
    // In-page anchors must not be mistaken for routes.
    if (!persona) {
      await page.goto(`${fileUrl}#/services/`);
      await settle(page);
      await page.getByRole('link', { name: 'Passports' }).first().click();
      await page.waitForTimeout(200);
      const hash = await page.evaluate(() => window.location.hash);
      if (hash !== '#/services/') problems.push(`anchor link changed the route to ${hash}`);
      if ((await page.locator('h1').count()) !== 1)
        problems.push('anchor link broke the services screen');
    }
    await context.close();
  }

  // Scripts off: what iPhone's file preview shows.
  const still = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
  });
  const preview = await still.newPage();
  await preview.goto(fileUrl);
  const note =
    (await preview
      .locator('.sp .note')
      .first()
      .textContent()
      .catch(() => '')) ?? '';
  if (!note.includes('This is a static preview.'))
    problems.push('no static preview without scripts');
  if (await preview.locator('#root').isVisible())
    problems.push('the loading line shows in the static preview');
  const pictures = await preview.evaluate(
    () => [...document.images].filter((image) => image.naturalWidth > 0).length,
  );
  if (pictures < 5) problems.push(`static preview shows only ${pictures} images`);
  await preview.screenshot({ path: path.join(shots, 'single-no-scripts.png'), fullPage: true });
  await still.close();

  const megabytes = (statSync(file).size / 1024 / 1024).toFixed(2);
  console.log(
    `single file: ${megabytes} MB, ${visited} screens opened from disk, static preview shows ${pictures} images`,
  );
} finally {
  await browser.close();
}
const unique = [...new Set(problems)];
if (unique.length) {
  console.error(`problems (${unique.length}):\n  - ${unique.join('\n  - ')}`);
  process.exit(1);
}
console.log('single-file check passed');
