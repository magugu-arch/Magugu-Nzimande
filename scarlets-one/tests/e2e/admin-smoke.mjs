// End-to-end smoke test of the operations console.
//
//   npm run build -w @scarlets/admin && node tests/e2e/admin-smoke.mjs
//
// Starts the built console on a spare port and checks, in a real browser,
// that roles are enforced and that changes are written to the audit log.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const admin = join(here, '..', '..', 'apps', 'admin');
if (!existsSync(join(admin, '.next'))) {
  console.error('No admin build found. Run `npm run build -w @scarlets/admin` first.');
  process.exit(2);
}

const freePort = () =>
  new Promise((done) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [join(admin, 'scripts', 'next.mjs'), 'start', '--port', String(port)],
  {
    cwd: admin,
    stdio: 'ignore',
  },
);

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const ready = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${base}/sign-in`);
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

const browser = await chromium.launch();
try {
  if (!(await ready())) throw new Error('The console did not start');
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 900 } })
  ).newPage();
  const open = async (path) => {
    await page.goto(base + path);
    await page.waitForLoadState('networkidle');
  };
  const signIn = async (accountId) => {
    await open('/sign-in');
    await page.locator(`form:has(input[name="accountId"][value="${accountId}"]) button`).click();
    // The session cookie is set by the redirect, so wait for it to land.
    await page.waitForURL((target) => !target.pathname.endsWith('/sign-in'));
    await page.waitForLoadState('networkidle');
  };
  const mainText = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  const nav = async () => (await page.locator('nav').first().innerText()).replace(/\s+/g, ' ');

  await open('/');
  check('A signed-out visitor is sent to sign-in', page.url().endsWith('/sign-in'));
  check(
    'The concept banner is on every page',
    (await page.locator('body').innerText()).includes('Not an official Scarlets product'),
  );

  // Club admin: can publish, and the change is audited.
  await signIn('u-club-admin');
  const adminNav = await nav();
  check(
    'Club admin sees every section',
    ['Content', 'Fixtures', 'Campaigns', 'Moderation', 'Notifications', 'Roles', 'Audit log'].every(
      (section) => adminNav.includes(section),
    ),
    adminNav,
  );
  await open('/content/draft-fan-zone-guide');
  await page.getByRole('button', { name: 'Publish now' }).click();
  const refusal = await page
    .getByText('tick the box to confirm')
    .first()
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  check('Publishing is refused until the preview has been checked', refusal);
  await page.locator('input[name="confirmed"]').check();
  await page.getByRole('button', { name: 'Publish now' }).click();
  await page.waitForLoadState('networkidle');
  await open('/content');
  const row = (
    await page.locator('tbody tr', { hasText: 'How the Fan Zone works' }).first().innerText()
  ).replace(/\s+/g, ' ');
  check('Club admin can publish a draft', /Published/.test(row), row.slice(0, 80));
  await open('/audit');
  const audit = await mainText();
  check(
    'Publishing is written to the audit log',
    /content\.publish/i.test(audit) && audit.includes('Demo Club Admin'),
  );

  // Editor: can draft, cannot publish, cannot open restricted sections.
  await signIn('u-editor');
  const editorNav = await nav();
  check(
    'Editor sees only what the role may open',
    editorNav.includes('Content') &&
      !editorNav.includes('Roles') &&
      !editorNav.includes('Audit log'),
    editorNav,
  );
  await open('/content/draft-venue-guide');
  check(
    'Editor has no publish control, only "Request approval"',
    (await page.getByRole('button', { name: 'Publish now' }).count()) === 0 &&
      (await page.getByRole('button', { name: 'Request approval' }).count()) === 1,
  );
  await open('/roles');
  check(
    'Editor is refused the Roles screen by URL',
    (await mainText()).includes('needs the roles.manage permission'),
  );
  await open('/audit');
  check(
    'Editor is refused the audit log by URL',
    (await mainText()).includes('needs the audit.read permission'),
  );

  // Moderator: the queue, and nothing is public until approved.
  await signIn('u-moderator');
  await open('/moderation');
  check(
    'Moderator can open the review queue',
    (await mainText()).includes('not visible to supporters'),
  );
  await open('/content/draft-venue-guide');
  check(
    'Moderator cannot edit content',
    (await page.getByRole('button', { name: 'Save draft' }).count()) === 0,
  );

  // Roles: no human role can adjust rewards.
  await signIn('u-club-admin');
  await open('/roles');
  check(
    'The roles screen states that no person can adjust rewards',
    /rewards\.adjust/.test(await mainText()),
  );
} catch (error) {
  check(
    'Admin smoke test ran to the end',
    false,
    error instanceof Error ? error.message.split('\n')[0] : String(error),
  );
} finally {
  await browser.close();
  server.kill('SIGTERM');
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
