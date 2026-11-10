#!/usr/bin/env node
/**
 * Browser smoke test for the admin against a running server:
 *   npm run build -w @kc-one/admin && npm run start -w @kc-one/admin &
 *   node apps/admin/scripts/smoke.mjs [baseUrl] [--shots dir]
 *
 * Signs in as several demo roles, checks each sees only what it may, makes a
 * moderation decision and confirms it lands in the audit log.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:3100';
const shotsIdx = args.indexOf('--shots');
const shots = shotsIdx >= 0 ? args[shotsIdx + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });

const browser = await chromium
  .launch()
  .catch(() =>
    chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }),
  );
const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures.push(msg);
};

async function signedIn(staffId) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/sign-in`);
  await page.check(`input[value="${staffId}"]`);
  await page.click('button[type=submit]');
  await page.waitForURL(`${base}/`);
  return { ctx, page, errors };
}

async function shot(page, name) {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`), fullPage: true });
}

// Anonymous visitors are sent to sign in.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${base}/moderation`);
  check(page.url().endsWith('/sign-in'), 'anonymous visitor is redirected to sign-in');
  await shot(page, '01-sign-in');
  await ctx.close();
}

// Moderator: can moderate, cannot manage roles or read the audit log.
{
  const { ctx, page, errors } = await signedIn('demo-staff-mod');
  await shot(page, '02-dashboard-moderator');
  const nav = await page.locator('nav a').allTextContents();
  check(
    !nav.includes('Staff roles') && nav.includes('Fan Moments'),
    `moderator nav: ${nav.join(', ')}`,
  );
  await page.goto(`${base}/roles`);
  check(page.url().includes('/forbidden'), 'moderator is refused /roles');
  await page.goto(`${base}/moderation`);
  const card = page.locator('article', { hasText: 'Scarves up' });
  await card.locator('input[name=reason]').fill('Meets the community rules');
  await card.locator('button[value=approve]').click();
  await page.waitForURL(/notice=/);
  check(
    (await page.locator('[role=status]').textContent())?.includes('Decision recorded') ?? false,
    'moderator approves with a reason',
  );
  await shot(page, '03-moderation');
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  await ctx.close();
}

// Analyst: read-only, sees the audit entry the moderator created.
{
  const { ctx, page } = await signedIn('demo-staff-analyst');
  await page.goto(`${base}/audit`);
  check(
    ((await page.locator('table').textContent()) ?? '').includes('fan_post.approve'),
    'analyst sees the moderation decision in the audit log',
  );
  await shot(page, '04-audit');
  await page.goto(`${base}/content`);
  check(
    (await page.locator('form[aria-label="New draft"]').count()) === 0,
    'analyst gets no content editor',
  );
  await ctx.close();
}

// Content admin and super admin pages render.
{
  const { ctx, page } = await signedIn('demo-staff-content');
  await page.goto(`${base}/content`);
  await shot(page, '05-content');
  await page.goto(`${base}/notifications`);
  await page.fill('input[name=title]', 'Line-ups are in');
  await page.fill('textarea[name=body]', 'See who starts today.');
  await page.fill('input[name=deepLink]', '/match');
  await page.click('form[aria-label="New campaign"] button[type=submit]');
  await page.waitForURL(/notice=/);
  check(
    (await page.locator('.preview').count()) === 1,
    'content admin drafts a campaign with a preview',
  );
  await shot(page, '06-notifications');
  await ctx.close();
}
{
  const { ctx, page } = await signedIn('demo-staff-root');
  await shot(page, '07-dashboard');
  await page.goto(`${base}/roles`);
  check(page.url().endsWith('/roles'), 'super admin opens staff roles');
  await shot(page, '08-roles');
  await ctx.close();
}

await browser.close();
console.log(failures.length ? `\n${failures.length} failed` : '\nAll admin smoke checks passed');
process.exit(failures.length ? 1 : 0);
