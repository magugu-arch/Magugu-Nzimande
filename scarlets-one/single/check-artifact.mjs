// Checks the Artifact build of the app before it is published.
//
//   node single/build.mjs --target=artifact
//   node single/check-artifact.mjs [path to the built page]
//
// A claude.ai Artifact supplies its own document around the page and runs it
// in a locked-down frame. This stands in for both: a wrapper like the one the
// publisher adds, a content security policy with no eval and no outside
// hosts, and a sandboxed frame with no storage of its own. It is a stand-in,
// not the real viewer: it catches what the documented rules would break.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(process.argv[2] ?? join(here, '.cache', 'Scarlets-One-Concept.html'));
if (!existsSync(file)) {
  console.error(`No Artifact build at ${file}. Run: node single/build.mjs --target=artifact`);
  process.exit(2);
}
const content = readFileSync(file, 'utf8');

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

/* ----------------------------------------------------------- the page itself */

const top = content.slice(0, 8192);
check(
  'It is page content only, with its title in the first 8 KB',
  !/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(content.slice(0, 200_000)) &&
    /<title>Scarlets One Concept<\/title>/.test(top),
);
const size = statSync(file).size;
check('It is under the 16 MB limit', size < 16 * 1024 * 1024, `${(size / 1048576).toFixed(2)} MB`);
const shell = content.slice(0, content.lastIndexOf('<script>'));
const outside = [...shell.matchAll(/(?:src|href)\s*=\s*["']?https?:|url\(["']?https?:/g)].length;
check('It refers to no outside file', outside === 0, `${outside} found`);

/* ------------------------------------------------- a stand-in for the viewer */

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdnjs.cloudflare.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'img-src data: blob:',
  'font-src data: https://fonts.gstatic.com',
  "connect-src 'none'",
].join('; ');
const wrapped = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>${content}</body></html>`;
const host = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{height:100%;margin:0}iframe{display:block;width:100%;height:100%;border:0}</style>
</head><body><iframe id="viewer" sandbox="allow-scripts" src="/page"></iframe></body></html>`;

const server = createServer((request, response) => {
  if (request.url === '/host') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(host);
  } else if (request.url === '/page') {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': CSP,
    });
    response.end(wrapped);
  } else {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();

async function open(options) {
  const context = await browser.newContext({ locale: 'en-GB', ...options });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  await page.goto(`${base}/host`);
  const frame = page.frameLocator('#viewer');
  const inner = page.frames().find((candidate) => candidate.url().endsWith('/page'));
  const byId = (id) => frame.getByTestId(id).first();
  const tap = async (id) => {
    await byId(id).scrollIntoViewIfNeeded();
    await byId(id).click();
  };
  return { context, page, frame, inner, errors, requests, byId, tap };
}

{
  const s = await open(devices['iPhone 14']);
  await s.byId('screen-onboarding').waitFor({ timeout: 30_000 });
  const start = await s.inner.evaluate(() => {
    let storage = 'available';
    try {
      window.localStorage.getItem('x');
    } catch {
      storage = 'refused';
    }
    const note = document.getElementById('so-concept');
    return {
      storage,
      note: note ? note.getBoundingClientRect().height > 0 && note.textContent : '',
      href: window.location.href,
    };
  });
  check(
    'It starts inside a sandboxed frame under a policy with no eval and no outside hosts',
    true,
    `the frame's storage is ${start.storage}`,
  );
  check(
    'The concept notice is on screen from the first screen',
    /Not an official Scarlets product/.test(start.note || ''),
  );

  await s.tap('language-en');
  await s.tap('onboarding-continue');
  await s.tap('onboarding-continue');
  await s.tap('onboarding-start');
  await s.byId('screen-home').waitFor();

  // Official pages: window.open is refused in the frame, so a link is followed.
  await s.inner.evaluate(() => {
    window.__followed = [];
    document.addEventListener(
      'click',
      (event) => {
        const link = event.target.closest ? event.target.closest('a[href]') : null;
        if (link) {
          window.__followed.push({ href: link.href, target: link.target });
          event.preventDefault();
        }
      },
      true,
    );
  });
  await s.tap('hero-tickets');
  await s.page.waitForTimeout(400);
  const followed = await s.inner.evaluate(() => window.__followed);
  check(
    'Tickets follows a real link to the official ticket page in a new tab',
    followed.length === 1 &&
      followed[0].href.startsWith('https://www.scarlets.wales/tickets') &&
      followed[0].target === '_blank',
    followed.map((link) => link.href).join(', '),
  );

  const screens = [
    ['tab-match', 'screen-match'],
    ['tab-matchday', 'screen-matchday'],
    ['tab-passport', 'screen-passport'],
    ['tab-fan-zone', 'screen-fanzone'],
  ];
  // Images here load as they come into view (a frame from another origin gets
  // no head start), so look at what is on screen, then scroll and look again.
  const onScreen = () =>
    s.inner.evaluate(async () => {
      await new Promise((done) => setTimeout(done, 500));
      const visible = Array.from(document.images).filter((img) => {
        const box = img.getBoundingClientRect();
        return (
          img.offsetParent !== null &&
          box.width > 0 &&
          box.bottom > 0 &&
          box.top < window.innerHeight &&
          box.right > 0 &&
          box.left < window.innerWidth
        );
      });
      return {
        images: visible.length,
        broken: visible.filter((img) => !(img.complete && img.naturalWidth > 0)).length,
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
  const scrollDown = (testId) =>
    s.inner.evaluate((id) => {
      const screen = document.querySelector(`[data-testid="${id}"]`);
      const scroller = Array.from(screen.querySelectorAll('*')).find(
        (el) =>
          el.scrollHeight > el.clientHeight + 40 &&
          /auto|scroll/.test(getComputedStyle(el).overflowY),
      );
      if (scroller) scroller.scrollTop += 700;
    }, testId);
  let broken = 0;
  let images = 0;
  let sideways = 0;
  for (const [tab, screen] of screens) {
    await s.tap(tab);
    await s.byId(screen).waitFor();
    for (let step = 0; step < 3; step += 1) {
      const state = await onScreen();
      images += state.images;
      broken += state.broken;
      sideways += state.sideways ? 1 : 0;
      await scrollDown(screen);
    }
  }
  check(
    'Tabs open, images show as they scroll into view, nothing scrolls sideways',
    broken === 0 && sideways === 0 && images > 20,
    `${images} images seen on screen, ${broken} broken`,
  );

  await s.tap('tab-match');
  await s.tap('match-view-results');
  await s.tap('fixture-fx-sim-demo-xv');
  await s.byId('screen-centre').waitFor();
  await s.tap('nav-back');
  await s.byId('screen-match').waitFor();
  const after = await s.inner.evaluate(() => ({
    href: window.location.href,
    font: document.fonts.check('16px ionicons'),
    note: document.getElementById('so-concept').getBoundingClientRect().height > 0,
  }));
  check(
    'Moving around never changes the page address, and the app’s back button works',
    after.href === start.href,
  );
  check('Icons draw and the concept notice is still on screen', after.font && after.note);

  // The viewer's theme choice.
  const ground = () =>
    s.inner.evaluate(async () => {
      await new Promise((done) => setTimeout(done, 400));
      const screen = document.querySelector('[data-testid="screen-match"]');
      return {
        page: getComputedStyle(document.body).backgroundColor,
        app: getComputedStyle(screen).backgroundColor,
      };
    });
  const light = await ground();
  await s.inner.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  const dark = await ground();
  await s.inner.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  const back = await ground();
  check(
    'The app follows the viewer’s light or dark choice, both ways',
    light.app !== dark.app && dark.page === 'rgb(20, 17, 20)' && back.app === light.app,
    `light ${light.app}, dark ${dark.app}`,
  );
  check(
    'Only the two pages are requested and nothing raises an error',
    s.requests.length === 2 && s.errors.length === 0,
    `${s.requests.length} requests, ${s.errors.length} errors${s.errors[0] ? `: ${s.errors[0]}` : ''}`,
  );
  await s.context.close();
}

{
  // A wide screen, and a system set to dark with no explicit choice.
  const s = await open({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await s.byId('screen-onboarding').waitFor({ timeout: 30_000 });
  const state = await s.inner.evaluate(() => ({
    page: getComputedStyle(document.body).backgroundColor,
    sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  check(
    'On a computer set to dark it opens dark and does not scroll sideways',
    state.page === 'rgb(20, 17, 20)' && !state.sideways && s.errors.length === 0,
  );
  await s.context.close();
}

await browser.close();
server.close();

const failed = results.filter((result) => !result.pass);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
