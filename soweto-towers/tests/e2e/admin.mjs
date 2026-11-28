#!/usr/bin/env node
/**
 * End-to-end: the staff console's sign-in and gate check-in.
 *  1. /admin sends you to sign in; a wrong password is refused.
 *  2. Signed in, Scan refuses an unknown reference and checks a real one in.
 *  3. A password change signs every other device out, but not this one.
 *  4. Two-step sign-in: turn it on, sign in with a code, and the same code
 *     can't be used twice. Then everything is put back as it was.
 *
 * Uses the demo account, so it runs against the built-in demo database only.
 * Usage: node tests/e2e/admin.mjs <baseUrl> [shotsDir]. Exits non-zero on failure.
 */
import { createHmac } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { siteOnly } from './site-only.mjs';

const base = process.argv[2] ?? 'http://localhost:3000';
const shots = process.argv[3] ?? path.resolve(import.meta.dirname, 'shots');
await mkdir(shots, { recursive: true });

const EMAIL = 'crew@sowetotowers.co.za';
const PASSWORD = 'jumpmaster';
const TEMP_PASSWORD = 'jumpmaster-temporary-1';

// RFC 6238 code for a base32 secret, the same way an authenticator app makes it.
function totp(secret, at = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/=+$/, '')) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac('sha1', key).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

const browser = await chromium.launch();
const octet = () => Math.floor(Math.random() * 250) + 2;
const device = async () =>
  siteOnly(
    await browser.newContext({ viewport: { width: 1360, height: 900 }, extraHTTPHeaders: { 'x-real-ip': `10.${octet()}.${octet()}.${octet()}` } }),
    base,
  );
const errors = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`console: ${m.text()}`));
  return page;
};
let n = 0;
let page;
const shot = async (name) => page.screenshot({ path: path.join(shots, `admin-${String(++n).padStart(2, '0')}-${name}.png`), caret: 'initial' });
const step = async (label, fn) => {
  process.stdout.write(`• ${label} … `);
  await fn();
  console.log('ok');
};

async function signIn(p, password, code) {
  await p.goto(`${base}/admin/login`, { waitUntil: 'load' });
  await p.getByLabel('Email').fill(EMAIL);
  await p.getByLabel('Password').fill(password);
  if (code) {
    await p.getByRole('button', { name: 'Sign in' }).click();
    await p.locator('#code').waitFor();
    await p.locator('#code').fill(code);
  }
  await p.getByRole('button', { name: 'Sign in' }).click();
}

let totpOn = false;
let passwordChanged = false;
const deviceA = await device();
page = watch(await deviceA.newPage());

