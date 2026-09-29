/**
 * Accessibility check of the web export with axe-core, in a real browser.
 *
 *   npm run export:web && npm run a11y
 *   npm run a11y -- --only=/home,/book
 *
 * Only serious and critical findings fail: those are the ones that stop
 * somebody using the app — unreadable contrast, a control with no name, a
 * field with no label, a page with no language. Minor and moderate findings
 * are printed so they can be weighed, not enforced.
 *
 * Signed-in and staff routes are visited after signing in, as in the sweep.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { signIn as signInAs, startWeb } from './lib/web.mjs';

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');

/** A route from each kind of screen: lists, a form, a picker, a document, the staff tools. */
const ROUTES = [
  ['public', null, ['/home', '/menu', '/book', '/events', '/discover']],
  ['public', null, ['/dish/sig-fillet', '/wine/wine-rubicon', '/collection/col-fire']],
  ['public', null, ['/visit', '/support', '/private-functions', '/gallery']],
  ['public', null, ['/sign-in', '/vouchers/new', '/legal/privacy']],
  [
    'guest',
    'demo@mabu.app',
    [
      '/profile',
      '/profile/bookings',
      '/profile/details',
      '/profile/data',
      '/profile/security',
      '/rewards',
      '/notifications/preferences',
    ],
  ],
  ['admin', 'admin@mabu.demo', ['/admin', '/admin/reservations', '/admin/policy', '/admin/menu']],
];

const { base, browser, stop } = await startWeb();
const failures = [];
const moderate = new Map();

for (const [label, email, routes] of ROUTES) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  if (email) await signInAs(page, base, email);
  for (const route of routes) {
    if (only && !only.includes(route)) continue;
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () => {
      const run = await window.axe.run(document, {
        resultTypes: ['violations'],
        // Colour contrast needs the real paint, which is what a browser gives
        // us here; everything else is structure.
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
        },
      });
      return run.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        example: v.nodes[0]?.html?.slice(0, 120) ?? '',
      }));
    });
    const serious = result.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    for (const v of result.filter((x) => !serious.includes(x))) {
      moderate.set(v.id, { ...v, help: v.help });
    }
    console.log(
      `${serious.length ? '✗' : '✓'} ${label} ${route}${
        serious.length
          ? ` — ${serious.map((v) => `${v.id} (${v.nodes}): ${v.example}`).join(' | ')}`
          : ''
      }`,
    );
    if (serious.length) failures.push({ route, label, violations: serious });
  }
  await context.close();
}

await stop();

if (moderate.size) {
  console.log('\nWorth weighing (not failed):');
  for (const v of moderate.values()) console.log(`  · ${v.id} — ${v.help}`);
}

console.log(
  `\n${failures.length ? `${failures.length} screen(s) with a serious accessibility problem` : 'No serious or critical accessibility problems.'}`,
);
process.exit(failures.length ? 1 : 0);
