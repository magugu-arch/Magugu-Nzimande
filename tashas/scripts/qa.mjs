#!/usr/bin/env node
/**
 * Browser QA for the built single-file app (release/tashas-app.html).
 *
 * Opens it at phone, Android, tablet and desktop sizes in light and dark,
 * fails on console errors or horizontal overflow, walks every tab, runs a
 * booking with and without a deposit through the sandbox checkout, counts the
 * 28 embedded images in the asset library, and checks that "Download HTML"
 * produces a file that opens offline with its images. Screenshots land in
 * build/qa/. Run after `npm run build`: npm run qa
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'release/tashas-app.html');
const url = pathToFileURL(file).href;
const out = path.join(root, 'build/qa');
mkdirSync(out, { recursive: true });

const problems = [];
const note = (msg) => {
  problems.push(msg);
  console.error(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

// The Playwright that resolves may not match the browser on disk; fall back to
// a Chromium given by CHROMIUM_PATH (or the cloud image's preinstalled one).
const browser = await chromium
  .launch()
  .catch(() => chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }));

async function open(name, options) {
  const context = await browser.newContext({ acceptDownloads: true, ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(url);
  await page.waitForSelector('.app', { timeout: 15000 });
  await page.waitForTimeout(400);
  return { context, page, errors, name };
}

async function overflow(page, label) {
  const bad = await page.evaluate(() => {
    const out = [];
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`document ${document.documentElement.scrollWidth} > ${vw}`);
    for (const p of document.querySelectorAll('.page:not([hidden])')) {
      if (p.scrollWidth > p.clientWidth + 1) out.push(`page ${p.scrollWidth} > ${p.clientWidth}`);
    }
    return out;
  });
  if (bad.length) note(`${label}: horizontal overflow (${bad.join('; ')})`);
}

async function shot(page, name) {
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
}

async function tab(page, label) {
  const tabbar = page.locator('.tabbar');
  if (await tabbar.isVisible()) await tabbar.getByRole('button', { name: label }).click();
  else await page.locator('.sidebar nav').getByRole('button', { name: label }).click();
  await page.waitForTimeout(350);
}

async function topPage(page) {
  return page.locator('.tabstack:not([hidden]) .page:not(.below):not([hidden])').last();
}

async function book(page, { cafe, party, deposit }) {
  await page.getByRole('button', { name: 'Book a table' }).first().click();
  const sheet = page.locator('.sheet').last();
  await sheet.waitFor();
  await sheet.getByRole('button', { name: cafe, exact: true }).click();
  const more = sheet.getByRole('button', { name: 'More guests' });
  for (let i = 2; i < party; i++) await more.click();
  // A weekday a few days out, to keep clear of the lead time.
  await sheet.locator('.date-pill').nth(3).click();
  await sheet.locator('.time:not(.full)').first().waitFor({ timeout: 8000 });
  await sheet.locator('.time:not(.full)').first().click();
  await sheet.getByRole('button', { name: 'Continue' }).waitFor({ timeout: 8000 });
  await sheet.getByRole('button', { name: 'Continue' }).click();
  await sheet.locator('#bk-terms').check();
  if (deposit) {
    await sheet.getByRole('button', { name: /^Pay R/ }).click();
    const gateway = page.locator('.sheet .gateway');
    await gateway.waitFor({ timeout: 8000 });
    await shot(page, `${page.context()._qaName ?? 'phone'}-checkout`);
    await gateway.getByRole('button', { name: /test success/ }).click();
  } else {
    await sheet.getByRole('button', { name: 'Confirm booking' }).click();
  }
  await page.getByText('You are booked').waitFor({ timeout: 15000 });
}

// ------------------------------------------------------------- phone walk
console.log('Phone (390 × 844, light)');
{
  const s = await open('phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  s.context._qaName = 'phone';
  await shot(s.page, 'phone-today');
  await overflow(s.page, 'phone today');
  for (const t of ['Cafés', 'Menu', 'Rewards', 'Profile']) {
    await tab(s.page, t);
    await overflow(s.page, `phone ${t}`);
    await shot(s.page, `phone-${t.toLowerCase().replace('é', 'e')}`);
  }
  // Café detail via the list, then back with the nav button.
  await tab(s.page, 'Cafés');
  await (await topPage(s.page)).locator('article button.pressable').first().click();
  await s.page.waitForTimeout(600);
  await shot(s.page, 'phone-cafe-detail');
  await overflow(s.page, 'phone café detail');
  await s.page.getByRole('button', { name: 'Back' }).last().click();
  await s.page.waitForTimeout(500);

  await tab(s.page, 'Today');
  await book(s.page, { cafe: 'Morningside', party: 2, deposit: false });
  ok('booking without a deposit confirms');
  await shot(s.page, 'phone-booked');
  await s.page.getByRole('button', { name: 'Done' }).click();
  await s.page.waitForTimeout(600);

  await book(s.page, { cafe: 'Rosebank', party: 6, deposit: true });
  ok('booking with a deposit confirms after the verified payment');
  await shot(s.page, 'phone-booked-deposit');
  await s.page.getByRole('button', { name: 'Done' }).click();
  await s.page.waitForTimeout(600);

  await tab(s.page, 'Profile');
  await s.page.getByRole('button', { name: /Brand asset library/ }).click();
  await s.page.waitForTimeout(700);
  const top = await topPage(s.page);
  // Lazy images: scroll through so every one decodes.
  for (let i = 0; i < 40; i++) {
    await top.evaluate((el) => el.scrollBy(0, 900));
    await s.page.waitForTimeout(60);
  }
  const loaded = await top.evaluate((el) => [...el.querySelectorAll('.grid-cards img')].filter((i) => i.complete && i.naturalWidth > 0).length);
  if (loaded !== 28) note(`asset library shows ${loaded} of 28 images`);
  else ok('asset library renders all 28 images');
  await top.evaluate((el) => el.scrollTo(0, 0));
  await shot(s.page, 'phone-assets');
  await overflow(s.page, 'phone assets');

  await s.page.getByRole('button', { name: 'Back' }).last().click();
  await s.page.waitForTimeout(400);
  await s.page.getByRole('button', { name: /Staff operations/ }).click();
  await s.page.waitForTimeout(500);
  await shot(s.page, 'phone-ops');
  await overflow(s.page, 'phone ops');

  if (s.errors.length) note(`phone console errors: ${s.errors.join(' | ')}`);
  else ok('no console errors on phone');
  await s.context.close();
}

// ---------------------------------------------------------- other sizes
for (const v of [
  { name: 'android', viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, colorScheme: 'dark' },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true },
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'desktop-dark', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
]) {
  console.log(`${v.name} (${v.viewport.width} × ${v.viewport.height}${v.colorScheme ? `, ${v.colorScheme}` : ''})`);
  const { name, ...options } = v;
  const s = await open(name, options);
  await shot(s.page, `${name}-today`);
  await overflow(s.page, `${name} today`);
  for (const t of ['Cafés', 'Menu', 'Rewards']) {
    await tab(s.page, t);
    await overflow(s.page, `${name} ${t}`);
  }
  await tab(s.page, 'Menu');
  await shot(s.page, `${name}-menu`);
  if (name.startsWith('desktop')) {
    await tab(s.page, 'Operations');
    await shot(s.page, `${name}-ops`);
    await overflow(s.page, `${name} ops`);
    await tab(s.page, 'Today');
    await s.page.locator('.sidebar').getByRole('button', { name: 'Book a table' }).click();
    await s.page.locator('.sheet .time:not(.full)').first().waitFor({ timeout: 8000 });
    await shot(s.page, `${name}-book-sheet`);
  }
  if (s.errors.length) note(`${name} console errors: ${s.errors.join(' | ')}`);
  else ok(`no console errors at ${name}`);
  await s.context.close();
}

// ------------------------------------------------------------- gestures
console.log('Gestures');
{
  const s = await open('gestures', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  // Drag a sheet down by its grabber and fling: it should dismiss.
  await s.page.getByRole('button', { name: 'Book a table' }).first().click();
  const grabber = s.page.locator('.sheet .sheet-grabber');
  await grabber.waitFor();
  await s.page.waitForTimeout(500);
  const g = await grabber.boundingBox();
  await s.page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await s.page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await s.page.mouse.move(g.x + g.width / 2, g.y + g.height / 2 + i * 45);
    await s.page.waitForTimeout(12);
  }
  await s.page.mouse.up();
  await s.page.waitForTimeout(900);
  if (await s.page.locator('.sheet').count()) note('dragging the sheet down did not dismiss it');
  else ok('a sheet flung downward dismisses');

  // A short, slow drag springs back instead.
  await s.page.getByRole('button', { name: 'Book a table' }).first().click();
  await grabber.waitFor();
  await s.page.waitForTimeout(500);
  const g2 = await grabber.boundingBox();
  await s.page.mouse.move(g2.x + g2.width / 2, g2.y + 8);
  await s.page.mouse.down();
  await s.page.mouse.move(g2.x + g2.width / 2, g2.y + 60, { steps: 6 });
  await s.page.waitForTimeout(250);
  await s.page.mouse.up();
  await s.page.waitForTimeout(700);
  if (!(await s.page.locator('.sheet').count())) note('a short drag dismissed the sheet');
  else ok('a short drag springs the sheet back');
  await s.page.getByRole('button', { name: 'Close' }).click();
  await s.page.waitForTimeout(700);

  // Swipe from the left edge on a pushed page: it should pop.
  await tab(s.page, 'Cafés');
  await (await topPage(s.page)).locator('article button.pressable').first().click();
  await s.page.waitForTimeout(700);
  const depthBefore = await s.page.locator('.tabstack:not([hidden]) .page:not([hidden])').count();
  await s.page.mouse.move(6, 420);
  await s.page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await s.page.mouse.move(6 + i * 40, 424);
    await s.page.waitForTimeout(12);
  }
  await s.page.mouse.up();
  await s.page.waitForTimeout(900);
  const title = await (await topPage(s.page)).locator('h1').first().textContent();
  if (title?.trim() !== 'Cafés') note(`edge swipe did not go back (depth ${depthBefore}, top "${title}")`);
  else ok('an edge swipe pops back to the café list');
  if (s.errors.length) note(`gesture console errors: ${s.errors.join(' | ')}`);
  await s.context.close();
}

// ------------------------------------------------------- reduced motion
console.log('Reduced motion');
{
  const s = await open('reduced', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  await s.page.getByRole('button', { name: 'Book a table' }).first().click();
  await s.page.locator('.sheet .time').first().waitFor({ timeout: 8000 });
  await s.page.getByRole('button', { name: 'Close' }).click();
  await s.page.waitForTimeout(300);
  if (await s.page.locator('.sheet').count()) note('reduced motion: sheet did not close');
  else ok('sheets open and close with reduced motion');
  if (s.errors.length) note(`reduced-motion console errors: ${s.errors.join(' | ')}`);
  await s.context.close();
}

// ------------------------------------------------------ download, offline
console.log('Download HTML and open it offline');
{
  const s = await open('download', { viewport: { width: 1440, height: 900 } });
  const [download] = await Promise.all([s.page.waitForEvent('download'), s.page.locator('.sidebar').getByRole('button', { name: 'Download HTML' }).click()]);
  const saved = path.join(out, 'downloaded-tashas-app.html');
  await download.saveAs(saved);
  const html = readFileSync(saved, 'utf8');
  const images = JSON.parse(html.match(/<script type="application\/json" id="tashas-images">([\s\S]*?)<\/script>/)[1]);
  if (Object.keys(images).length !== 28) note(`downloaded file embeds ${Object.keys(images).length} images`);
  else ok(`downloaded file is ${(html.length / 1048576).toFixed(2)} MB with all 28 images embedded`);
  if (!html.startsWith('<!doctype html>')) note('downloaded file is not a standalone document');
  await s.context.close();

  const offline = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await offline.setOffline(true);
  const page = await offline.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(saved).href);
  await page.waitForSelector('.tabbar', { timeout: 15000 });
  await page.waitForTimeout(500);
  const heroLoaded = await page.evaluate(() => {
    const img = document.querySelector('.hero img');
    return !!img && img.complete && img.naturalWidth > 0;
  });
  if (!heroLoaded) note('downloaded file: hero image did not render offline');
  else ok('downloaded file opens offline with its images');
  if (errors.length) note(`downloaded file errors: ${errors.join(' | ')}`);
  await page.screenshot({ path: path.join(out, 'downloaded-offline.png') });
  await offline.close();
}

await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s). Screenshots in build/qa/.`);
  process.exit(1);
}
console.log('\nQA passed. Screenshots in build/qa/.');
