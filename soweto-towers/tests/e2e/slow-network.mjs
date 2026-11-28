#!/usr/bin/env node
/**
 * End-to-end: a slow phone connection. The app's JavaScript is held back for
 * three seconds, so the visitor sees and uses each form before React has taken
 * it over.
 *  - Text typed early survives hydration (controlled and uncontrolled fields).
 *  - A tap on submit before hydration is held and replayed, never posted the
 *    old-fashioned way (which Next 16 answers with a blank page on prerendered
 *    routes), and the spam guard doesn't mistake it for a bot.
 *
 * Usage: node tests/e2e/slow-network.mjs <baseUrl>. Exits non-zero on failure.
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:3000';
const browser = await chromium.launch();
const octet = () => Math.floor(Math.random() * 250) + 2;
let failed = 0;

async function slowPage() {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, extraHTTPHeaders: { 'x-real-ip': `10.${octet()}.${octet()}.${octet()}` } });
  const page = await ctx.newPage();
  await page.route('**/_next/static/chunks/**', async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  return { ctx, page };
}

async function check(label, fn) {
  process.stdout.write(`• ${label} … `);
  const { ctx, page } = await slowPage();
  try {
    await fn(page);
    console.log('ok');
  } catch (err) {
    failed++;
    console.log(`FAIL\n  ${err.message.split('\n')[0]}`);
  } finally {
    await ctx.close();
  }
}

async function typedEarly(page, path, locate) {
  await page.goto(base + path, { waitUntil: 'domcontentloaded' });
  const field = locate(page);
  await field.fill('Typed early');
  await page.waitForFunction(() => window.__stReady === true, null, { timeout: 20000 });
  await page.waitForTimeout(500);
  const value = await field.inputValue();
  if (value !== 'Typed early') throw new Error(`after hydration the field holds ${JSON.stringify(value)}`);
}

try {
  await check('gift: early typing survives hydration', (p) => typedEarly(p, '/gift', (pg) => pg.getByLabel('Their name')));
  await check('event: early typing survives hydration', (p) =>
    typedEarly(p, '/events/relaunch-weekend', (pg) => pg.getByRole('complementary', { name: 'Tickets' }).getByLabel('Full name')),
  );
  await check('groups enquiry: early typing survives hydration', (p) => typedEarly(p, '/groups', (pg) => pg.locator('form input[name="name"]').first()));
  await check('staff sign-in: early typing survives hydration', (p) => typedEarly(p, '/admin/login', (pg) => pg.getByLabel('Email')));

  await check('staff sign-in: an early tap is held, then answered', async (page) => {
    await page.goto(`${base}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email').fill('crew@sowetotowers.co.za');
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByText('That email and password don’t match.').waitFor({ timeout: 20000 });
  });

  await check('newsletter: an early tap is held, then answered (not taken for a bot)', async (page) => {
    await page.goto(`${base}/faq`, { waitUntil: 'domcontentloaded' });
    await page.locator('footer form button').first().click();
    await page.locator('footer [role="alert"]').waitFor({ timeout: 20000 });
  });
} finally {
  await browser.close();
}

if (failed) {
  console.log(`\nFAIL · ${failed} check${failed === 1 ? '' : 's'} failed`);
  process.exitCode = 1;
} else {
  console.log('\nPASS');
}
