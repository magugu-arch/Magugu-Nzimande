#!/usr/bin/env node
/**
 * Captures the working concept app (release/tashas-app.html) for the strategy
 * deck: six phone screens and the desktop operations view, written to
 * marketing/shots/ as JPEGs. Uses the preinstalled Playwright, like scripts/qa.mjs.
 * Run after `npm run build`: node marketing/capture.mjs
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'shots');
mkdirSync(out, { recursive: true });
const url = pathToFileURL(path.join(here, '..', 'release', 'tashas-app.html')).href;
const { chromium } = createRequire(import.meta.url)('playwright');

// The Playwright that resolves may not match the browser on disk; fall back to
// a Chromium given by CHROMIUM_PATH (or the cloud image's preinstalled one).
const browser = await chromium
  .launch()
  .catch(() => chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }));

async function open(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForTimeout(500);
  return page;
}

async function shot(page, name) {
  await page.waitForTimeout(650);
  await page.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 88 });
  console.log(`  ✓ ${name}`);
}

const phone = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await shot(phone, 'today');

await phone.locator('.ed-card', { hasText: 'Brunch for the whole table' }).click();
await shot(phone, 'campaign');
await phone.getByRole('button', { name: 'Back' }).last().click();
await phone.waitForTimeout(500);

await phone.getByRole('button', { name: 'Book a table' }).first().click();
const sheet = phone.locator('.sheet').last();
await sheet.waitFor();
await sheet.getByRole('button', { name: 'Rosebank', exact: true }).click();
const more = sheet.getByRole('button', { name: 'More guests' });
for (let i = 2; i < 6; i++) await more.click();
await sheet.locator('.date-pill').nth(3).click();
await sheet.locator('.time:not(.full)').first().waitFor({ timeout: 8000 });
await sheet.locator('.time:not(.full)').first().click();
await shot(phone, 'book');
await sheet.getByRole('button', { name: 'Continue' }).click();
await sheet.locator('#bk-terms').check();
await sheet.getByRole('button', { name: /^Pay R/ }).click();
const gateway = phone.locator('.sheet .gateway');
await gateway.waitFor({ timeout: 8000 });
await shot(phone, 'checkout');
await gateway.getByRole('button', { name: /test success/ }).click();
await phone.getByText('You are booked').waitFor({ timeout: 15000 });
await shot(phone, 'booked');
await phone.getByRole('button', { name: 'Done' }).click();
await phone.waitForTimeout(500);

await phone.locator('.tabbar').getByRole('button', { name: 'Rewards' }).click();
await shot(phone, 'rewards');

const desktop = await open({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await desktop.locator('.sidebar nav').getByRole('button', { name: 'Operations' }).click();
await shot(desktop, 'ops');

await browser.close();
