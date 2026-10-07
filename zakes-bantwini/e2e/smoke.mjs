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
 * 4. Everything else management and visitors do: the brief upload, the menu
 *    dialog, the Home button, community and collaboration forms and proposal triage, a public
 *    listing reaching /live, a content edit and cover art reaching the site,
 *    CSV export, team accounts, and the security headers.
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
const FIXTURES = path.join(root, 'e2e', 'fixtures');
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
      if (expected === 404 && (await page.getByText('Wrong turn').count()) === 0) fail(`${p} @${width}: the designed 404 page did not render`);
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
  await client.setInputFiles('#brief', path.join(FIXTURES, 'event-brief.pdf'));
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
  const briefLink = admin.getByRole('link', { name: 'event-brief.pdf' });
  check((await briefLink.count()) === 1, 'the uploaded event brief is on the booking', 'event brief missing from the booking');
  const briefHref = await briefLink.getAttribute('href');
  const asAdmin = await admin.request.get(base + briefHref);
  const anonymous = await fetch(base + briefHref);
  check(
    asAdmin.ok() && (await asAdmin.body()).subarray(0, 4).toString() === '%PDF' && anonymous.status === 404,
    'brief downloads for management only',
    `brief download: admin ${asAdmin.status()}, anonymous ${anonymous.status}`,
  );
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

  for (const p of ['/admin/bookings', '/admin/calendar', `/admin/calendar?view=week&date=${chosen}`, `/admin/calendar?view=day&date=${chosen}`, '/admin/events', '/admin/inbox', '/admin/content', '/admin/content/assets', '/admin/content/albums/release-i', '/admin/content/settings/default', '/admin/content/pressKit/default', '/admin/team']) {
    const res = await admin.goto(base + p);
    check(res?.ok(), `admin ${p}`, `admin ${p}: HTTP ${res?.status()}`);
  }
  await admin.goto(`${base}/admin/calendar`);
  await admin.screenshot({ path: path.join(OUT, 'admin-calendar.png'), fullPage: true });

  const cron = await fetch(`${base}/api/cron/reminders`, { headers: { authorization: 'Bearer wrong' } });
  check(cron.status === 401, 'cron endpoint refuses a bad secret', `cron endpoint answered ${cron.status} to a bad secret`);
  return { admin, reference };
}

