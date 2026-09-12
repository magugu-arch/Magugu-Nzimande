#!/usr/bin/env node
/**
 * A screen wider than a phone.
 *
 * `app.json` says `"orientation": "portrait"` and it also says
 * `"supportsTablet": true`, and those two together are the whole of this
 * sweep. A portrait iPad is 834 points across and a landscape one is 1194 —
 * two to three times every width this repository has ever swept. `audit:screens`
 * uses 390 and 320. `audit:text-scale` uses 320. Nothing has ever been wider
 * than a large phone.
 *
 * Two things are visible in the source before a browser is opened:
 *
 *   1. Seven screens read `Dimensions.get('window')` **at module scope** — once,
 *      at import, never again. On a phone that is harmless because the number
 *      never changes. On a tablet it is captured correctly and then used to
 *      size things that should not be that size; on the web build, where the
 *      window can be dragged, it is simply stale.
 *
 *   2. There is exactly one `maxWidth` in the entire app, on a dialog. Every
 *      other layout stretches to whatever it is given.
 *
 * The sharpest consequence is `product/[id].tsx`: `HERO_HEIGHT = SCREEN_WIDTH *
 * 1.05`. On a 390pt phone that is a 410pt image on an 844pt screen — a little
 * under half, which is a deliberate and good design. On a landscape iPad it is
 * 1254 points tall on an 834-point screen, so a customer who opens a product
 * sees an image and nothing else.
 *
 * What this sweep will and will not call a defect matters, because most of
 * what a phone layout does on a tablet is a *design* question and design is not
 * mine to invent:
 *
 *   a defect   sideways scroll, a blank screen, a crash, or a hero taller than
 *              the viewport it is in — the customer cannot see the thing they
 *              opened
 *   reported   the longest line of text, in characters. Past about 80 is a
 *              legibility standard rather than an opinion, but what to do about
 *              it is a layout decision, so the number is printed and not failed
 *              on
 *
 * Run: npm run audit:wide
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-wide');
const PORT = 8311;
const BASE = `http://localhost:${PORT}`;

const TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

function serve() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = path.resolve(OUT, '.' + pathname);
    if (file !== OUT && !file.startsWith(OUT + path.sep)) file = path.join(OUT, 'index.html');
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(OUT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

/**
 * The two shapes a supported iPad actually has.
 *
 * Portrait first because `orientation: "portrait"` is what the app asks for,
 * and landscape second because `supportsTablet` means the OS can still hand it
 * one — a Slide Over, a Stage Manager window, a Split View half.
 */
const SIZES = [
  { name: 'iPad portrait', width: 834, height: 1194 },
  { name: 'iPad landscape', width: 1194, height: 834 },
];

/** Screens with something to lay out, rather than a form and a button. */
const ROUTES = [
  '/home',
  '/menu',
  '/product/golden-original',
  '/offers',
  '/offers/promo-free-delivery',
  '/cart',
  '/checkout',
  '/orders',
  '/order/order-4821',
  '/rewards',
  '/rewards/reward-birthday',
  '/account/help',
];

/**
 * Everything measurable about how a screen sits in a viewport.
 *
 * Run in the page, so it reads what was actually painted rather than what the
 * styles say. The longest line is counted in characters at the rendered font,
 * which is the only version of that number worth having.
 */
const probe = ({ viewportWidth, viewportHeight }) => {
  /*
    A carousel's children are *meant* to be past the right edge — that is what
    horizontal scrolling is. `audit:screens` has carried this filter since it
    was written and the first version of this sweep did not, so it reported
    Home's "Popular right now" row running 890px past the edge as a finding.
    It is a finding about this file.
  */
  const inScroller = (node) => {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const overflow = getComputedStyle(parent).overflowX;
      if (overflow === 'scroll' || overflow === 'auto') return true;
    }
    return false;
  };

  const past = [];
  for (const node of document.querySelectorAll('div, span, p, button, input')) {
    const box = node.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || inScroller(node)) continue;
    if (box.right > viewportWidth + 1 && box.left < viewportWidth) {
      const text = (node.textContent ?? '').trim().slice(0, 60);
      if (text) past.push({ px: Math.round(box.right - viewportWidth), text });
    }
  }

  /*
    The tallest image, and what fraction of the screen it takes.

    A hero is meant to dominate; it is not meant to be the only thing a
    customer can see. Over the viewport height means they opened a product and
    got a picture.
  */
  let tallestImage = 0;
  for (const node of document.querySelectorAll('img')) {
    const box = node.getBoundingClientRect();
    // Carousel art scrolls past on purpose; a hero does not.
    if (inScroller(node)) continue;
    if (box.height > tallestImage) tallestImage = box.height;
  }

  /*
    The longest rendered line of text, in characters.

    Measured on leaf nodes only — a container's `textContent` is every
    descendant joined together and would report the whole screen as one line.
    Width is used to reject text that wrapped: a node whose box is much
    narrower than its content has already been broken across lines.
  */
  let longestLine = 0;
  let longestText = '';
  for (const node of document.querySelectorAll('div, span, p, h1, h2, h3')) {
    if (node.children.length > 0) continue;
    const text = (node.textContent ?? '').trim();
    if (text.length < 20) continue;
    const box = node.getBoundingClientRect();
    if (box.height > 40) continue; // wrapped over several lines
    if (text.length > longestLine) {
      longestLine = text.length;
      longestText = text.slice(0, 70);
    }
  }

  return {
    past,
    scrollsSideways: Math.max(0, document.documentElement.scrollWidth - viewportWidth),
    tallestImage: Math.round(tallestImage),
    overflowsViewport: tallestImage > viewportHeight,
    longestLine,
    longestText,
    painted: document.body.innerText.trim().length,
  };
};

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium',
  );
  process.exit(2);
}

