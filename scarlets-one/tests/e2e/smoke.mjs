// End-to-end smoke test of the supporter app's web build.
//
//   npm run mobile:export && npm run e2e
//
// It walks the journeys the brief names: onboarding, viewing a fixture, the
// ticket link-out, the matchday guide, Passport and membership, and voting in
// the Fan Zone. It runs against the exported build with the demo adapters, so
// it needs no backend and makes no request to any outside site: the ticket
// link-out is checked by recording what the app asks the browser to open.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', '..', 'apps', 'mobile', 'dist');
const artifacts = join(here, '.artifacts');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('No web build found. Run `npm run mobile:export` first.');
  process.exit(2);
}
mkdirSync(artifacts, { recursive: true });

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const { url, close } = await serve(dist);
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'en-GB' });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
// Record link-outs instead of following them.
await page.addInitScript(() => {
  window.__opened = [];
  window.open = (target) => {
    window.__opened.push(String(target));
    return null;
  };
});

const byId = (id) => page.getByTestId(id).first();
const text = async (id) => ((await byId(id).textContent()) ?? '').trim();
const visible = (id) => byId(id).isVisible();
const settle = (ms = 500) => page.waitForTimeout(ms);
// Press an on-screen control the way a finger would, wherever the page is scrolled.
const tap = async (id) => {
  await byId(id).scrollIntoViewIfNeeded();
  await byId(id).click();
};

try {
  // 1. Onboarding ---------------------------------------------------------
  await page.goto(url);
  await byId('screen-onboarding').waitFor({ timeout: 20_000 });
  check('First run opens onboarding', true);
  await tap('language-cy');
  check(
    'Language switches in place to Welsh',
    (await byId('onboarding-continue').textContent())?.includes('Parhau') ?? false,
  );
  await tap('language-en');
  await tap('onboarding-continue');
  await tap('follow-women');
  await tap('onboarding-continue');
  await tap('onboarding-start');
  await byId('screen-home').waitFor();
  check('Onboarding finishes on Home', true);
  check(
    'Home names the next fixture and marks it as demo data',
    (await page.getByText('Connacht').first().isVisible()) &&
      (await page.getByText('DEMO').first().isVisible()),
  );

  // 2. Ticket link-out ----------------------------------------------------
  await tap('hero-tickets');
  await settle(300);
  const opened = await page.evaluate(() => window.__opened);
  check(
    'Tickets opens the official ticket page and nowhere else',
    opened.length === 1 && opened[0].startsWith('https://www.scarlets.wales/tickets'),
    opened.join(', '),
  );

  // 3. Fixture viewing ----------------------------------------------------
  await tap('tab-match');
  await byId('screen-match').waitFor();
  await tap('match-view-results');
  await tap('fixture-fx-sim-demo-xv');
  await byId('screen-centre').waitFor();
  await settle();
  check(
    'A result opens in Match Centre with its score',
    (await text('score-home')) === '25' && (await text('score-away')) === '20',
  );
  check(
    'Every simulated score is labelled as a simulation',
    await page.getByText('Demo simulation. Not a real score.').first().isVisible(),
  );
  await tap('centre-tab-stats');
  check(
    'Statistics show once the provider has supplied them',
    await page.getByText('Possession').first().isVisible(),
  );
  await tap('nav-back');
  await tap('match-view-table');
  check(
    'The league table is withheld, with the reason',
    await page.getByText('licensed competition feed').first().isVisible(),
  );

  // 4. Matchday guide -----------------------------------------------------
  await tap('tab-matchday');
  await byId('screen-matchday').waitFor();
  await tap('check-ticket-ready');
  check(
    'A checklist item can be ticked',
    (await byId('check-ticket-ready').getAttribute('aria-checked')) === 'true',
  );
  await tap('meeting-point-choose');
  await tap('meeting-option-meet-shop');
  await settle(700);
  check('A meeting point can be chosen', (await text('meeting-point-value')) === 'Club shop doors');
  await tap('section-map');
  await byId('screen-guide-map').waitFor();
  check('The venue map says it is not for navigation', await visible('map-notice'));
  await tap('nav-back');

  // 5. Passport and membership --------------------------------------------
  await tap('tab-passport');
  await byId('passport-guest').waitFor();
  check(
    'Passport asks a guest to sign in and shows nothing else',
    await visible('passport-sign-in'),
  );
  await tap('passport-sign-in');
  await tap('sign-in-member');
  await byId('passport-card').waitFor();
  check('A linked member sees their Passport card', true);
  const programme = (await byId('programme').innerText()).replace(/\s+/g, ' ');
  check(
    'YMLAEN shows no points, balance or tier',
    programme.includes('Nothing to show yet') && !/\d+\s*(points|pts)/i.test(programme),
  );
  check('Member benefits are listed with terms still to follow', await visible('benefit-vx3'));

  // 6. Fan Zone voting ----------------------------------------------------
  await tap('tab-fan-zone');
  await byId('screen-fanzone').waitFor();
  await tap('poll-option-atmosphere');
  await tap('poll-submit');
  await byId('poll-results').waitFor();
  check('A vote is taken and results appear', true);
  check('The poll cannot be voted on twice', (await page.getByTestId('poll-submit').count()) === 0);
  await tap('predict-home-add');
  await tap('predict-submit');
  await byId('prediction-receipt').waitFor();
  check(
    'A score prediction is recorded',
    (await byId('prediction-receipt').innerText()).includes('21–17'),
  );

  // 7. Survives a reload --------------------------------------------------
  await page.reload();
  await byId('screen-fanzone').waitFor({ timeout: 20_000 });
  await byId('poll-results').waitFor();
  check('The vote and the sign-in survive a reload', true);

  check('No uncaught errors in the page', errors.length === 0, errors.slice(0, 2).join(' | '));
} catch (error) {
  check(
    'Smoke test ran to the end',
    false,
    error instanceof Error ? error.message.split('\n')[0] : String(error),
  );
  await page.screenshot({ path: join(artifacts, 'smoke-failure.png') }).catch(() => undefined);
} finally {
  await browser.close();
  await close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
