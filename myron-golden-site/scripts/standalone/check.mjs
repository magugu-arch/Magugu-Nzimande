#!/usr/bin/env node
/**
 * Opens the single-file export from disk, as someone who downloaded it would,
 * and exercises it: routing, embedded images and metadata, the photo viewer,
 * the menu sheet (including swipe-to-dismiss), event and library filters,
 * the honest offline forms, search, anchors and the 404.
 *
 *   npm run export:html && npm run export:check
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const file = 'file://' + path.resolve(process.argv[2] || 'dist/myron-golden-site.html');
const executablePath = existsSync('/opt/pw-browsers/chromium')
  ? '/opt/pw-browsers/chromium'
  : undefined;
const browser = await chromium.launch({ executablePath });
const errors = [];
const results = [];
const ok = (name, cond, extra = '') =>
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
await page.goto(file);
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) {
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
  }
  scrollTo(0, 0);
});
await page.waitForTimeout(400);
ok('home h1', (await page.locator('main h1').textContent()).includes('Build the offers'));
const imgs = await page.evaluate(() =>
  [...document.querySelectorAll('main img')].map((i) => ({
    ok: i.complete && i.naturalWidth > 0,
    sa: i.dataset.sa,
  })),
);
ok(
  'home images decoded',
  imgs.length > 5 && imgs.every((i) => i.ok),
  `${imgs.filter((i) => i.ok).length}/${imgs.length}`,
);
ok(
  'metadata embedded',
  await page.evaluate(() => {
    const m = JSON.parse(document.getElementById('mg-site-metadata').textContent);
    return m.assets.length === 28 && m.export.pages.length > 40 && !!m.records.programs.length;
  }),
);
ok(
  'head metadata',
  await page.evaluate(
    () =>
      !!document.querySelector('meta[property="og:title"]') &&
      !!document.querySelector('link[rel=canonical]') &&
      !!document.querySelector('script[type="application/ld+json"]'),
  ),
);
await page.click('nav[aria-label="Primary"] >> text=About');
await page.waitForTimeout(200);
ok(
  'router → about',
  page.url().endsWith('#/about') &&
    (await page.locator('main h1').textContent()).includes('Strategy for the'),
  await page.title(),
);
ok(
  'nav aria-current moves',
  (await page.locator('nav[aria-label="Primary"] a[aria-current="page"]').textContent()).trim() ===
    'About',
);
// Lightbox
const thumbs = page.locator('[data-gallery] button');
await thumbs.nth(0).click();
await page.waitForTimeout(500);
const viewer = page.locator('[role="dialog"][aria-label="Photo viewer"]');
ok('viewer opens', await viewer.isVisible());
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
ok('viewer arrow key', (await viewer.locator('.mg-viewer-count').textContent()).startsWith('2 /'));
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
ok(
  'viewer closes, focus returns',
  (await viewer.count()) === 0 &&
    (await page.evaluate(() => document.activeElement?.closest('[data-gallery]') !== null)),
);
// Events
await page.goto(file + '#/events');
await page.waitForTimeout(200);
const visibleEvents = async () =>
  page.locator('[data-events-browser] li[data-when]:not([hidden]) h3').allTextContents();
ok('events upcoming', (await visibleEvents()).length === 2);
await page.click('[data-tab="past"]');
ok('events past tab', (await visibleEvents()).length === 4);
await page.selectOption('#filter-format', 'online');
ok('events filter', (await visibleEvents()).length === 2, (await visibleEvents()).join(' | '));
ok('month toggle hidden', await page.locator('[data-view-toggle]').isHidden());
// Library
await page.goto(file + '#/learn');
await page.waitForTimeout(200);
await page.click('[data-filter-type="article"]');
const shown = async () =>
  page.locator('[data-library-browser] li[data-text]:not([hidden])').count();
ok('library type filter', (await shown()) === 3);
await page.click('[data-filter-type="all"]');
await page.fill('#library-search', 'stewardship');
ok('library search', (await shown()) === 1);
// Video
await page.click('[data-video-facade] button');
ok(
  'video honest message',
  (await page.locator('[data-video-facade] [role="status"]').first().textContent()).includes(
    'official upload',
  ),
);
// Forms
await page.goto(file + '#/speaking');
await page.waitForTimeout(200);
await page.click('button:has-text("Send enquiry")');
ok('form invalid notice', await page.locator('.mg-notice[role="alert"]').isVisible());
await page.goto(file + '#/contact?topic=press');
await page.waitForTimeout(200);
ok(
  'contact topic preselect',
  (await page.locator('select[name="category"]').inputValue()) === 'press',
);
await page.fill('input[name="name"]', 'Test');
await page.fill('input[name="email"]', 'test@example.com');
await page.fill('input[name="subject"]', 'Hello');
await page.fill('textarea[name="message"]', 'A message long enough.');
await page.check('input[name="consent"]');
await page.click('button:has-text("Send message")');
ok(
  'form offline success',
  (await page.locator('.mg-notice[role="status"]').textContent()).includes('nothing was sent'),
);
// Booking
await page.goto(file + '#/events/business-growth-workshop/book');
await page.waitForTimeout(200);
await page.click('button[aria-label="One seat more"]');
await page.click('button[aria-label="One seat more"]');
ok(
  'booking stepper and total',
  (await page.locator('#quantity').inputValue()) === '3' &&
    (await page.locator('[data-booking-total]').textContent()).trim() === '$300.00',
);
await page.click('button:has-text("Continue to payment")');
ok('booking invalid notice', await page.locator('.mg-notice[role="alert"]').isVisible());
await page.fill('input[name="name"]', 'Test');
await page.fill('input[name="email"]', 'test@example.com');
await page.check('input[name="consent"]');
await page.click('button:has-text("Continue to payment")');
ok(
  'booking offline: nothing booked or charged',
  (await page.locator('.mg-notice[role="status"]').textContent()).includes('no payment was taken'),
);
// Search
await page.goto(file + '#/search?q=offers');
await page.waitForTimeout(200);
ok(
  'search results',
  (await page.locator('main [role="status"]').first().textContent()).includes('for “offers”'),
);
// Anchors and 404
await page.goto(file + '#/speaking#enquire');
await page.waitForTimeout(300);
ok(
  'cross-page anchor',
  await page.evaluate(() => {
    const r = document.getElementById('enquire').getBoundingClientRect();
    return r.top < 200 && r.top > -50;
  }),
);
await page.goto(file + '#/no-such-page');
await page.waitForTimeout(200);
ok('404 template', (await page.locator('main h1').textContent()).includes('left the stage'));
await page.goto(file + '#/books/boss-moves');
await page.waitForTimeout(200);
ok(
  'placeholder cover label',
  await page.getByText('Placeholder mock-up — not the official cover').isVisible(),
);
await ctx.close();

// Mobile menu
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const mp = await m.newPage();
mp.on('pageerror', (e) => errors.push('pageerror(mobile): ' + e.message));
await mp.goto(file);
await mp.click('button[aria-controls="mobile-menu"]');
await mp.waitForTimeout(500);
const menu = mp.locator('#mobile-menu');
ok('menu opens', await menu.isVisible());
ok(
  'menu focus on close',
  await mp.evaluate(() => document.activeElement?.textContent.includes('Close menu')),
);
ok(
  'page inert while open',
  await mp.evaluate(() => document.getElementById('site-shell').hasAttribute('inert')),
);
await mp.keyboard.press('Escape');
await mp.waitForTimeout(600);
ok(
  'menu closes, focus returns',
  await mp.evaluate(
    () =>
      document.activeElement?.getAttribute('aria-controls') === 'mobile-menu' &&
      !document.getElementById('site-shell').hasAttribute('inert'),
  ),
);
await mp.click('button[aria-controls="mobile-menu"]');
await mp.waitForTimeout(500);
const box = await menu.boundingBox();
await mp.mouse.move(box.x + 40, box.y + 160);
await mp.mouse.down();
for (let i = 1; i <= 8; i++) {
  await mp.mouse.move(box.x + 40 + i * 30, box.y + 160);
  await mp.waitForTimeout(8);
}
await mp.mouse.up();
await mp.waitForTimeout(700);
ok('menu swipe-to-dismiss', await mp.locator('.mg-layer').first().isHidden());
await mp.click('button[aria-controls="mobile-menu"]');
await mp.waitForTimeout(400);
await menu.locator('a:has-text("Books")').first().click();
await mp.waitForTimeout(400);
ok(
  'menu link navigates',
  mp.url().endsWith('#/books') && (await mp.locator('.mg-layer').first().isHidden()),
);
const overflow = await mp.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
ok('no sideways scroll (mobile)', overflow === 0, String(overflow));
await m.close();
await browser.close();
console.log(results.join('\n'));
console.log(
  errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'No page or console errors.',
);
process.exit(results.some((r) => r.startsWith('FAIL')) || errors.length ? 1 : 0);
