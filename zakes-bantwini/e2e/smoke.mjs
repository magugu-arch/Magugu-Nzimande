#!/usr/bin/env node
/**
 * Real browser, real server.
 *
 * 1. Every public page at 320, 390 and 1440 px: no horizontal overflow, no
 *    console errors, no serious/critical axe violations, an <h1>.
 * 2. The commercial journey end to end: request → admin review and quote →
 *    client accepts and signs → sandbox deposit → management confirms → the
 *    public calendar shows the date unavailable without leaking anything.
 * 3. The admin workspace renders every view, and is closed without a session.
 *
 * Usage: npm run build && npm run smoke
 *   SMOKE_BASE_URL=http://localhost:3000 npm run smoke   (reuse a running server)
 * Starts `next start` itself otherwise, with a throwaway file store and the
 * sandbox payment provider. Screenshots land in .smoke/.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.smoke');
const PORT = Number(process.env.SMOKE_PORT ?? 3210);
const ADMIN = { email: 'smoke-admin@example.com', password: 'smoke-test-password-1234' };
let base = process.env.SMOKE_BASE_URL;
let server;

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);
const check = (cond, good, bad) => {
  if (cond) ok(good);
  else fail(bad);
};

async function startServer() {
  // A leftover server on the port would silently answer instead of ours.
  if (await fetch(`http://localhost:${PORT}`).then(() => true, () => false)) {
    throw new Error(`port ${PORT} is already in use — stop that server or set SMOKE_PORT`);
  }
  const dataDir = path.join(OUT, 'data');
  rmSync(dataDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });
  base = `http://localhost:${PORT}`;
  server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: base,
      APP_SECRET: 'smoke-test-secret-that-is-long-enough-123456',
      ALLOW_FILE_STORE: 'true',
      FILE_STORE_PATH: path.join(dataDir, 'store.json'),
      UPLOAD_DIR: path.join(dataDir, 'uploads'),
      PAYMENTS_PROVIDER: 'sandbox',
      ALLOW_SANDBOX_PAYMENTS: 'true',
      ADMIN_BOOTSTRAP_EMAIL: ADMIN.email,
      ADMIN_BOOTSTRAP_PASSWORD: ADMIN.password,
      CRON_SECRET: 'smoke-cron',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group, so stopping it also stops the next-server child npx spawns.
    detached: true,
  });
  server.stderr.on('data', (d) => process.env.SMOKE_VERBOSE && process.stderr.write(d));
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(base);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('next start did not come up');
}

const PAGES = [
  '/',
  '/music',
  '/music/release-i',
  '/videos',
  '/videos/official-video',
  '/live',
  '/book',
  '/book/request',
  '/story',
  '/architect',
  '/handover',
  '/journal',
  '/journal/what-an-archive-is-for',
  '/press',
  '/collaborate',
  '/community',
  '/privacy',
  '/this-page-does-not-exist',
];
const WIDTHS = [320, 390, 1440];

async function sweep(browser) {
  console.log('\nPages');
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    for (const p of PAGES) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && !/status of 404/.test(m.text()) && errors.push(m.text()));
      const res = await page.goto(base + p, { waitUntil: 'load' });
      const expected = p === '/this-page-does-not-exist' ? 404 : 200;
      if (res?.status() !== expected) fail(`${p} @${width}: HTTP ${res?.status()}`);
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) fail(`${p} @${width}: ${overflow}px horizontal overflow`);
      if ((await page.locator('h1').count()) < 1) fail(`${p} @${width}: no <h1>`);
      if (errors.length) fail(`${p} @${width}: console errors — ${errors.slice(0, 2).join(' | ')}`);
      if (width !== 320) {
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        for (const v of serious) fail(`${p} @${width}: axe ${v.id} (${v.nodes.length}) — ${v.nodes[0]?.target.join(' ')}`);
      }
      if (width !== 320) await page.screenshot({ path: path.join(OUT, `${width}${p === '/' ? '_home' : p.replace(/\//g, '_')}.png`) });
      await page.close();
    }
    await context.close();
    ok(`swept ${PAGES.length} pages at ${width}px`);
  }
}

async function journey(browser) {
  console.log('\nBooking journey');
  const client = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await client.goto(`${base}/book/request`);
  await client.getByRole('button', { name: 'Next month' }).click();
  await client.locator('button[data-state="available"]').nth(12).click();
  const chosen = await client.locator('button[aria-selected], td[aria-selected="true"] button').first().getAttribute('data-date');
  await client.getByRole('button', { name: 'Continue' }).click();
  await client.getByLabel('Corporate event').check();
  await client.getByLabel('Performance format').selectOption('headline');
  await client.getByLabel('Start time').fill('19:30');
  await client.getByLabel('Expected attendance').fill('650');
  await client.getByLabel('Budget range').selectOption('discuss');
  await client.getByRole('button', { name: 'Continue' }).click();
  await client.getByLabel('Venue').fill('Smoke Test Hall');
  await client.getByLabel('City').fill('Johannesburg');
  await client.getByRole('button', { name: 'Continue' }).click();
  await client.getByLabel('Full name').fill('Smoke Tester');
  await client.getByLabel('Email').fill('smoke@example.com');
  await client.getByLabel('Mobile / WhatsApp').fill('+27 82 000 0000');
  await client.getByRole('button', { name: 'Continue' }).click();
  await client.getByLabel(/I agree to Zakes/).check();
  await client.getByRole('button', { name: 'Send booking request' }).click();
  await client.waitForURL(/\/book\/confirmation\//);
  const portal = client.url();
  const reference = (await client.locator('h1').innerText()).trim();
  check(/^ZB-\d{4}-\d{4}$/.test(reference), `request submitted → ${reference}`, `unexpected reference ${reference}`);

  const admin = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const closed = await admin.goto(`${base}/admin`);
  check(admin.url().includes('/admin/login'), 'admin is closed without a session', `admin reachable without login (${closed?.status()})`);
  await admin.getByLabel('Email').fill(ADMIN.email);
  await admin.getByLabel('Password').fill(ADMIN.password);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await admin.waitForURL(`${base}/admin`);
  ok('admin signed in (bootstrap owner)');
  await admin.screenshot({ path: path.join(OUT, 'admin-dashboard.png'), fullPage: true });

  await admin.getByRole('link', { name: reference }).first().click();
  await admin.waitForURL(/\/admin\/bookings\//);
  await admin.getByLabel('Move to').selectOption('IN_REVIEW');
  await admin.getByRole('button', { name: 'Update status' }).click();
  await admin.getByText('Status updated.').waitFor();
  await admin.getByLabel('Amount (R)').first().fill('250000');
  await admin.getByLabel('Amount (R)').nth(1).fill('18000');
  await admin.getByRole('button', { name: 'Save and send to client' }).click();
  await admin.getByText(/Quote v1 sent/).waitFor();
  ok('quote prepared and sent');
  await admin.screenshot({ path: path.join(OUT, 'admin-booking.png'), fullPage: true });

  await client.goto(portal.replace('/confirmation/', '/quote/'));
  await client.getByRole('button', { name: 'Accept quote' }).click();
  await client.waitForURL(/\/book\/confirmation\/.*accepted=1/);
  await client.getByText(/Quote accepted/).first().waitFor();
  ok('client accepted the quote and landed on the agreement');
  await client.getByLabel(/I have read the agreement/).check();
  await client.getByRole('button', { name: 'Sign agreement' }).click();
  await client.getByText(/Signed by/).first().waitFor();
  ok('client signed the agreement');
  await client.reload();
  await client.getByRole('button', { name: /Pay deposit/ }).click();
  await client.waitForURL(/\/book\/pay\/sandbox/);
  await client.getByRole('button', { name: 'Simulate successful payment' }).click();
  await client.waitForURL(/payment=returned/);
  check((await client.getByText('Received').count()) > 0, 'deposit received via the sandbox gateway', 'deposit not recorded');

  await admin.reload();
  await admin.getByRole('button', { name: 'Confirm booking' }).click();
  await admin.getByText(/Booking confirmed/).waitFor();
  await client.reload();
  check((await client.getByText('Booking confirmed').count()) > 0, 'management confirmed; client sees “Booking confirmed”', 'client does not see confirmation');
  await client.screenshot({ path: path.join(OUT, 'portal-confirmed.png'), fullPage: true });

  const cal = await (await fetch(`${base}/api/availability?from=${chosen}&to=${chosen}`)).json();
  const leak = JSON.stringify(cal).match(/Smoke|ZB-|smoke@/);
  check(cal.days?.[chosen] === 'unavailable' && !leak, 'public calendar shows the date unavailable and nothing else', `public calendar: ${JSON.stringify(cal)}`);

  for (const p of ['/admin/bookings', '/admin/calendar', `/admin/calendar?view=week&date=${chosen}`, `/admin/calendar?view=day&date=${chosen}`, '/admin/events', '/admin/inbox', '/admin/content']) {
    const res = await admin.goto(base + p);
    check(res?.ok(), `admin ${p}`, `admin ${p}: HTTP ${res?.status()}`);
  }
  await admin.goto(`${base}/admin/calendar`);
  await admin.screenshot({ path: path.join(OUT, 'admin-calendar.png'), fullPage: true });

  const cron = await fetch(`${base}/api/cron/reminders`, { headers: { authorization: 'Bearer wrong' } });
  check(cron.status === 401, 'cron endpoint refuses a bad secret', `cron endpoint answered ${cron.status} to a bad secret`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
if (!base) await startServer();
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
try {
  await journey(browser);
  await sweep(browser);
} catch (error) {
  fail(`crashed: ${error instanceof Error ? error.message.split('\n')[0] : error}`);
  // Leave evidence: every open page as it was when the step failed.
  let i = 0;
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      await page.screenshot({ path: path.join(OUT, `failure-${i++}.png`), fullPage: true }).catch(() => {});
    }
  }
} finally {
  await browser.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
}

console.log(failures.length ? `\n${failures.length} problem(s).` : '\nAll checks passed.');
process.exit(failures.length ? 1 : 0);
