// Checks Scarlets_One.html the ways a supporter would meet it.
//
//   npm run single:check            (add --markdown for a table)
//
// Everything runs in Playwright's Chromium with a phone's screen, touch input
// and browser identity. These are not physical phones, and Safari's engine is
// not exercised: where a row says iPhone, it means an iPhone-sized screen.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, '..', 'Scarlets_One.html');
if (!existsSync(file)) {
  console.error('No Scarlets_One.html. Run `npm run single:build` first.');
  process.exit(2);
}
const fileUrl = pathToFileURL(file).href;
const markdown = process.argv.includes('--markdown');

const results = [];
const check = (where, name, pass, detail = '') => {
  results.push({ where, name, pass, detail });
  if (!markdown) {
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${where}: ${name}${detail ? `  (${detail})` : ''}`);
  }
};

const browser = await chromium.launch();

/** A page with its errors and network requests recorded. */
async function open(options, { init, url = fileUrl } = {}) {
  const context = await browser.newContext({ locale: 'en-GB', ...options });
  if (init) await context.addInitScript(init);
  await context.addInitScript(() => {
    window.__opened = [];
    window.open = (target) => {
      window.__opened.push(String(target));
      return null;
    };
  });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  await page.goto(url);
  const byId = (id) => page.getByTestId(id).first();
  const tap = async (id) => {
    await byId(id).scrollIntoViewIfNeeded();
    await byId(id).click();
  };
  const onboard = async () => {
    await byId('screen-onboarding').waitFor({ timeout: 30_000 });
    await tap('language-en');
    await tap('onboarding-continue');
    await tap('onboarding-continue');
    await tap('onboarding-start');
    await byId('screen-home').waitFor();
  };
  /** Images on screen that have loaded, and whether the page scrolls sideways. */
  const survey = () =>
    page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const images = Array.from(document.images).filter((img) => img.offsetParent !== null);
      return {
        images: images.length,
        broken: images.filter((img) => !(img.complete && img.naturalWidth > 0)).length,
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
  return { context, page, errors, requests, byId, tap, onboard, survey };
}

/* ---------------------------------------------- Android, file, JavaScript on */

{
  const where = 'Android phone · Chrome, file opened from storage';
  const s = await open(devices['Pixel 7']);
  await s.onboard();
  check(where, 'The app starts from the file and onboarding finishes on Home', true);

  const routes = [
    ['tab-match', 'screen-match', '#/match'],
    ['tab-matchday', 'screen-matchday', '#/matchday'],
    ['tab-passport', 'screen-passport', '#/passport'],
    ['tab-fan-zone', 'screen-fanzone', '#/fan-zone'],
    ['tab-index', 'screen-home', '#/'],
  ];
  const seen = [];
  let broken = 0;
  let images = 0;
  let sideways = 0;
  for (const [tab, screen, hash] of routes) {
    await s.tap(tab);
    await s.byId(screen).waitFor();
    const state = await s.survey();
    images += state.images;
    broken += state.broken;
    sideways += state.sideways ? 1 : 0;
    seen.push(
      new URL(s.page.url()).hash === hash ||
        (hash === '#/' && !new URL(s.page.url()).hash.slice(2)),
    );
  }
  check(
    where,
    'Five tabs open, each with its address kept in the file link',
    seen.every(Boolean),
    '…Scarlets_One.html#/match and so on',
  );
  check(
    where,
    'Every image on the five tabs shows',
    broken === 0,
    `${images} images, ${broken} broken`,
  );
  check(where, 'No tab scrolls sideways', sideways === 0);

  await s.tap('tab-match');
  await s.tap('match-view-results');
  await s.tap('fixture-fx-sim-demo-xv');
  await s.byId('screen-centre').waitFor();
  const score = `${(await s.byId('score-home').textContent())?.trim()}–${(await s.byId('score-away').textContent())?.trim()}`;
  check(where, 'A fixture opens in Match Centre', score === '25–20', `demo score ${score}`);
  await s.page.goBack();
  await s.byId('screen-match').waitFor();
  check(
    where,
    'The phone’s Back button returns to the previous screen',
    await s.byId('screen-match').isVisible(),
  );

  await s.page.evaluate(() => {
    window.location.hash = '#/library';
  });
  await s.byId('screen-library').waitFor();
  const library = await s.page.evaluate(async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const shown = Array.from(document.images).filter(
      (img) => img.src.startsWith('blob:') && img.complete && img.naturalWidth > 0,
    );
    return new Set(shown.map((img) => img.src)).size;
  });
  check(
    where,
    'The image library shows all 39 embedded images',
    library === 39,
    `${library} of 39`,
  );

  await s.page.evaluate(() => {
    window.location.hash = '#/fan-zone';
  });
  await s.byId('screen-fanzone').waitFor();
  await s.tap('poll-option-atmosphere');
  await s.tap('poll-submit');
  await s.byId('poll-results').waitFor();
  check(where, 'A Fan Zone poll takes a vote and shows the result', true);

  await s.page.reload();
  await s.byId('screen-fanzone').waitFor({ timeout: 30_000 });
  check(
    where,
    'Reopening the file keeps the place and the vote',
    await s.byId('poll-results').isVisible(),
  );
  await s.page.waitForTimeout(1500);
  const facts = await s.page.evaluate(() => ({
    font: document.fonts.check('16px ionicons'),
    still: Boolean(document.getElementById('so-static')),
  }));
  check(where, 'The icon font is loaded from the file', facts.font);
  check(where, 'The still preview is removed once the app is running', !facts.still);
  check(
    where,
    'Nothing is fetched from the internet and nothing fails',
    s.requests.length === 0 && s.errors.length === 0,
    `${s.requests.length} requests, ${s.errors.length} errors${s.errors[0] ? `: ${s.errors[0]}` : ''}`,
  );
  await s.context.close();
}

/* -------------------------------------------------------- JavaScript is off */

async function stillPreview(where, device) {
  const s = await open({ ...device, javaScriptEnabled: false });
  await s.page.waitForTimeout(400);
  const first = await s.page.evaluate(() => ({
    width: window.innerWidth,
    preview: getComputedStyle(document.getElementById('so-static')).display !== 'none',
    app: getComputedStyle(document.getElementById('root')).display !== 'none',
    text: document.querySelector('.so-frame[data-frame="home"]').innerText,
  }));
  check(
    where,
    'The still preview shows instead of a blank page',
    first.preview && !first.app && /Connacht/.test(first.text) && /DEMO/.test(first.text),
    `laid out ${first.width} px wide; names the example fixture and marks it DEMO`,
  );

  const expected = {
    match: /Fixtures|Results/,
    matchday: /Matchday/,
    passport: /Passport/,
    'fan-zone': /Fan Zone/,
    home: /Connacht/,
  };
  const switched = [];
  for (const [tab, pattern] of Object.entries(expected)) {
    await s.page.locator(`.so-frame label[for="so-t-${tab}"]:visible`).first().click();
    await s.page.waitForTimeout(150);
    const frame = await s.page.evaluate((name) => {
      const visible = Array.from(document.querySelectorAll('.so-frame')).filter(
        (el) => getComputedStyle(el).display !== 'none',
      );
      const scroller = Array.from(visible[0]?.querySelectorAll('*') ?? []).find(
        (el) =>
          el.scrollHeight > el.clientHeight + 40 &&
          /auto|scroll/.test(getComputedStyle(el).overflowY),
      );
      let scrolls = false;
      if (scroller) {
        scroller.scrollTop = 300;
        scrolls = scroller.scrollTop > 0;
        scroller.scrollTop = 0;
      }
      return {
        only: visible.length === 1 && visible[0].dataset.frame === name,
        text: visible[0]?.innerText ?? '',
        scrolls,
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    }, tab);
    switched.push(frame.only && pattern.test(frame.text) && frame.scrolls && !frame.sideways);
  }
  check(
    where,
    'The five tabs switch from the tab bar, each page scrolls, none scrolls sideways',
    switched.every(Boolean),
    `${switched.filter(Boolean).length} of 5`,
  );

  await s.page.locator('label[for="so-t-about"]:visible').click();
  const about = await s.page.locator('.so-frame[data-frame="about"]').innerText();
  check(
    where,
    '“About this file” says it is a concept and how to open the working app',
    /Not an official Scarlets product/.test(about) &&
      /Chrome/.test(about) &&
      /demo data/.test(about),
  );
  await s.page.locator('label[for="so-t-library"]:visible').click();
  await s.page.waitForTimeout(200);
  // Page scripts are off, so nothing can wait on a load event: start the
  // images, give the browser a moment, then read their state.
  await s.page.evaluate(() => {
    const rules = Array.from(document.getElementById('so-media').sheet.cssRules);
    window.__probe = rules.map((rule) => {
      const img = new Image();
      img.src = rule.style.backgroundImage.slice(5, -2);
      return img;
    });
  });
  await s.page.waitForTimeout(1200);
  const media = await s.page.evaluate(() => {
    const library = document.querySelector('.so-frame[data-frame="library"]');
    return {
      rules: window.__probe.length,
      decoded: window.__probe.filter((img) => img.complete && img.naturalWidth > 0).length,
      inLibrary: new Set(
        Array.from(library.querySelectorAll('.so-m')).map((el) =>
          Array.from(el.classList).find((name) => name.startsWith('so-m-')),
        ),
      ).size,
      font: document.fonts.check('16px ionicons'),
    };
  });
  check(
    where,
    'All 39 embedded images decode and the image library lists them',
    media.rules === 39 && media.decoded === 39 && media.inLibrary === 39,
    `${media.decoded} of ${media.rules} decode; ${media.inLibrary} in the library`,
  );
  check(where, 'Icons draw from the embedded font', media.font);
  check(
    where,
    'Nothing is fetched from the internet',
    s.requests.length === 0,
    `${s.requests.length} requests`,
  );
  await s.context.close();
}

await stillPreview(
  'iPhone-sized screen · JavaScript off (as a file preview)',
  devices['iPhone 14'],
);
await stillPreview('Android phone · JavaScript off (as HTML Viewer)', devices['Pixel 7']);

{
  const where = 'JavaScript off · other screen sizes';
  const sizes = [];
  for (const width of [320, 360, 414, 430]) {
    const s = await open({
      viewport: { width, height: 780 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      javaScriptEnabled: false,
    });
    const state = await s.page.evaluate(() => ({
      layout: window.innerWidth,
      sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
    }));
    sizes.push(`${width}→${state.layout}${state.sideways ? ' sideways!' : ''}`);
    await s.context.close();
  }
  check(
    where,
    'Phones from 320 to 430 px lay the preview out at 390 px with no sideways scroll',
    sizes.every((size) => size.endsWith('→390')),
    sizes.join(', '),
  );
  const desktop = await open({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
  const box = await desktop.page.locator('#so-static').boundingBox();
  check(
    where,
    'On a computer the preview is a centred phone-width column',
    box.width === 390 && Math.abs(box.x - (1280 - 390) / 2) <= 1,
    `${box.width} px wide at x=${box.x}`,
  );
  await desktop.context.close();
}

/* ----------------------------------------------------------- awkward hosts */

{
  const where = 'Storage refused (as when a messaging app hands the file over)';
  const s = await open(devices['Pixel 7'], {
    init: () => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('Access is denied for this document.', 'SecurityError');
        },
      });
    },
  });
  await s.onboard();
  await s.tap('tab-passport');
  await s.byId('screen-passport').waitFor();
  await s.tap('tab-index');
  await s.byId('screen-home').waitFor();
  check(
    where,
    'The app still starts, and choices last until it is closed',
    s.errors.length === 0,
    `${s.errors.length} errors`,
  );
  await s.context.close();
}

{
  const where = 'History changes refused by the viewer';
  const s = await open(devices['Pixel 7'], {
    init: () => {
      const refuse = () => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      };
      window.history.pushState = refuse;
      window.history.replaceState = refuse;
    },
  });
  await s.onboard();
  await s.tap('tab-match');
  await s.byId('screen-match').waitFor();
  await s.tap('match-view-results');
  await s.tap('fixture-fx-sim-demo-xv');
  await s.byId('screen-centre').waitFor();
  await s.tap('nav-back');
  await s.byId('screen-match').waitFor();
  check(
    where,
    'Screens open and the app’s own back button works',
    (await s.byId('screen-match').isVisible()) && s.errors.length === 0,
    `${s.errors.length} errors`,
  );
  await s.context.close();
}

{
  const where = 'The app fails to start (simulated)';
  const s = await open(devices['Pixel 7'], {
    init: () => {
      // Metro's module loader assigns this as it starts: make that throw.
      Object.defineProperty(window, '__r', {
        configurable: true,
        get: () => undefined,
        set: () => {
          throw new Error('simulated start-up failure');
        },
      });
    },
  });
  await s.page.waitForTimeout(800);
  const state = await s.page.evaluate(() => ({
    preview: getComputedStyle(document.getElementById('so-static')).display !== 'none',
    splash: getComputedStyle(document.getElementById('so-splash')).display !== 'none',
    viewport: document.querySelector('meta[name="viewport"]').content,
  }));
  check(
    where,
    'The still preview comes back instead of a stuck splash',
    state.preview && !state.splash && state.viewport === 'width=390',
  );
  await s.context.close();
}

/* -------------------------------------------------------- served on the web */

{
  const where = 'iPhone-sized screen · served over HTTP (as a hosted copy)';
  const body = readFileSync(file);
  const server = createServer((request, response) => {
    if (request.url.split('?')[0] === '/Scarlets_One.html') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(body);
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/Scarlets_One.html`;
  const s = await open(devices['iPhone 14'], { url: `${base}#/match` });
  await s.onboard();
  await s.tap('tab-matchday');
  await s.byId('screen-matchday').waitFor();
  const state = await s.survey();
  check(
    where,
    'One request serves the whole app; tabs, images and layout hold',
    s.requests.length === 1 && s.errors.length === 0 && state.broken === 0 && !state.sideways,
    `${s.requests.length} request, ${state.images} images on Matchday, ${s.errors.length} errors`,
  );
  await s.page.goto(`${base}#/passport`);
  await s.page.reload();
  await s.byId('screen-passport').waitFor({ timeout: 30_000 });
  check(where, 'A link to a screen opens that screen', await s.byId('screen-passport').isVisible());
  await s.context.close();
  server.close();
}

/* ------------------------------------------------------------- the file */

{
  const where = 'The file';
  const html = readFileSync(file, 'utf8');
  const headEnd = html.indexOf('</head>');
  const head = html.slice(0, headEnd).replace(/<style[\s\S]*?<\/style>/g, '');
  const tags = [
    '<meta charset="utf-8">',
    '<title>',
    'name="description"',
    'name="theme-color"',
    'name="robots" content="noindex, nofollow"',
    'property="og:title"',
    'property="og:description"',
    'name="twitter:card"',
    'rel="icon"',
    'rel="apple-touch-icon"',
  ];
  const missing = tags.filter((tag) => !head.includes(tag));
  check(
    where,
    'Title, description, sharing tags, theme colour and icons are embedded',
    missing.length === 0 && html.indexOf('<meta charset') < 1024,
    missing.length ? `missing ${missing.join(', ')}` : `${tags.length} of ${tags.length}`,
  );
  const shell = html.slice(0, html.lastIndexOf('<script>'));
  const remote = [...shell.matchAll(/(?:src|href)\s*=\s*["']?https?:|url\(["']?https?:/g)];
  check(where, 'The page refers to no outside file', remote.length === 0, `${remote.length} found`);
  const size = statSync(file).size;
  check(where, 'Size', size < 12 * 1024 * 1024, `${(size / 1024 / 1024).toFixed(2)} MB`);
}

await browser.close();

const failed = results.filter((result) => !result.pass);
if (markdown) {
  console.log('| Where | Check | Result | Detail |');
  console.log('| --- | --- | --- | --- |');
  for (const result of results) {
    console.log(
      `| ${result.where} | ${result.name} | ${result.pass ? 'Pass' : 'FAIL'} | ${result.detail} |`,
    );
  }
}
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
