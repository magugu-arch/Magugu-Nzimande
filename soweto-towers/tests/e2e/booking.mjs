#!/usr/bin/env node
/**
 * End-to-end: book Jump + Film for two on an iPhone, pay on the simulated
 * checkout, land on the ticket. Usage: node tests/e2e/booking.mjs <baseUrl> [shotsDir]
 * Exits non-zero on any failure.
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:3000';
const shots = process.argv[3] ?? path.resolve(import.meta.dirname, 'shots');
await mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 15'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/open-meteo|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
});

let n = 0;
const shot = async (name) => page.screenshot({ path: path.join(shots, `${String(++n).padStart(2, '0')}-${name}.png`), caret: 'initial' });
const step = async (label, fn) => {
  process.stdout.write(`• ${label} … `);
  await fn();
  console.log('ok');
};
const next = () => page.locator('[class*="mobileBar"] button.btn--primary').click();

try {
  await step('open /book', async () => {
    await page.goto(`${base}/book?package=jump-film`, { waitUntil: 'load' });
    await page.getByRole('heading', { name: 'Pick your adventure' }).waitFor();
    await shot('adventure');
  });

  await step('Jump + Film is pre-selected at R760', async () => {
    const checked = await page.locator('input[name="package"]:checked').evaluate((el) => el.closest('label').textContent);
    if (!/Jump \+ Film/.test(checked)) throw new Error(`pre-selected package: ${checked}`);
    const total = await page.locator('[class*="mobileTotal"] .price').textContent();
    if (total.trim() !== 'R760') throw new Error(`total ${total}`);
    await next();
  });

  await step('two people', async () => {
    await page.getByRole('heading', { name: 'Who’s jumping?' }).waitFor();
    await page.getByRole('button', { name: 'One more' }).click();
    const total = await page.locator('[class*="mobileTotal"] .price').textContent();
    if (total.trim() !== 'R1,520') throw new Error(`total for 2: ${total}`);
    await shot('people');
    await next();
  });

  await step('pick the first open date and a time', async () => {
    await page.getByRole('heading', { name: 'When are you coming?' }).waitFor();
    const day = page.locator('button[role="gridcell"]:not([disabled])').first();
    await day.waitFor({ timeout: 20000 });
    await day.click();
    const slot = page.locator('[class*="slotGrid"] button:not([disabled])').nth(2);
    await slot.waitFor({ timeout: 20000 });
    await slot.click();
    await shot('when');
    await next();
  });

  await step('safety: names, weights, 12+, medical', async () => {
    await page.getByRole('heading', { name: 'Safety first' }).waitFor();
    // Try to continue without details: errors must show.
    await next();
    await page.locator('[class*="errors"][role="alert"]').waitFor();
    const names = page.getByLabel('First name');
    const weights = page.getByLabel('Weight (kg)');
    await names.nth(0).fill('Thandi');
    await weights.nth(0).fill('64');
    await names.nth(1).fill('Sipho');
    await weights.nth(1).fill('121');
    await page.getByLabel('Everyone in this booking is 12 or older.').check();
    await page.getByLabel('Nobody taking part has any of these conditions.').check();
    await next();
    const alert = await page.locator('[class*="errors"][role="alert"]').textContent();
    if (!/35–110 kg/.test(alert)) throw new Error(`weight limit not enforced: ${alert}`);
    await weights.nth(1).fill('82');
    await shot('safety');
    await next();
  });

  await step('details and consents', async () => {
    await page.getByRole('heading', { name: 'Your details' }).waitFor();
    const panel = page.locator('section[aria-labelledby="step-title"]');
    await panel.getByLabel('Full name').fill('Thandi Mokoena');
    await panel.getByLabel('Mobile (WhatsApp)').fill('082 123 4567');
    await panel.getByLabel(/^Email/).fill('thandi@example.com');
    await panel.getByLabel(/repost our jump clips/).check();
    await shot('details');
    await next();
  });

  await step('review and pay', async () => {
    await page.getByRole('heading', { name: 'Check and pay' }).waitFor();
    await page.getByLabel(/I accept the/).check();
    await shot('review');
    await Promise.all([page.waitForURL(/\/checkout\/demo\//, { timeout: 30000 }), next()]);
  });

  await step('simulated checkout', async () => {
    await page.getByText('Test mode · no money moves').waitFor();
    await shot('checkout');
    await Promise.all([page.waitForURL(/\/booking\/.+\/return/, { timeout: 30000 }), page.getByRole('button', { name: /^Pay R1,520$/ }).click()]);
  });

  await step('payment confirmed', async () => {
    await page.getByRole('heading', { name: /100mClub/ }).waitFor({ timeout: 30000 });
    await shot('confirmed');
    await Promise.all([page.waitForURL(/\/ticket\//), page.getByRole('link', { name: /Open your ticket/ }).click()]);
  });

  await step('ticket with QR', async () => {
    await page.getByRole('img', { name: /QR code for booking ST-/ }).waitFor();
    await shot('ticket');
  });

  if (errors.length) throw new Error(`browser errors:\n${errors.join('\n')}`);
  console.log(`\nPASS · screenshots in ${shots}`);
} catch (err) {
  console.log('FAIL');
  await shot('failure').catch(() => {});
  console.error(err.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
}
