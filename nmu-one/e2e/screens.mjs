#!/usr/bin/env node
/**
 * Renders every route for every role at two phone widths and checks what
 * unit tests can't (brief §29, §30 "no dead buttons, broken links,
 * placeholder copy or obvious layout defects"):
 *
 *   - no page errors or console errors
 *   - no horizontal overflow at 390pt or 320pt
 *   - every button and link has an accessible name (brief §20)
 *   - no screen renders an error state it shouldn't, and every route a role
 *     may not use shows the permission-denied state rather than data
 *   - no placeholder copy ("lorem", "TODO", "undefined", "NaN")
 *
 * Each route is opened as a deep link. The web build restores a demo session
 * for the life of the tab, so this also proves deep links land on the right
 * screen for a signed-in person. Screenshots land in .e2e/screens/<width>/<role>/.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, root, serve, tap, visible } from './lib/web.mjs';

const ROUTES = {
  student: {
    ok: [
      '/home', '/services', '/campus', '/notifications', '/profile', '/search',
      '/academics/timetable', '/academics/exams', '/academics/results', '/academics/modules', '/academics/calendar',
      '/campus-map', '/campus-map?to=EB212', '/directory',
      '/money', '/money/funding', '/money/pay',
      '/library', '/library?tab=search', '/library?tab=bookings',
      '/transport', '/transport/route-a', '/transport/route-n',
      '/residence', '/residence/request',
      '/dining', '/dining/campus-kitchen', '/dining/green-corner', '/dining/cart',
      '/events', '/events/spring-sounds', '/events/alumni-careers', '/societies',
      '/safety', '/wellbeing', '/graduation',
      '/settings/privacy', '/settings/notifications', '/settings/home', '/settings/accessibility', '/settings/about',
    ],
    denied: ['/alumni', '/guardian', '/academics/teaching', '/settings/digital-id'],
  },
  staff: {
    ok: ['/home', '/services', '/campus', '/notifications', '/profile', '/academics/teaching', '/directory', '/library', '/transport', '/dining', '/events', '/safety'],
    denied: ['/money', '/academics/results', '/residence', '/guardian'],
  },
  parent: {
    ok: ['/home', '/services', '/campus', '/notifications', '/profile', '/guardian', '/guardian/fees', '/academics/calendar', '/safety', '/wellbeing', '/campus-map'],
    denied: ['/money', '/academics/timetable', '/library', '/residence', '/alumni'],
  },
  alumni: {
    ok: ['/home', '/services', '/notifications', '/profile', '/alumni', '/alumni/mentoring', '/alumni/jobs', '/alumni/giving', '/alumni/give/alumni-bursary', '/events', '/events/alumni-careers'],
    denied: ['/money', '/academics/timetable', '/residence', '/guardian'],
  },
};

const PLACEHOLDER = /\b(lorem|ipsum|TODO|FIXME|undefined|NaN|\[object Object\])\b/;

const server = await serve();
const failures = [];
let checked = 0;

async function go(page, base, path) {
  await page.goto(`${base}${path}`);
  // Fonts, session restore and the first adapter round-trips. The page is
  // blank while the session restores, so "no skeleton" alone proves nothing:
  // wait for rendered text with no skeleton, three polls in a row.
  let settled = 0;
  for (let i = 0; i < 40 && settled < 3; i++) {
    await page.waitForTimeout(250);
    const ready = await page.evaluate(
      () =>
        document.body.innerText.trim().length > 0 &&
        !document.querySelector('[data-testid="skeleton"], [aria-label="Loading"]'),
    );
    settled = ready ? settled + 1 : 0;
  }
}

async function audit(page, role, width, path, expectDenied, errors) {
  const where = `${role}@${width} ${path}`;
  const issues = [];
  const before = errors.length;

  // The route itself must be what's on screen — not sign-in, not a redirect.
  const pathname = new URL(page.url()).pathname;
  if (pathname !== path.split('?')[0]) issues.push(`landed on ${pathname}`);
  if (await visible(page, 'sso-sign-in').isVisible().catch(() => false)) issues.push('shows sign-in');

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  if (overflow > 1) issues.push(`horizontal overflow ${overflow}px`);

  const unnamed = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[role="button"],[role="link"],a,button,[role="switch"],[role="tab"],[role="radio"]')];
    return els
      .filter((el) => el.offsetParent !== null)
      .filter((el) => !(el.getAttribute('aria-label') || el.textContent || '').trim())
      .map((el) => el.outerHTML.slice(0, 80));
  });
  if (unnamed.length) issues.push(`unnamed controls: ${unnamed.slice(0, 3).join(' | ')}`);

  const denied = await visible(page, 'access-denied').isVisible().catch(() => false);
  const stateDenied = await visible(page, 'state-denied').isVisible().catch(() => false);
  const unavailable = await visible(page, 'state-unavailable').isVisible().catch(() => false);
  if (expectDenied && !(denied || stateDenied || unavailable)) issues.push('expected the permission-denied state');
  if (!expectDenied && (denied || stateDenied)) issues.push('unexpectedly denied');
  const errored = await visible(page, 'state-error').isVisible().catch(() => false);
  if (errored) issues.push('shows an error state');

  const text = await page.evaluate(() => document.body.innerText);
  const placeholder = text.match(PLACEHOLDER);
  if (placeholder) issues.push(`placeholder text "${placeholder[0]}"`);

  if (errors.length > before) issues.push(...errors.slice(before));
  checked += 1;
  if (issues.length) failures.push(`${where}: ${issues.join('; ')}`);
}

for (const width of [390, 320]) {
  for (const [role, routes] of Object.entries(ROUTES)) {
    const out = join(root, '.e2e', 'screens', String(width), role);
    mkdirSync(out, { recursive: true });
    const { browser, page, errors } = await launch({ width, height: 844 });
    try {
      await page.goto(`${server.url}/`);
      await tap(page, `persona-${role}`);
      await tap(page, 'sso-sign-in');
      await visible(page, 'home').waitFor();
      for (const [path, expectDenied] of [...routes.ok.map((p) => [p, false]), ...routes.denied.map((p) => [p, true])]) {
        await go(page, server.url, path);
        await audit(page, role, width, path, expectDenied, errors);
        await page.screenshot({ path: join(out, `${path.replace(/[/?=]+/g, '_').replace(/^_/, '') || 'root'}.png`) });
      }
    } catch (e) {
      failures.push(`${role}@${width}: ${e.message.split('\n')[0]}`);
    } finally {
      await browser.close();
    }
  }
}

await server.close();
if (failures.length) {
  console.error(`✗ ${failures.length} problem(s) across ${checked} screens:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`✓ ${checked} screens at 390pt and 320pt: no errors, overflow, unnamed controls or wrong access.`);
}
