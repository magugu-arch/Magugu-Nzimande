/**
 * The console in live mode, end to end: starts the reference BFF and drives
 * the console built with NEXT_PUBLIC_CONSOLE_MODE=live (`npm run build:live`).
 *
 *   1. staff sign in with NMU SSO (authorization code + PKCE, through the
 *      BFF's development sign-in page) and the sign-in page passes axe-core;
 *   2. the brief §11 workflow runs on the server: Ayanda writes and submits
 *      a notice and can't approve it; Lindiwe signs in and approves it;
 *   3. the audit trail records each step against the operator the server
 *      signed in.
 *
 *   npm run build:live && npm run e2e:live    # needs `npm run bff:build` in ../
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const here = resolve(fileURLToPath(import.meta.url), '..');
const outDir = join(here, '..', 'out-live');
const shots = join(here, '..', '.e2e', 'live');
mkdirSync(shots, { recursive: true });
const axeSource = readFileSync(join(here, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const bffEntry = join(here, '..', '..', 'bff', 'dist', 'bff', 'src', 'server.js');
if (!existsSync(bffEntry)) throw new Error('Build the BFF first: `npm run bff:build` in nmu-one/.');

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

async function axe(page, label) {
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    }),
  );
  if (result.violations.length === 0) return ok(`${label}: no WCAG violations`);
  for (const v of result.violations) {
    fail(`${label}: ${v.id} (${v.impact}) — ${v.help} — e.g. ${v.nodes[0]?.target.join(' ')}`);
  }
}

const ready = (page) =>
  page.locator('main h1').first().waitFor({ state: 'visible', timeout: 15_000 });

/** Signs in through the development NMU SSO page as one operator. */
async function signInAs(page, operatorId, name) {
  await page.getByTestId('console-sign-in').waitFor();
  await page.getByTestId('console-sso').click();
  const who = page.locator(`a[data-persona="${operatorId}"]`);
  await who.waitFor();
  await who.click();
  await page.getByTestId('signed-in-as').waitFor({ timeout: 15_000 });
  check(
    (await page.getByTestId('signed-in-as').textContent())?.includes(name),
    `${name} is signed in by NMU SSO`,
  );
}

// ── The BFF ──────────────────────────────────────────────────────────────────
const bff = spawn(process.execPath, [bffEntry], {
  env: { ...process.env, PORT: '8787', BFF_LOG: '1' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const log = [];
bff.stdout.on('data', (d) => log.push(...String(d).trim().split('\n')));
for (let i = 0; ; i++) {
  try {
    if ((await fetch('http://127.0.0.1:8787/healthz')).ok) break;
  } catch {
    if (i > 50) throw new Error('The BFF did not start');
  }
  await new Promise((r) => setTimeout(r, 200));
}

const executablePath =
  process.env.CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const server = await serve(outDir);
const browser = await chromium.launch(executablePath ? { executablePath } : {});

try {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: 'en-ZA',
    timezoneId: 'Africa/Johannesburg',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${m.text()} (${m.location()?.url ?? ''})`);
  });

  console.log('\nSigning in');
  await page.goto(server.url + '/');
  await page.getByTestId('console-sign-in').waitFor();
  check(
    (await page.getByRole('navigation', { name: 'Console' }).locator('a').count()) === 0,
    'nothing in the console shows before sign-in',
  );
  await axe(page, 'sign-in page');
  await page.screenshot({ path: join(shots, 'sign-in.png'), fullPage: true });
  await signInAs(page, 'op-ayanda', 'Ayanda Khumalo');
  await ready(page);
  check(await page.getByText('Live', { exact: true }).isVisible(), 'the console says it is live');
  check((await page.getByLabel('Working as').count()) === 0, 'there is no operator picker');

  console.log('\nWorkflow on the server');
  await page.getByRole('link', { name: 'New notification' }).first().click();
  await ready(page);
  await page.getByLabel('Title').fill('Graduation photos are ready');
  await page
    .getByRole('textbox', { name: 'Message' })
    .fill('Your official graduation photos can be viewed and ordered from today.');
  await page.getByLabel('Category').selectOption('community');
  await page.getByLabel('Who receives it').selectOption({ label: 'All students' });
  await page.getByLabel('Opens').selectOption('/events');
  await page.getByLabel('Button text').fill('See events');
  await page.getByRole('button', { name: 'Submit for approval' }).click();
  await page.getByRole('heading', { name: 'Graduation photos are ready' }).waitFor();
  check(
    await page.getByText('Awaiting approval').first().isVisible(),
    'the server holds the notice, awaiting approval',
  );
  check(
    (await page.getByRole('button', { name: 'Approve' }).count()) === 0,
    'its author gets no Approve button',
  );
  const detailPath = page.url().replace(server.url, '');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByTestId('console-sign-in').waitFor();
  ok('signing out returns to the sign-in page');

  await signInAs(page, 'op-lindiwe', 'Lindiwe Mthembu');
  await page.goto(server.url + detailPath);
  await page.getByRole('button', { name: 'Approve' }).waitFor();
  await page.getByRole('button', { name: 'Approve' }).click();
  const dialog = page.getByRole('dialog', { name: 'Approve this notification?' });
  await dialog.waitFor();
  await dialog.getByLabel('Note (optional)').fill('Clear and useful — approved.');
  await dialog.getByRole('button', { name: 'Approve and send' }).click();
  await page.getByRole('heading', { name: 'Measure' }).waitFor();
  check(
    await page.getByText('Sent', { exact: true }).first().isVisible(),
    'a different operator approved it, and it was sent',
  );
  await page.screenshot({ path: join(shots, 'workflow-sent.png'), fullPage: true });

  await page.goto(server.url + '/audit/');
  await ready(page);
  const rows = page.locator('main table tbody tr');
  const text = (await rows.allTextContents()).slice(0, 4).join(' | ');
  check(
    /Lindiwe Mthembu.*Approved and sent notification/.test(text),
    'the audit log credits the approval to Lindiwe',
  );
  check(
    /Ayanda Khumalo.*Submitted for approval/.test(text),
    'the audit log credits the submission to Ayanda',
  );
  await page.screenshot({ path: join(shots, 'audit.png'), fullPage: true });

  check(
    errors.length === 0,
    `no page or console errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`,
  );
  await context.close();
} catch (e) {
  fail(e.message.split('\n')[0]);
} finally {
  await browser.close();
  server.close();
  bff.kill();
}

const audited = log.filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
console.log(
  `\nBFF audit log: ${audited.length} entries (${[...new Set(audited.map((a) => a.action))].join(' · ')})`,
);
console.log(
  failures.length ? `\n${failures.length} check(s) failed.` : '\nAll live console checks passed.',
);
process.exit(failures.length ? 1 : 0);
