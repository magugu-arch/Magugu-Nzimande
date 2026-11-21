// Captures the phone screens shown in the proposal from the working app
// (Scarlets_One.html, labelled demo data).
//
//   node proposal/src/shots.mjs [dark|light]   (the deck uses dark)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const app = pathToFileURL(join(here, '..', '..', 'Scarlets_One.html')).href;
const theme = process.argv[2] ?? 'dark';
const out = join(here, '..', 'img', 'screens');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'en-GB',
  colorScheme: theme,
  reducedMotion: 'reduce',
});
await context.addInitScript((chosen) => {
  if (!localStorage.getItem('scarlets:prefs')) {
    localStorage.setItem(
      'scarlets:prefs',
      JSON.stringify({
        state: {
          onboarded: true,
          locale: 'en',
          theme: chosen,
          following: ['first_team', 'women'],
          reduceMotion: true,
          deviceId: 'dev-proposal',
        },
        version: 0,
      }),
    );
  }
}, theme);
const page = await context.newPage();
await page.goto(app);
const byId = (id) => page.getByTestId(id).first();
const tap = async (id) => {
  await byId(id).scrollIntoViewIfNeeded();
  await byId(id).click();
};
const shot = async (name) => {
  await page.waitForTimeout(900);
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((img) => {
        const box = img.getBoundingClientRect();
        return box.width > 0 && box.top < window.innerHeight && box.bottom > 0;
      })
      .every((img) => img.complete),
  );
  await page.screenshot({ path: join(out, `${name}-${theme}.jpg`), type: 'jpeg', quality: 90 });
};

await byId('screen-home').waitFor({ timeout: 30_000 });
// Passport reads best as a member: sign in with the demo account first.
await tap('tab-passport');
await tap('passport-sign-in');
await tap('sign-in-member');
await byId('passport-card').waitFor();
await shot('passport');

await tap('tab-index');
await shot('home');

await tap('tab-match');
await tap('match-view-results');
await tap('fixture-fx-sim-demo-xv');
await byId('screen-centre').waitFor();
await shot('match-centre');
await tap('nav-back');

await tap('tab-matchday');
await byId('screen-matchday').waitFor();
await page.evaluate(() => {
  const screen = document.querySelector('[data-testid="screen-matchday"]');
  const scroller = Array.from(screen.querySelectorAll('*')).find(
    (el) =>
      el.scrollHeight > el.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(el).overflowY),
  );
  if (scroller) scroller.scrollTop = 250;
});
await shot('matchday');

await tap('tab-fan-zone');
await byId('screen-fanzone').waitFor();
await page.evaluate(() => {
  const screen = document.querySelector('[data-testid="screen-fanzone"]');
  const scroller = Array.from(screen.querySelectorAll('*')).find(
    (el) =>
      el.scrollHeight > el.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(el).overflowY),
  );
  if (scroller) scroller.scrollTop = 190;
});
await shot('fan-zone');

await page.evaluate(() => {
  window.location.hash = '#/onboarding';
});
await byId('screen-onboarding').waitFor();
await shot('welcome');

await browser.close();
console.log(`screens captured (${theme})`);
