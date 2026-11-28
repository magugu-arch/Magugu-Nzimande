#!/usr/bin/env node
/**
 * End-to-end: the other money and messaging paths.
 *  1. Gift a Jump: buy a Jump + Film voucher on desktop, pay on the simulated
 *     checkout, open the printable voucher.
 *  2. Redeem it on an iPhone: /book?voucher=CODE covers the whole booking, so
 *     nothing is due and the ticket is issued without a payment step.
 *  3. Event RSVP (free) and a paid event ticket.
 *  4. Chat: a quick topic gets an instant answer.
 *  5. Find my jump: look up the redeemed booking by reference and email.
 *
 * Usage: node tests/e2e/flows.mjs <baseUrl> [shotsDir]. Exits non-zero on failure.
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:3000';
const shots = process.argv[3] ?? path.resolve(import.meta.dirname, 'shots');
await mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/open-meteo|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return page;
};

let n = 0;
let page;
const shot = async (name) => page.screenshot({ path: path.join(shots, `flows-${String(++n).padStart(2, '0')}-${name}.png`), caret: 'initial' });
const step = async (label, fn) => {
  process.stdout.write(`• ${label} … `);
  await fn();
  console.log('ok');
};
const unique = Date.now().toString(36).slice(-5);
// Each run looks like a fresh visitor, so the per-IP rate limits don't trip on reruns.
const octet = () => Math.floor(Math.random() * 250) + 2;
const visitor = { 'x-real-ip': `10.${octet()}.${octet()}.${octet()}` };
const buyer = { name: 'Naledi Dlamini', phone: '083 555 0192', email: `naledi.${unique}@example.com` };

try {
  // ── 1. Buy a voucher on desktop ────────────────────────────────────────────
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: visitor });
  page = watch(await desktop.newPage());
  let code = '';
  let voucherUrl = '';

  await step('gift: choose Jump + Film for someone', async () => {
    await page.goto(`${base}/gift`, { waitUntil: 'load' });
    await page.getByRole('radio', { name: /Jump \+ Film/ }).click();
    await page.getByLabel('Their name').fill('Lerato');
    await page.getByRole('radio', { name: 'Send to me to print' }).click();
    await page.getByLabel('Your message (optional)').fill('Happy birthday! Time to face the drop.');
    await page.getByLabel('Your name').fill(buyer.name);
    await page.getByLabel('Your mobile').fill(buyer.phone);
    await page.getByLabel('Your email (for the receipt)').fill(buyer.email);
    const preview = await page.getByLabel('Voucher preview').textContent();
    if (!/For Lerato/.test(preview) || !/R760/.test(preview)) throw new Error(`preview: ${preview}`);
  });

  await step('gift: terms are required', async () => {
    await page.getByRole('button', { name: 'Pay R760' }).click();
    await page.locator('[class*="errors"][role="alert"]').waitFor();
    await page.getByLabel(/I accept the voucher terms/).check();
    await shot('gift');
    await Promise.all([page.waitForURL(/\/checkout\/demo\//, { timeout: 30000 }), page.getByRole('button', { name: 'Pay R760' }).click()]);
  });

  await step('gift: pay and receive the voucher', async () => {
    await Promise.all([page.waitForURL(/\/booking\/.+\/return/, { timeout: 30000 }), page.getByRole('button', { name: /^Pay R760$/ }).click()]);
    await page.getByRole('heading', { name: 'Your gift is on its way.' }).waitFor({ timeout: 30000 });
    const link = page.locator('a[href*="/voucher/GIFT-"]').first();
    voucherUrl = await link.getAttribute('href');
    code = voucherUrl.match(/GIFT-[A-Z0-9]{4}-[A-Z0-9]{4}/)?.[0] ?? '';
    if (!code) throw new Error(`no voucher link: ${voucherUrl}`);
    await shot('gift-paid');
  });

  await step(`voucher page shows ${code} with a QR`, async () => {
    await page.goto(base + voucherUrl, { waitUntil: 'load' });
    await page.getByRole('article', { name: `Gift a Jump voucher ${code}` }).waitFor();
    await page.getByRole('img', { name: 'QR code to book with this voucher' }).waitFor();
    const text = await page.locator('main').textContent();
    if (!/Lerato/.test(text)) throw new Error('recipient missing on voucher');
    await shot('voucher');
  });

  await step('voucher check API: valid with R760 balance', async () => {
    const r = await page.request.get(`${base}/api/vouchers?code=${code}`);
    const d = await r.json();
    if (!d.valid || d.balance !== 760) throw new Error(JSON.stringify(d));
  });
  await desktop.close();

  // ── 2. Redeem on an iPhone ────────────────────────────────────────────────
  const phone = await browser.newContext({ ...devices['iPhone 15'], extraHTTPHeaders: visitor });
  page = watch(await phone.newPage());
  const next = () => page.locator('[class*="mobileBar"] button.btn--primary').click();
  let ref = '';

  await step('redeem: /book?voucher= pre-fills the code', async () => {
    await page.goto(`${base}/book?package=jump-film&voucher=${code.toLowerCase()}`, { waitUntil: 'load' });
    await page.getByRole('heading', { name: 'Pick your adventure' }).waitFor();
    await next();
    await page.getByRole('heading', { name: 'Who’s jumping?' }).waitFor();
    await next();
    await page.getByRole('heading', { name: 'When are you coming?' }).waitFor();
    await page.locator('button[role="gridcell"]:not([disabled])').first().click();
    await page.locator('[class*="slotGrid"] button:not([disabled])').first().click();
    await next();
    await page.getByRole('heading', { name: 'Safety first' }).waitFor();
    await page.getByLabel('First name').first().fill('Lerato');
    await page.getByLabel('Weight (kg)').first().fill('58');
    await page.getByLabel('Everyone in this booking is 12 or older.').check();
    await page.getByLabel('Nobody taking part has any of these conditions.').check();
    await next();
  });

  await step('redeem: voucher applies and nothing is due', async () => {
    await page.getByRole('heading', { name: 'Your details' }).waitFor();
    const panel = page.locator('section[aria-labelledby="step-title"]');
    await panel.getByLabel('Full name').fill('Lerato Khumalo');
    await panel.getByLabel('Mobile (WhatsApp)').fill('072 555 0144');
    await panel.getByLabel(/^Email/).fill(`lerato.${unique}@example.com`);
    const status = page.locator('#voucher-msg');
    await status.waitFor({ timeout: 15000 });
    if (!/R760/.test(await status.textContent())) {
      await page.getByRole('button', { name: 'Apply' }).click();
      await page.waitForFunction(() => /R760/.test(document.querySelector('#voucher-msg')?.textContent ?? ''), null, { timeout: 15000 });
    }
    await shot('redeem-details');
    await next();
    await page.getByRole('heading', { name: 'Check and pay' }).waitFor();
    const due = await page.locator('[class*="mobileTotal"] .price').textContent();
    if (due.trim() !== 'R0') throw new Error(`due after voucher: ${due}`);
    await page.getByLabel(/I accept the/).check();
    await shot('redeem-review');
    await Promise.all([page.waitForURL(/\/(ticket|booking)\//, { timeout: 30000 }), next()]);
  });

  await step('redeem: ticket issued without payment', async () => {
    if (/\/booking\//.test(page.url())) {
      await page.getByRole('heading', { name: /100mClub/ }).waitFor({ timeout: 30000 });
      await Promise.all([page.waitForURL(/\/ticket\//), page.getByRole('link', { name: /Open your ticket/ }).click()]);
    }
    const qr = page.getByRole('img', { name: /QR code for booking ST-/ });
    await qr.waitFor();
    ref = (await qr.getAttribute('aria-label')).match(/ST-[A-Z0-9]{6}/)[0];
    await shot('redeem-ticket');
  });

  await step('voucher is now used up', async () => {
    const d = await (await page.request.get(`${base}/api/vouchers?code=${code}`)).json();
    if (d.valid) throw new Error(`still valid: ${JSON.stringify(d)}`);
  });

  // ── 3. Events ─────────────────────────────────────────────────────────────
  await step('event: free RSVP issues a ticket', async () => {
    await page.goto(`${base}/events/relaunch-weekend`, { waitUntil: 'load' });
    const card = page.getByRole('complementary', { name: 'Tickets' });
    await card.getByLabel('Full name').fill(buyer.name);
    await card.getByLabel('Mobile (WhatsApp)').fill(buyer.phone);
    await card.getByLabel('Email', { exact: true }).fill(buyer.email);
    await card.getByLabel(/I accept the/).check();
    await shot('event');
    await Promise.all([page.waitForURL(/\/ticket\//, { timeout: 30000 }), card.getByRole('button', { name: 'RSVP' }).click()]);
    await page.getByRole('img', { name: /QR code for booking ST-/ }).waitFor();
    await shot('event-ticket');
  });

  await step('event: paid ticket goes through checkout', async () => {
    await page.goto(`${base}/events/families-from-the-top`, { waitUntil: 'load' });
    const card = page.getByRole('complementary', { name: 'Tickets' });
    await card.getByRole('button', { name: 'One more' }).click();
    await card.getByLabel('Full name').fill(buyer.name);
    await card.getByLabel('Mobile (WhatsApp)').fill(buyer.phone);
    await card.getByLabel('Email', { exact: true }).fill(buyer.email);
    await card.getByLabel(/I accept the/).check();
    await Promise.all([page.waitForURL(/\/checkout\/demo\//, { timeout: 30000 }), card.getByRole('button', { name: 'Pay R160' }).click()]);
    await Promise.all([page.waitForURL(/\/booking\/.+\/return/, { timeout: 30000 }), page.getByRole('button', { name: /^Pay R160$/ }).click()]);
    await page.getByRole('link', { name: /Open your ticket/ }).waitFor({ timeout: 30000 });
  });

  // ── 4. Chat ───────────────────────────────────────────────────────────────
  await step('chat: a quick topic is answered at once', async () => {
    await page.goto(`${base}/visit`, { waitUntil: 'load' });
    await page.getByRole('button', { name: /^Ask the crew/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Ask the crew' });
    await dialog.waitFor();
    await dialog.locator('[class*="topics"] button').first().click();
    await page.waitForFunction(() => document.querySelectorAll('#crew-chat [class*="theirs"]').length >= 2, null, { timeout: 15000 });
    await dialog.getByLabel('Your message').fill('Can I bring my own GoPro?');
    await dialog.getByRole('button', { name: /Send/ }).click();
    await page.waitForFunction(() => /GoPro/.test(document.querySelector('#crew-chat')?.textContent ?? ''), null, { timeout: 15000 });
    await shot('chat');
  });

  // ── 5. Find my jump ───────────────────────────────────────────────────────
  await step('find my jump: wrong email is refused', async () => {
    await page.goto(`${base}/find-my-jump`, { waitUntil: 'load' });
    await page.getByLabel('Booking reference').fill(ref);
    await page.getByLabel('Email you booked with').fill('someone.else@example.com');
    await page.getByRole('button', { name: /Find/ }).click();
    await page.locator('.field-error[role="alert"]').waitFor({ timeout: 15000 });
  });

  await step(`find my jump: ${ref} by email`, async () => {
    await page.getByLabel('Email you booked with').fill(`lerato.${unique}@example.com`);
    await page.getByRole('button', { name: /Find/ }).click();
    await page.getByText(ref, { exact: true }).waitFor({ timeout: 15000 });
    await shot('find');
  });
  await phone.close();

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
