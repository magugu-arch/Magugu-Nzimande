#!/usr/bin/env node
/**
 * Opens the single file the way people will: from disk (file://), as an
 * iPhone and an Android phone with JavaScript on, and with JavaScript off
 * (how iPhone Files, WhatsApp document previews and Android's HTML viewer
 * show it). Fails on errors, missing screens or images, sideways scrolling,
 * or broken interactions.
 *
 *   node single-file/tests/check.mjs [file.html] [--shots dir]
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const here = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2);
const file = resolve(
  args.find((a) => a.endsWith('.html')) ?? join(here, '..', 'Kaizer_Chiefs_One_Concept.html'),
);
const shotsAt = args.indexOf('--shots');
const shots = shotsAt >= 0 ? resolve(args[shotsAt + 1]) : null;
if (shots) mkdirSync(shots, { recursive: true });
const url = 'file://' + file;

const ROUTES = [
  'welcome',
  'home',
  'story-matchday',
  'story-women',
  'story-academy',
  'story-community',
  'match',
  'match-centre',
  'player',
  'fan',
  'share',
  'mine',
  'moment',
  'community',
  'tickets',
  'membership',
  'rewards',
  'shop',
  'alerts',
  'profile',
  'notify',
  'privacy',
  'help',
  'about',
];

const results = [];
const check = (where, what, ok, detail = '') => {
  results.push({ where, what, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${where} · ${what}${detail ? ` · ${detail}` : ''}`);
};

const browser = await chromium
  .launch()
  .catch(() =>
    chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }),
  );

// ---- Static checks on the file itself ----------------------------------
{
  const html = readFileSync(file, 'utf8');
  const size = statSync(file).size;
  check(
    'File',
    'self-contained (no external requests)',
    !/\s(src|href)=["']https?:/i.test(html.replace(/<meta[^>]+>/g, '')),
    `${(size / 1048576).toFixed(2)} MB`,
  );
  check(
    'File',
    'link-preview tags',
    /property="og:title"/.test(html) &&
      /property="og:image"/.test(html) &&
      /name="twitter:card"/.test(html),
  );
  const manifest = JSON.parse(
    html.match(/<script type="application\/json" id="kc-manifest">([\s\S]*?)<\/script>/)[1],
  );
  check(
    'File',
    'image register embedded',
    manifest.images.length === 9 && manifest.images.every((i) => i.status === 'concept'),
    `${manifest.images.length} images`,
  );
  check(
    'File',
    'kept out of search engines',
    /name="robots" content="noindex, nofollow"/.test(html),
  );
  const og = statSync(join(file, '..', 'og-image.jpg')).size;
  check(
    'File',
    'preview image under WhatsApp’s 300 KB',
    og < 300 * 1024,
    `${Math.round(og / 1024)} KB`,
  );
}

async function sweep(name, ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForTimeout(400);
  let bad = [];
  for (const r of ROUTES) {
    await page.evaluate((id) => {
      location.hash = id;
    }, r);
    await page.waitForTimeout(140);
    const m = await page.evaluate((id) => {
      const active = [...document.querySelectorAll('.view.is-active')];
      const v = active[0];
      const imgs = v ? [...v.querySelectorAll('.img')].filter((e) => e.offsetWidth > 0) : [];
      const noImg = imgs.filter(
        (e) => !getComputedStyle(e).backgroundImage.startsWith('url("data:image/jpeg'),
      );
      const intro = document.querySelector('.nojs-intro').offsetHeight;
      const top = v ? v.getBoundingClientRect().top + window.scrollY : -1;
      return {
        one: active.length === 1 && v.id === id && intro === 0 && top === 0,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        text: v ? v.innerText.trim().length : 0,
        images: imgs.length,
        missing: noImg.length,
      };
    }, r);
    if (!m.one || m.overflow > 1 || m.text < 30 || m.missing)
      bad.push(`${r}: ${JSON.stringify(m)}`);
  }
  check(
    name,
    `all ${ROUTES.length} screens route, show images, no sideways scroll`,
    bad.length === 0,
    bad.slice(0, 3).join(' | '),
  );
  return { ctx, page, errors };
}

async function shot(page, label) {
  if (shots) await page.screenshot({ path: join(shots, `${label}.png`) });
}

// ---- iPhone (Chromium with the iPhone's screen, touch and identity) -----
{
  const { ctx, page, errors } = await sweep('iPhone · file (JS on)', {
    ...devices['iPhone 15'],
    deviceScaleFactor: 2,
  });
  for (const r of [
    'welcome',
    'home',
    'match',
    'match-centre',
    'fan',
    'tickets',
    'profile',
    'about',
  ]) {
    await page.evaluate((id) => {
      location.hash = id;
    }, r);
    await page.waitForTimeout(450);
    await shot(page, `iphone-${r}`);
  }

  // Segmented control and filters
  await page.evaluate(() => {
    location.hash = 'match';
  });
  await page.waitForTimeout(300);
  await page.click('#match .seg-btn[data-panel="squad"]');
  await page.waitForTimeout(500);
  const squad = await page.evaluate(() => {
    const p = document.querySelector('#match [data-panel-id="squad"]');
    const m = document.querySelector('#match .seg-marker');
    const b = document.querySelector('#match .seg-btn[data-panel="squad"]');
    return {
      visible: p.offsetHeight > 0,
      markerAt: Math.round(new DOMMatrix(getComputedStyle(m).transform).m41),
      btnAt: b.offsetLeft,
    };
  });
  check(
    'iPhone · file (JS on)',
    'segmented control switches and its marker follows',
    squad.visible && Math.abs(squad.markerAt - squad.btnAt) < 2,
    JSON.stringify(squad),
  );
  await page.click('#match .seg-btn[data-panel="fixtures"]');
  await page.click('#match [data-filter="venue"] .chip[data-value="away"]');
  const away = await page.evaluate(
    () =>
      [...document.querySelectorAll('#match [data-filter-target="venue"] .fixture')].filter(
        (f) => !f.hidden,
      ).length,
  );
  check('iPhone · file (JS on)', 'home/away filter', away === 2, `${away} away fixtures`);

  // Quick link opens the squad section
  await page.evaluate(() => {
    location.hash = 'home';
  });
  await page.waitForTimeout(300);
  await page.click('#home .tile[data-seg="squad"]');
  await page.waitForTimeout(400);
  const viaLink = await page.evaluate(
    () =>
      location.hash === '#match' &&
      document.querySelector('#match [data-panel-id="squad"]').offsetHeight > 0,
  );
  check('iPhone · file (JS on)', 'Home → Squad quick link opens the squad', viaLink);

  // Share a moment: consent gate, file pick, preview, submit, My moments
  const jpg = join(tmpdir(), 'kc1-moment.jpg');
  writeFileSync(
    jpg,
    Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      'base64',
    ),
  );
  await page.evaluate(() => {
    location.hash = 'share';
  });
  await page.waitForTimeout(300);
  const gated = await page.isDisabled('#share [data-step-next]');
  await page.click('#share [data-consent="terms"] + .box');
  await page.click('#share [data-consent="rights"] + .box');
  await page.click('#share [data-minors="no"]');
  const open = await page.isEnabled('#share [data-step-next]');
  check('iPhone · file (JS on)', 'Fan Moment consent gates Continue', gated && open);
  await page.click('#share [data-step-next]');
  await page.setInputFiles('#share [data-media-input]', jpg);
  await page.waitForSelector('#share [data-step="3"]:not([hidden]) [data-preview] img');
  await page.fill('#share [data-caption]', 'Scarves up');
  await page.click('#share [data-submit]');
  await page.waitForSelector('#share [data-step="4"]:not([hidden])');
  await shot(page, 'iphone-share-done');
  await page.evaluate(() => {
    location.hash = 'mine';
  });
  await page.waitForTimeout(300);
  const mine = await page.evaluate(() => document.querySelectorAll('#mine .mine-item').length);
  check(
    'iPhone · file (JS on)',
    'submitted moment shows in My moments, pending review',
    mine === 1,
  );

  // Report sheet: opens, closes on Escape
  await page.evaluate(() => {
    location.hash = 'moment';
  });
  await page.waitForTimeout(300);
  await page.click('#moment [data-action="report"]');
  await page.waitForTimeout(700);
  await shot(page, 'iphone-sheet');
  const openSheet = await page.evaluate(() => {
    const s = document.querySelector('.sheet');
    return (
      !document.querySelector('[data-sheet]').hidden &&
      Math.abs(new DOMMatrix(getComputedStyle(s).transform).m42) < 2
    );
  });
  // Drag it down with a flick: should project past the threshold and close.
  const box = await page.locator('.sheet .grabber').boundingBox();
  await page.mouse.move(box.x + 10, box.y + 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(box.x + 10, box.y + 2 + i * 30);
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await page.waitForTimeout(900);
  const closed = await page.evaluate(() => document.querySelector('[data-sheet]').hidden);
  check(
    'iPhone · file (JS on)',
    'report sheet opens and a downward flick dismisses it',
    openSheet && closed,
  );

  // Ticket: entry code stays a non-scannable demo placeholder
  await page.evaluate(() => {
    location.hash = 'tickets';
  });
  await page.waitForTimeout(300);
  await page.click('#tickets [data-action="entry-code"]');
  const hatch = await page.evaluate(
    () =>
      document.querySelector('[data-ticket-code]').offsetHeight > 0 &&
      !document.querySelector('[data-entry-result]').hidden,
  );
  check(
    'iPhone · file (JS on)',
    'entry code shows the DEMO placeholder and an honest notice',
    hatch,
  );

  // Preferences survive a reload
  await page.evaluate(() => {
    location.hash = 'privacy';
  });
  await page.waitForTimeout(300);
  await page.click('#privacy [data-pref="analytics"]');
  await page.reload();
  await page.waitForTimeout(400);
  const kept = await page.evaluate(
    () => document.querySelector('#privacy [data-pref="analytics"]').checked,
  );
  check('iPhone · file (JS on)', 'privacy choice is remembered on this device', kept);

  // Notifications read state
  await page.evaluate(() => {
    location.hash = 'alerts';
  });
  await page.waitForTimeout(300);
  await page.click('#alerts [data-action="read-all"]');
  const badge = await page.evaluate(() => document.querySelector('[data-unread]').textContent);
  check('iPhone · file (JS on)', 'read all clears the unread badge', badge === '');

  const hidden = await page.evaluate(
    () => document.querySelector('[data-action="save-file"]').hidden,
  );
  check('iPhone · file (JS on)', 'save button hidden when opened as the file itself', hidden);
  check(
    'iPhone · file (JS on)',
    'no script or console errors',
    errors.length === 0,
    errors.slice(0, 2).join(' | '),
  );
  await ctx.close();
}

// ---- Android Chrome ------------------------------------------------------
{
  const { ctx, page, errors } = await sweep('Android · Chrome file (JS on)', {
    ...devices['Pixel 7'],
    deviceScaleFactor: 1,
  });
  await shot(page, 'android-last');
  check(
    'Android · Chrome file (JS on)',
    'no script or console errors',
    errors.length === 0,
    errors.slice(0, 2).join(' | '),
  );
  await ctx.close();
}

// ---- Smallest phone ------------------------------------------------------
{
  const { ctx, errors } = await sweep('320 px phone (JS on)', {
    viewport: { width: 320, height: 640 },
    isMobile: true,
    hasTouch: true,
  });
  check(
    '320 px phone (JS on)',
    'no script or console errors',
    errors.length === 0,
    errors.slice(0, 2).join(' | '),
  );
  await ctx.close();
}

// ---- JavaScript off: iPhone Files, WhatsApp previews, Android HTML viewer --
for (const [name, opts] of [
  [
    'No JavaScript · iPhone width',
    { ...devices['iPhone 15'], javaScriptEnabled: false, deviceScaleFactor: 2 },
  ],
  ['No JavaScript · 320 px', { viewport: { width: 320, height: 640 }, javaScriptEnabled: false }],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const views = [...document.querySelectorAll('.view')];
    const imgs = [...document.querySelectorAll('.img, .thumb')].filter((e) => e.offsetWidth > 0);
    return {
      views: views.length,
      visible: views.filter((v) => v.offsetHeight > 200).length,
      intro: document.querySelector('.nojs-intro').offsetHeight > 0,
      contents: document.querySelectorAll('.contents a').length,
      tabbar: document.querySelector('.tabbar').offsetHeight,
      images: imgs.length,
      missing: imgs.filter(
        (e) => !getComputedStyle(e).backgroundImage.startsWith('url("data:image/jpeg'),
      ).length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      hatch: document.querySelector('[data-ticket-code]').offsetHeight > 0,
      fonts: document.fonts ? [...document.fonts].filter((f) => f.status !== 'error').length : -1,
    };
  });
  check(
    name,
    'every screen readable, one after another',
    m.views === ROUTES.length &&
      m.visible === ROUTES.length &&
      m.intro &&
      m.contents === 14 &&
      m.tabbar === 0,
    `${m.visible}/${m.views} screens`,
  );
  check(
    name,
    'every image shows',
    m.images >= 30 && m.missing === 0,
    `${m.images} image blocks, ${m.missing} missing`,
  );
  check(name, 'no sideways scroll', m.overflow <= 1, `${m.overflow}px`);
  check(name, 'demo ticket placeholder shown, never a code', m.hatch);
  if (name.includes('iPhone')) {
    await shot(page, 'nojs-top');
    await page.evaluate(() => document.querySelector('#match-centre').scrollIntoView());
    await shot(page, 'nojs-match-centre');
    await page.evaluate(() => document.querySelector('#tickets').scrollIntoView());
    await shot(page, 'nojs-tickets');
  }
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(
  join(here, 'last-run.json'),
  JSON.stringify({ when: new Date().toISOString(), file: file.split('/').pop(), results }, null, 1),
);
console.log(
  failed.length
    ? `\n${failed.length} of ${results.length} checks failed`
    : `\nAll ${results.length} checks passed`,
);
process.exit(failed.length ? 1 : 0);
