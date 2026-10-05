/**
 * Console end-to-end check, run against the static export (`npm run build`):
 *
 *   1. every page passes axe-core (WCAG 2.0/2.1/2.2 A and AA rules), at
 *      desktop width and at 390px with no sideways scrolling;
 *   2. the brief §11 workflow works: create → approve (by someone else) →
 *      deliver → measure, with separation of duties and an audit trail;
 *   3. emergency notices, commerce, help content and keyboard access work.
 *
 *   node e2e/console.mjs            # CHROMIUM_PATH overrides the browser
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = resolve(fileURLToPath(import.meta.url), '..');
const outDir = join(here, '..', 'out');
const shots = join(here, '..', '.e2e');
mkdirSync(shots, { recursive: true });
const axeSource = readFileSync(join(here, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serve() {
  if (!existsSync(join(outDir, 'index.html')))
    throw new Error('No export in out/. Run `npm run build` first.');
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = join(outDir, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!file.startsWith(outDir) || !existsSync(file)) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      createReadStream(join(outDir, '404.html')).pipe(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) =>
    server.listen(0, '127.0.0.1', () =>
      ok({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }),
    ),
  );
}

const ROUTES = [
  '/',
  '/notifications/',
  '/notifications/new/',
  '/notifications/view/?id=cmp-venue-change',
  '/notifications/emergency/',
  '/approvals/',
  '/audience/',
  '/events/',
  '/commerce/',
  '/services/',
  '/content/',
  '/moderation/',
  '/roles/',
  '/audit/',
  '/analytics/',
];

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

async function ready(page) {
  await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 15_000 });
}

async function operator(page, name) {
  const select = page.getByLabel('Working as');
  const value = await select.locator('option', { hasText: name }).getAttribute('value');
  await select.selectOption(value);
}

const executablePath =
  process.env.CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const server = await serve();
const browser = await chromium.launch(executablePath ? { executablePath } : {});

try {
  // ── 1. Accessibility and reflow, every page ────────────────────────────────
  for (const [width, height] of [
    [1366, 900],
    [390, 844],
  ]) {
    console.log(`\nPages at ${width}px`);
    const context = await browser.newContext({
      viewport: { width, height },
      locale: 'en-ZA',
      timezoneId: 'Africa/Johannesburg',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    for (const route of ROUTES) {
      await page.goto(server.url + route);
      await ready(page);
      const title = await page.title();
      check(
        /· NMU ONE Console$|^NMU ONE Console$/.test(title) && title.length > 16,
        `${route} has a page title (“${title}”)`,
      );
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => ({
        by: document.documentElement.scrollWidth - window.innerWidth,
        culprits: [...document.querySelectorAll('main *')]
          .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
          .slice(0, 3)
          .map((e) => `${e.tagName.toLowerCase()}.${e.className}`),
      }));
      check(
        overflow.by <= 1,
        `${route} fits ${width}px without sideways scrolling${overflow.by > 1 ? ` (${overflow.culprits.join(', ')})` : ''}`,
      );
      await axe(page, `${route} @${width}`);
      const name = route.replace(/[/?=]+/g, '_').replace(/^_|_$/g, '') || 'dashboard';
      if (width === 1366 || ['dashboard', 'notifications_new'].includes(name))
        await page.screenshot({
          path: join(shots, `${name}${width === 1366 ? '' : `-${width}`}.png`),
          fullPage: true,
        });
    }
    check(
      errors.length === 0,
      `no console errors at ${width}px${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`,
    );
    await context.close();
  }

  // ── 2. Create → approve → deliver → measure ────────────────────────────────
  console.log('\nNotification workflow');
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: 'en-ZA',
    timezoneId: 'Africa/Johannesburg',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(server.url + '/');
  await ready(page);

  // Keyboard: the first Tab reaches the skip link, which moves focus to main.
  await page.keyboard.press('Tab');
  check(
    (await page.evaluate(() => document.activeElement?.textContent)) === 'Skip to content',
    'first Tab focuses “Skip to content”',
  );
  await page.keyboard.press('Enter');
  check(
    (await page.evaluate(() => document.activeElement?.id)) === 'main',
    'skip link moves focus to the main content',
  );

  await operator(page, 'Ayanda Khumalo');
  await page.getByRole('link', { name: 'New notification' }).first().click();
  await ready(page);

  // Submitting an empty form shows an error summary and focuses it.
  await page.getByRole('button', { name: 'Submit for approval' }).click();
  const summary = page.getByRole('alert').filter({ hasText: 'before submitting' });
  await summary.waitFor();
  check(
    await summary.evaluate((el) => el === document.activeElement),
    'validation errors are summarised and focused',
  );
  check(
    (await page.getByLabel('Title').getAttribute('aria-invalid')) === 'true',
    'the invalid title is marked aria-invalid',
  );

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
    'submitted notice is awaiting approval',
  );
  check(
    (await page.getByRole('button', { name: 'Approve' }).count()) === 0,
    'the author gets no Approve button',
  );
  check(
    (await page
      .getByText('someone else must approve it')
      .isVisible()
      .catch(() => false)) || (await page.getByText('Your role can’t approve').count()) > 0,
    'the page explains why the author can’t approve',
  );
  const detailUrl = page.url();

  // A different operator approves.
  await operator(page, 'Lindiwe Mthembu');
  await page.getByRole('button', { name: 'Approve' }).waitFor();
  await page.getByRole('button', { name: 'Approve' }).click();
  const dialog = page.getByRole('dialog', { name: 'Approve this notification?' });
  await dialog.waitFor();
  await axe(page, 'approve dialog');
  await dialog.getByLabel('Note (optional)').fill('Clear and useful — approved.');
  await dialog.getByRole('button', { name: 'Approve and send' }).click();
  await page.getByRole('heading', { name: 'Measure' }).waitFor();
  check(
    await page.getByText('Sent', { exact: true }).first().isVisible(),
    'approved notice is sent',
  );
  check(
    (await page.locator('.stepper li[data-state="done"]').count()) === 5,
    'workflow shows all five stages done',
  );
  check(
    await page.getByRole('list', { name: /Delivery funnel/ }).isVisible(),
    'delivery funnel is shown',
  );
  await page.screenshot({ path: join(shots, 'workflow-sent.png'), fullPage: true });

  // The toast/live region announced it.
  check(
    (await page.getByRole('status').textContent())?.includes('Approved and sent'),
    'approval is announced to screen readers',
  );

  // Scheduled notice can be sent early.
  await page.goto(server.url + '/notifications/view/?id=cmp-res-water');
  await ready(page);
  await page.getByRole('button', { name: 'Send now' }).click();
  await page.getByRole('heading', { name: 'Measure' }).waitFor();
  ok('a scheduled notice can be delivered early by an approver');

  // Requesting changes sends it back with the note.
  await page.goto(server.url + '/notifications/view/?id=cmp-library-hours');
  await ready(page);
  await page.getByRole('button', { name: 'Request changes' }).click();
  const changes = page.getByRole('dialog', { name: 'Ask for changes' });
  await changes.getByLabel('What should change?').fill('Please confirm the exam-period dates.');
  await changes.getByRole('button', { name: 'Send back to author' }).click();
  await page.getByText('Changes requested').first().waitFor();
  ok('an approver can send a notice back with a note');

  // ── 3. Emergency, audit, commerce, content ─────────────────────────────────
  console.log('\nEmergency, audit, commerce and content');
  await page.goto(server.url + '/notifications/emergency/');
  await ready(page);
  await page.getByLabel('Title').fill('Evacuate the Library now');
  await page
    .getByLabel('What people should do')
    .fill('Leave by the nearest exit and gather on the Main Lawn. Follow staff instructions.');
  await page
    .getByLabel(/Why is this an emergency/)
    .fill('Fire alarm confirmed by Protection Services');
  await page.getByRole('button', { name: 'Review and send' }).click();
  const confirm = page.getByRole('dialog', { name: 'Send this emergency notice now?' });
  await confirm.getByRole('button', { name: /^Send to/ }).click();
  await page.getByRole('heading', { name: 'Notifications', level: 1 }).waitFor();
  check(
    await page.getByRole('link', { name: 'Evacuate the Library now' }).isVisible(),
    'emergency notice is sent immediately',
  );

  await page.goto(server.url + '/audit/');
  await ready(page);
  const audit = await page.locator('main table').textContent();
  check(audit.includes('EMERGENCY notice sent'), 'the emergency send is flagged in the audit log');
  check(
    audit.includes('Approved and sent notification') &&
      audit.includes('Graduation photos are ready'),
    'the approval is in the audit log',
  );
  check(audit.includes('Submitted for approval'), 'the submission is in the audit log');

  // Commerce: read-only for an approver, editable for the commerce manager.
  await page.goto(server.url + '/commerce/');
  await ready(page);
  check(
    await page.getByRole('switch', { name: 'Open — Campus Kitchen' }).isDisabled(),
    'commerce controls are disabled for roles without access',
  );
  await operator(page, 'Farah Abrahams');
  await page
    .getByText(/^Menu ·/)
    .first()
    .click();
  const item = page.getByRole('switch', { name: /^Available — / }).first();
  await item.click();
  check(!(await item.isChecked()), 'the commerce manager can mark an item sold out');
  await page.getByRole('switch', { name: 'Taking order-ahead — Campus Kitchen' }).click();
  check(
    await page.getByText('Orders paused').first().isVisible(),
    'pausing order-ahead updates the vendor status',
  );

  // Content: an unapproved article doesn't answer; once approved, it does.
  await operator(page, 'Ayanda Khumalo');
  await page.goto(server.url + '/content/');
  await ready(page);
  await page.getByRole('button', { name: 'Ask' }).click();
  await page.getByText('No approved answer').waitFor();
  check(
    await page.getByText('would answer this once its owner approves it').isVisible(),
    'the assistant won’t use an unapproved article, and says which would help',
  );
  await operator(page, 'Lindiwe Mthembu');
  await page.getByRole('button', { name: 'Approve “Residence requests”' }).click();
  await page.getByRole('button', { name: 'Ask' }).click();
  await page.getByText('Answered · Help article').waitFor();
  ok('after approval the assistant answers from the article');

  // Roles: the matrix comes from the app's own policy.
  await page.goto(server.url + '/roles/');
  await ready(page);
  const matrix = await page.getByRole('table', { name: 'App permissions by role' }).textContent();
  check(
    matrix.includes('Shared fees') && matrix.includes('Consent'),
    'the app permission matrix shows consent-scoped parent access',
  );
  check(
    matrix.includes('Digital ID') && matrix.includes('Pending'),
    'digital ID shows as pending NMU approval',
  );

  // Faculty publisher only sees their faculty's audiences.
  await operator(page, 'Pieter van Wyk');
  await page.goto(server.url + '/notifications/new/');
  await ready(page);
  const audiences = await page.getByLabel('Who receives it').locator('option').allTextContents();
  check(
    audiences.length === 1 && audiences[0].includes('Business & Economic Sciences'),
    'a faculty publisher can only reach their faculty',
  );

  // An analyst can't compose.
  await operator(page, 'Kagiso Molefe');
  await page.goto(server.url + '/notifications/');
  await ready(page);
  check(
    (await page.getByRole('link', { name: 'New notification' }).count()) === 0,
    'an analyst has no compose button',
  );

  await page.goto(server.url + '/analytics/');
  await ready(page);
  await page.getByRole('list', { name: 'Open rate by notification' }).locator('li').first().focus();
  check(
    await page
      .getByRole('list', { name: 'Open rate by notification' })
      .getByRole('tooltip')
      .isVisible(),
    'chart values show on keyboard focus',
  );
  await page.screenshot({ path: join(shots, 'analytics-focus.png'), fullPage: true });

  await page.goto(server.url + detailUrl.replace(server.url, ''));
  await ready(page);
  check(
    errors.length === 0,
    `no page errors during the workflow${errors.length ? `: ${errors.join(' | ')}` : ''}`,
  );
  await context.close();
} finally {
  await browser.close();
  server.close();
}

console.log(
  failures.length ? `\n${failures.length} check(s) failed.` : '\nAll console checks passed.',
);
process.exit(failures.length ? 1 : 0);
