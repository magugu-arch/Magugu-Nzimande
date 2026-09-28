/**
 * Opens dist-standalone/mabu.html straight from disk (file://), as someone
 * double-clicking it would, and walks the core journeys: tabs, a deep link,
 * a dish and back, and booking a table as a new guest.
 *
 *   npm run standalone:check
 */
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { fillSignIn, root } from './lib/web.mjs';

const file = path.join(root, 'dist-standalone/mabu.html');
if (!fs.existsSync(file)) throw new Error('Run npm run standalone first');
const url = `file://${file}`;

const browser = await chromium
  .launch(
    fs.existsSync('/opt/pw-browsers/chromium')
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {},
  )
  .catch(() => chromium.launch());
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

let failures = 0;
async function step(label, fn) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await fn(page);
    if (errors.length) throw new Error(errors[0]);
    console.log(`✓ ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`✗ ${label}: ${String(error.message ?? error).split('\n')[0]}`);
  } finally {
    await page.close();
  }
}

const open = async (page, hash = '') => {
  await page.goto(url + hash);
  await page
    .getByText('Refined by Fire.')
    .or(page.getByRole('tablist'))
    .first()
    .waitFor({ timeout: 15_000 });
};

await step('opens from a local file on the home screen', async (page) => {
  await open(page);
  await page.getByText('Refined by Fire.').waitFor();
});

await step('tabs switch screens', async (page) => {
  await open(page);
  await page.getByRole('tab', { name: 'Events' }).click();
  await page.getByText('Evenings to remember').waitFor({ timeout: 5_000 });
  await page.getByRole('tab', { name: 'Discover' }).click();
  await page.getByText('Wines to pair').waitFor({ timeout: 5_000 });
});

await step('#menu deep link, a dish, and back', async (page) => {
  await page.goto(`${url}#menu`);
  await page.getByText('The Menu').first().waitFor({ timeout: 15_000 });
  await page
    .getByRole('button', { name: /^Tiger Prawns/ })
    .first()
    .click();
  // Screens stay mounted underneath in the stack: only visible text counts.
  await page
    .locator('text=Grilled tiger prawns >> visible=true')
    .first()
    .waitFor({ timeout: 5_000 });
  await page.locator('[aria-label="Back"] >> visible=true').first().click();
  await page.locator('text=BOLD FLAVOURS >> visible=true').first().waitFor({ timeout: 5_000 });
});

await step('books a table as a new guest', async (page) => {
  await open(page);
  await page.getByTestId('home-book').click();
  const slot = page.getByRole('button', { name: /^\d\d:\d\d$/ }).first();
  await slot.waitFor({ timeout: 10_000 });
  await slot.click();
  await page.getByTestId('book-continue').click();
  await page.getByTestId('details-continue').click();
  await page.getByTestId('review-confirm').click();
  await fillSignIn(page, `standalone.${Date.now()}@example.com`, 'Naledi Khumalo');
  await page.getByLabel('Mobile').fill('082 555 0142');
  await page.getByTestId('review-confirm').click();
  await page.getByText('Your table at Mábu is reserved.').waitFor({ timeout: 10_000 });
});

await browser.close();
if (failures) {
  console.error(`\n${failures} standalone check(s) failed`);
  process.exit(1);
}
console.log('\nThe single-file app works opened from disk.');