try {
  await step('/admin asks you to sign in', async () => {
    await page.goto(`${base}/admin`, { waitUntil: 'load' });
    await page.waitForURL(/\/admin\/login/);
    await signIn(page, 'not-the-password');
    await page.getByText('That email and password don’t match.').waitFor();
  });

  await step('sign in to Today', async () => {
    await signIn(page, PASSWORD);
    await page.waitForURL(`${base}/admin`);
    await page.getByText('Today', { exact: true }).first().waitFor();
    await shot('today');
  });

  await step('scan: an unknown reference is not valid', async () => {
    await page.goto(`${base}/admin/scan`, { waitUntil: 'load' });
    await page.getByLabel('Or type the booking reference').fill('ST-ZZZZZZ');
    await page.getByRole('button', { name: 'Check in' }).click();
    await page.getByText('Not valid', { exact: true }).waitFor();
  });

  let ref = '';
  await step('scan: a paid booking checks in', async () => {
    await page.goto(`${base}/admin/bookings`, { waitUntil: 'load' });
    // The list streams in after the page shell; wait for the first booking link.
    const link = page.locator('a[href^="/admin/bookings/ST-"]').first();
    await link.waitFor({ timeout: 30000 });
    ref = (await link.getAttribute('href')).match(/ST-[A-Z0-9]{6}/)?.[0] ?? '';
    if (!ref) throw new Error('no booking reference on the Bookings page');
    await page.goto(`${base}/admin/scan`, { waitUntil: 'load' });
    await page.getByLabel('Or type the booking reference').fill(ref);
    await page.getByRole('button', { name: 'Check in' }).click();
    const first = page.getByText(/^(Checked in|Different day|Already in|Not paid|Cancelled)$/);
    await first.waitFor();
    const title = (await first.textContent()).trim();
    if (!['Checked in', 'Different day', 'Already in'].includes(title)) throw new Error(`${ref}: ${title}`);
    await shot('scan');
  });

  const deviceB = await device();
  const other = watch(await deviceB.newPage());
  await step('a second device signs in too', async () => {
    await signIn(other, PASSWORD);
    await other.waitForURL(`${base}/admin`);
  });

  await step('changing the password signs the other device out', async () => {
    await page.goto(`${base}/admin/team`, { waitUntil: 'load' });
    await page.getByLabel('Current password').fill(PASSWORD);
    await page.getByLabel('New password', { exact: true }).fill(TEMP_PASSWORD);
    await page.getByLabel('New password again').fill(TEMP_PASSWORD);
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByText('Any other devices have been signed out.').waitFor();
    passwordChanged = true;
    await other.goto(`${base}/admin`, { waitUntil: 'load' });
    await other.waitForURL(/\/admin\/login/);
    await page.goto(`${base}/admin`, { waitUntil: 'load' });
    if (/\/admin\/login/.test(page.url())) throw new Error('this device was signed out too');
  });
  await deviceB.close();

  await step('the password goes back to the demo one', async () => {
    await page.goto(`${base}/admin/team`, { waitUntil: 'load' });
    await page.getByLabel('Current password').fill(TEMP_PASSWORD);
    await page.getByLabel('New password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('New password again').fill(PASSWORD);
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByText('Any other devices have been signed out.').waitFor();
    passwordChanged = false;
  });

  let secret = '';
  await step('two-step sign-in turns on with a code', async () => {
    await page.goto(`${base}/admin/team`, { waitUntil: 'load' });
    secret = await page.locator('input[name="secret"]').inputValue();
    await page.getByLabel('6-digit code from the app').fill(totp(secret));
    totpOn = true; // from here on, a failure reports the secret so the account can be put back
    await page.getByRole('button', { name: 'Turn on two-step sign-in' }).click();
    // The page refreshes into its "on" state, which replaces the set-up form.
    await page.getByText('You enter a code from your authenticator app each time you sign in.').waitFor();
  });

  let code = '';
  await step('sign in with password and code', async () => {
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL(/\/admin\/login/);
    // Stay clear of the end of a 30-second window, so both attempts use the same code.
    if (Date.now() % 30_000 > 20_000) await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 500);
    code = totp(secret);
    await signIn(page, PASSWORD, code);
    await page.waitForURL(`${base}/admin`);
  });

  await step('the same code is refused a second time', async () => {
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL(/\/admin\/login/);
    await signIn(page, PASSWORD, code);
    await page.getByText('That code has already been used. Wait for the next one.').waitFor();
    await shot('code-reused');
  });

  await step('a fresh code works, and two-step sign-in is turned off again', async () => {
    await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 500);
    await page.locator('#code').fill(totp(secret));
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(`${base}/admin`);
    await page.goto(`${base}/admin/team`, { waitUntil: 'load' });
    await page.getByLabel('Current code').fill(totp(secret));
    await page.getByRole('button', { name: 'Turn off' }).click();
    // Back to the set-up form.
    await page.getByLabel('6-digit code from the app').waitFor();
    totpOn = false;
  });

  if (errors.length) throw new Error(`browser errors:\n${errors.join('\n')}`);
  console.log(`\nPASS · screenshots in ${shots}`);
} catch (err) {
  console.log('FAIL');
  await shot('failure').catch(() => {});
  console.error(err.message);
  if (errors.length) console.error(errors.join('\n'));
  if (passwordChanged || totpOn)
    console.error(`Left changed: ${passwordChanged ? `password is now ${TEMP_PASSWORD}` : ''} ${totpOn ? `two-step sign-in is on (secret ${secret})` : ''}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