console.log('Building with the mock layer on, so every screen has something to lay out…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1' },
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const CRASHED = /Something broke/i;

const findings = [];
const rows = [];
/** Reported rather than failed on: what to do about a long line is a layout call. */
const measures = [];

try {
  for (const size of SIZES) {
    for (const route of ROUTES) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
      });
      const page = await context.newPage();
      const crashes = [];
      page.on('pageerror', (error) => crashes.push(String(error).slice(0, 140)));

      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(2500);

      const seen = await page.evaluate(probe, {
        viewportWidth: size.width,
        viewportHeight: size.height,
      });
      const text = await page.evaluate(() => document.body.innerText);

      const where = `${size.name} ${route}`;

      if (crashes.length > 0 || CRASHED.test(text)) {
        findings.push(`${where}: crashed — ${crashes[0] ?? 'the app’s own crash screen'}`);
      }
      if (seen.painted < 20) {
        findings.push(`${where}: rendered almost nothing (${seen.painted} characters)`);
      }
      if (seen.scrollsSideways > 0) {
        findings.push(`${where}: scrolls sideways by ${seen.scrollsSideways}px`);
      }
      for (const item of seen.past.slice(0, 2)) {
        findings.push(`${where}: "${item.text}" runs ${item.px}px past the edge`);
      }
      if (seen.overflowsViewport) {
        findings.push(
          `${where}: an image is ${seen.tallestImage}px tall in a ${size.height}px viewport — ` +
            `the customer opened this screen and can see nothing else`,
        );
      }

      measures.push({
        where,
        image: seen.tallestImage,
        share: Math.round((seen.tallestImage / size.height) * 100),
        line: seen.longestLine,
        text: seen.longestText,
      });
      rows.push({
        where,
        ok:
          crashes.length === 0 &&
          !CRASHED.test(text) &&
          seen.painted >= 20 &&
          seen.scrollsSideways === 0 &&
          seen.past.length === 0 &&
          !seen.overflowsViewport,
      });
      await context.close();
    }
  }
  /*
    ── And the window that changes after the app has loaded ─────────────────

    Seven screens read `Dimensions.get('window')` at module scope: once, at
    import. Every case above opens a context already at the size it measures,
    so none of them can see a *stale* reading — they would all pass over a
    number captured correctly and then never updated.

    This is the case that can. The page loads at phone width and the window is
    then resized to a landscape iPad, which is a browser drag on the web build
    and a Split View or Stage Manager resize on a tablet. Anything sized from
    the captured constant keeps the old number and is now wrong by 800 points.
  */
  const resize = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await resize.newPage();
  await page.goto(`${BASE}/product/golden-original`, {
    waitUntil: 'networkidle',
    timeout: 45000,
  });
  await page.waitForTimeout(2500);

  const before = await page.evaluate(probe, { viewportWidth: 390, viewportHeight: 844 });
  await page.setViewportSize({ width: 1194, height: 834 });
  await page.waitForTimeout(2000);
  const after = await page.evaluate(probe, { viewportWidth: 1194, viewportHeight: 834 });

  if (after.tallestImage === before.tallestImage && before.tallestImage > 0) {
    findings.push(
      `resized from a phone to a landscape iPad: the hero is still ${after.tallestImage}px, ` +
        `the height it was given at load. Something read the window once and kept it.`,
    );
  }
  if (after.overflowsViewport) {
    findings.push(
      `resized from a phone to a landscape iPad: the hero is ${after.tallestImage}px in an ` +
        `${834}px viewport`,
    );
  }
  rows.push({
    where: 'resized mid-session, phone → landscape iPad',
    ok: after.tallestImage !== before.tallestImage && !after.overflowsViewport,
  });
  measures.push({
    where: 'after a resize',
    image: after.tallestImage,
    share: Math.round((after.tallestImage / 834) * 100),
    line: after.longestLine,
    text: after.longestText,
  });
  await resize.close();
} finally {
  await browser.close();
  server.close();
}

console.log('\nscreen');
for (const row of rows) console.log(`  ${row.ok ? '✓' : '✗'} ${row.where}`);

/*
  Printed, not failed on. Line length past about 80 characters is a legibility
  standard; what to do about it — a max width, a second column, bigger type —
  is a layout decision and belongs to whoever owns the design.
*/
const worstLines = [...measures].sort((a, b) => b.line - a.line).slice(0, 5);
console.log('\nlongest rendered lines (reported, not failed on)');
for (const measure of worstLines) {
  console.log(`  ${String(measure.line).padStart(4)} chars  ${measure.where}  “${measure.text}”`);
}

const worstImages = [...measures].sort((a, b) => b.share - a.share).slice(0, 3);
console.log('\ntallest images, as a share of the screen');
for (const measure of worstImages) {
  console.log(`  ${String(measure.share).padStart(3)}%  ${measure.image}px  ${measure.where}`);
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) wrong on a screen wider than a phone.`);
  process.exit(1);
}

console.log(
  `${ROUTES.length} screens at ${SIZES.length} tablet sizes, and every one of them fits.`,
);