async function everythingElse(browser, admin, reference) {
  console.log('\nVisitors');
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await phone.goto(`${base}/`);
  await phone.getByRole('button', { name: 'Menu' }).click();
  const menu = phone.getByRole('dialog', { name: 'Site menu' });
  await menu.waitFor();
  await phone.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  check(await phone.evaluate(() => document.activeElement?.textContent?.trim() === 'Menu'), 'menu dialog opens, closes on Escape and returns focus', 'menu focus not returned');

  const homeButton = phone.locator('[data-home-button]');
  const onHome = await homeButton.count();
  await phone.goto(`${base}/journal/what-an-archive-is-for`);
  await phone.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const box = await homeButton.boundingBox();
  await homeButton.click();
  await phone.waitForURL(`${base}/`);
  await homeButton.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  check(
    onHome === 0 && box && box.x < 40 && box.y + box.height > 844 - 80 && (await homeButton.count()) === 0,
    'Home button floats bottom-left on inner pages, returns home, and is absent on home',
    `Home button: ${onHome} on home, box ${JSON.stringify(box)}`,
  );

  await phone.goto(`${base}/community`);
  const join = phone.locator('form').filter({ has: phone.getByRole('button', { name: 'Join the movement' }) }).first();
  await join.getByLabel('Email', { exact: true }).fill('smoke-fan@example.com');
  await join.getByRole('button', { name: 'Join the movement' }).click();
  await phone.getByText(/You are in/).first().waitFor();
  ok('community signup accepted');

  await phone.goto(`${base}/collaborate`);
  const pitch = phone.locator('form').filter({ has: phone.getByRole('button', { name: 'Send proposal' }) });
  await pitch.getByLabel('Brand partnership').check();
  await pitch.getByLabel('Your name').fill('Smoke Proposal');
  await pitch.getByLabel('Email', { exact: true }).fill('smoke-proposal@example.com');
  await pitch.getByLabel('The idea').fill('A test proposal from the smoke run, long enough to pass validation.');
  await pitch.getByLabel(/I agree to my details/).check();
  await pitch.getByRole('button', { name: 'Send proposal' }).click();
  await phone.getByText(/reads every proposal/).first().waitFor();
  ok('collaboration proposal sent');

  console.log('\nManagement');
  await admin.goto(`${base}/admin/inbox`);
  check((await admin.getByText('smoke-fan@example.com').count()) > 0, 'signup is in the inbox with its consent', 'signup missing from inbox');
  const proposal = admin.locator('li').filter({ hasText: 'Smoke Proposal' });
  await proposal.getByRole('button', { name: 'Mark reviewed' }).click();
  await admin.getByRole('link', { name: 'Reviewed (1)' }).waitFor();
  ok('proposal triaged to reviewed');

  await admin.goto(`${base}/admin/events`);
  const newShow = admin.locator('form').filter({ has: admin.getByRole('button', { name: 'Save show' }) });
  const showDate = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
  await newShow.getByLabel('Title').fill('Smoke Test Listing');
  await newShow.getByLabel('Date').fill(showDate);
  await newShow.getByLabel('Venue').fill('Smoke Hall');
  await newShow.getByLabel('City').fill('Durban');
  await newShow.getByLabel(/Published on/).check();
  await newShow.getByRole('button', { name: 'Save show' }).click();
  await admin.getByText('Saved and published on /live.').waitFor();
  await phone.goto(`${base}/live`);
  check((await phone.getByText('Smoke Test Listing').count()) > 0, 'a published listing appears on /live', 'published listing missing from /live');

  await admin.goto(`${base}/admin/content/assets`);
  await admin.setInputFiles('input[name=file]', path.join(FIXTURES, 'cover.png'));
  await admin.getByLabel('What is it?').fill('Smoke cover');
  await admin.getByRole('button', { name: 'Upload' }).click();
  await admin.getByText('Uploaded cover.png.').waitFor();
  const assetPath = (await admin.locator('code').first().innerText()).trim();
  const asset = await fetch(base + assetPath);
  const ranged = await fetch(base + assetPath, { headers: { range: 'bytes=0-7' } });
  check(
    asset.ok && asset.headers.get('content-type') === 'image/png' && ranged.status === 206 && (await ranged.arrayBuffer()).byteLength === 8,
    'uploaded asset is served, with byte ranges',
    `asset: ${asset.status} ${asset.headers.get('content-type')}, range ${ranged.status}`,
  );

  await admin.goto(`${base}/admin/content/albums/release-i`);
  await admin.getByLabel('Cover artwork').selectOption(assetPath);
  await admin.getByLabel('Cover description (alt text)').fill('Smoke cover artwork');
  await admin.getByRole('button', { name: 'Save changes' }).click();
  await admin.getByText(/^Saved\./).waitFor();
  await admin.goto(`${base}/admin/content/stories/what-an-archive-is-for`);
  await admin.getByLabel('Headline').fill('What an archive is for — smoke edit');
  await admin.getByRole('button', { name: 'Save changes' }).click();
  await admin.getByText(/^Saved\./).waitFor();
  await phone.goto(`${base}/journal/what-an-archive-is-for`);
  const headline = await phone.locator('h1').first().innerText();
  await phone.goto(`${base}/music/release-i`);
  const cover = await phone.locator('img[alt="Smoke cover artwork"]').count();
  check(/smoke edit/i.test(headline) && cover > 0, 'content edits and cover art publish to the site', `site after edit: h1 “${headline}”, cover ${cover}`);

  const csv = await admin.request.get(`${base}/admin/export/bookings`);
  const text = await csv.text();
  const anonCsv = await fetch(`${base}/admin/export/bookings`, { redirect: 'manual' });
  check(
    csv.ok() && /text\/csv/.test(csv.headers()['content-type'] ?? '') && text.startsWith('\uFEFF"Reference"') && text.includes(reference) && anonCsv.status >= 300 && anonCsv.status < 400,
    'bookings export downloads as CSV for management only',
    `export: ${csv.status()} ${csv.headers()['content-type']}, anonymous ${anonCsv.status}`,
  );

  await admin.goto(`${base}/admin/team`);
  const addForm = admin.locator('form').filter({ has: admin.getByRole('button', { name: 'Create account' }) });
  await addForm.getByLabel('Name').fill('Smoke Viewer');
  await addForm.getByLabel('Email').fill('smoke-viewer@example.com');
  await addForm.getByLabel('Role').selectOption('viewer');
  await addForm.getByRole('button', { name: 'Create account' }).click();
  const created = await admin.getByText(/Temporary password: /).innerText();
  const temp = /Temporary password: (\S+)/.exec(created)?.[1];
  const viewer = await (await browser.newContext()).newPage();
  await viewer.goto(`${base}/admin/login`);
  await viewer.getByLabel('Email').fill('smoke-viewer@example.com');
  await viewer.getByLabel('Password').fill(temp ?? '');
  await viewer.getByRole('button', { name: 'Sign in' }).click();
  await viewer.waitForURL(`${base}/admin`);
  const viewerCsv = await viewer.request.get(`${base}/admin/export/bookings`);
  check(viewerCsv.status() === 403, 'a new viewer signs in with the one-time password and cannot export', `viewer export answered ${viewerCsv.status()}`);
  await admin.screenshot({ path: path.join(OUT, 'admin-team.png'), fullPage: true });

  const headers = (await fetch(`${base}/`)).headers;
  const csp = headers.get('content-security-policy') ?? '';
  check(/frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp) && headers.get('x-content-type-options') === 'nosniff', 'security headers and CSP are sent', `headers: csp=${csp.slice(0, 60)}`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
if (!base) await startServer();
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
try {
  const { admin, reference } = await journey(browser);
  await everythingElse(browser, admin, reference);
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
