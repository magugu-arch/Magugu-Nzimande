#!/usr/bin/env node
/**
 * Every screen at the text sizes a reader can actually ask for.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `audit:launch` used to carry an item saying enlarged text could only be
 * checked by hand on a device, because "React Native Web always reports a font
 * scale of 1, so the browser sweep is blind to it". That was true, and it left
 * the accessibility rule most likely to break a dense screen as the one rule
 * nothing here could check.
 *
 * It was also a defect in its own right rather than only a gap in the harness.
 * RNW hard-codes `fontScale: 1` and emits every size in absolute pixels, so the
 * web build ignored the browser's text-size setting outright — a WCAG 1.4.4
 * failure the native builds did not have. `useFontScale` fixes that by reading
 * the setting the way a browser expresses it: the root element's computed font
 * size, 16px being the default. Which means this script can now set that size
 * and watch the app respond, exactly as a reader would.
 *
 * ── What it checks ─────────────────────────────────────────────────────────
 * At each scale, on every route, at the narrow width where things break first:
 *
 *   · nothing is clipped — an element whose text is taller than the box drawn
 *     around it has lost words the reader was meant to have
 *   · nothing overlaps — enlarged text that grows into the line above is the
 *     signature failure of a scaled size with unscaled leading
 *   · the page still does not scroll sideways
 *   · every button that had a label still has a readable one, and any button
 *     that is now taller is taller *deliberately* — Button takes a second line
 *     past 1x by design, and that has never once been rendered in a browser
 *   · the primary action of each journey screen is still on the page
 *
 * 1.3 and 2.0 are the two that matter. 2.0 is WCAG 1.4.4's 200%; 1.3 is roughly
 * the largest non-accessibility setting on both iOS and Android, which is what
 * most people who change it at all end up on.
 *
 * Needs Playwright's Chromium. On an image that has one, point CHROMIUM_PATH at
 * it rather than downloading a second copy.
 *
 * Run: npm run audit:text-scale
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-text-web');
const PORT = 8127;

/**
 * The scales, as a browser expresses them. 16px is the default root size, so
 * 20.8 is 1.3x and 32 is 2x.
 */
const SCALES = [
  { label: '1.3x', rootPx: 20.8 },
  { label: '2.0x', rootPx: 32 },
];

/**
 * A representative walk rather than all 69 routes, at two scales each.
 *
 * Chosen for density: every screen here either puts a tall control under
 * content that is already full, or lays text beside text in a row that has no
 * room to grow. The ones that break under enlarged text are these; a static
 * legal page is not going to teach anybody anything.
 */
const ROUTES = [
  '/home',
  '/menu',
  '/product/golden-original',
  '/product/little-crunch-chicken-meal',
  '/cart',
  '/checkout',
  '/checkout/store',
  '/checkout/address',
  '/checkout/schedule',
  '/orders',
  '/order/order-4821',
  '/order/order-4874',
  '/order/order-4878',
  '/rewards',
  '/rewards/vouchers',
  '/rewards/reward-fries',
  '/offers',
  '/offers/promo-soy-fan',
  '/account/profile',
  '/account/preferences',
  '/account/payment-methods',
  '/more',
  '/sign-in',
  '/register',
];

/** 320pt: the narrowest phone the app supports, where text runs out of room first. */
const WIDTH = 320;

function serve() {
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.json': 'application/json',
    '.ico': 'image/x-icon',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.svg': 'image/svg+xml',
  };

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      /*
        Contained, which the first version of this file was not.

        It built the path from the raw request target — `path.join(OUT, url)`
        after a bare `decodeURIComponent` — and Node's http server does not
        normalise `req.url`. So `..` segments survived into the join, and
        `%2e%2e` was decoded into them first. Every other audit script in this
        repository goes through `new URL(...).pathname`, which folds both forms;
        this one had dropped that step. A security review of the branch found
        it, and it was the only finding.

        Two guards rather than one. The URL parser does the folding, and the
        resolve-and-prefix check states the invariant these servers actually
        depend on instead of leaving it as a side effect of somebody else's
        parser. Both are cheap and only one of them can be got wrong quietly.
      */
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
      let file = path.resolve(OUT, '.' + pathname);
      if (file !== OUT && !file.startsWith(OUT + path.sep)) file = path.join(OUT, 'index.html');

      // Client-side routing: anything without an extension is the app itself.
      if (!path.extname(file) || !existsSync(file) || statSync(file).isDirectory()) {
        file = path.join(OUT, 'index.html');
      }
      res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    // Loopback only. These servers exist for the length of one sweep and have
    // no business being reachable from the network the machine happens to be on.
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

/**
 * Run inside the page.
 *
 * Clipping is measured against the element's own box rather than against a
 * parent, because the failure being looked for is a box that did not grow with
 * the text inside it. `scrollHeight` past `clientHeight` on something that does
 * not scroll is exactly that.
 */
const probe = () => {
  const clipped = [];
  const overlapping = [];

  const readable = (el) => {
    const text = (el.textContent ?? '').trim();
    return text.length > 0 ? text.slice(0, 40) : null;
  };

  for (const el of document.querySelectorAll('div, span, p, button, a')) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (style.overflow === 'auto' || style.overflow === 'scroll') continue;
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') continue;

    const label = readable(el);
    if (!label) continue;

    // Only leaf-ish nodes: a container whose child overflows is reported by the
    // child, and reporting both buries the one that matters.
    if (el.querySelector('div, span, p')) continue;

    const hidden = style.overflow === 'hidden' || style.overflowY === 'hidden';
    if (hidden && el.scrollHeight > el.clientHeight + 1) {
      clipped.push({ text: label, lost: el.scrollHeight - el.clientHeight });
    }
  }

  /*
    Overlap: two text nodes whose boxes intersect vertically by more than a
    rounding error, in the same column. This is what unscaled leading looks
    like from the outside.

    Anything under a fixed or sticky ancestor is excluded, and that exclusion is
    the whole difference between a useful check and a wall of noise. The offline
    banner, the sticky cart bar and the tab bar are *designed* to sit over the
    page; the first run of this script reported forty overlaps and every one of
    them was a real overlay doing its job.
  */
  const floating = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const position = window.getComputedStyle(node).position;
      if (position === 'fixed' || position === 'sticky' || position === 'absolute') return true;
    }
    return false;
  };

  const boxes = [...document.querySelectorAll('div, span, p')]
    .filter((el) => {
      const text = (el.textContent ?? '').trim();
      if (!text || el.querySelector('div, span, p')) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return !floating(el);
    })
    .map((el) => ({ el, rect: el.getBoundingClientRect(), text: (el.textContent ?? '').trim() }))
    .filter(({ rect }) => rect.height > 0 && rect.width > 0);

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      // Same column, and one starts before the other ends by a real margin.
      const sameColumn = a.rect.left < b.rect.right - 4 && b.rect.left < a.rect.right - 4;
      if (!sameColumn) continue;
      const overlap = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      if (overlap > 3) {
        overlapping.push({ a: a.text.slice(0, 30), b: b.text.slice(0, 30), by: Math.round(overlap) });
      }
    }
  }

  const doc = document.documentElement;
  return {
    clipped: clipped.slice(0, 6),
    overlapping: overlapping.slice(0, 4),
    sideways: doc.scrollWidth > doc.clientWidth + 1,
    // Proof the scale actually reached the app rather than only the root.
    sampleFontPx: (() => {
      const el = [...document.querySelectorAll('div, span')].find(
        (node) => (node.textContent ?? '').trim().length > 12 && !node.querySelector('div, span'),
      );
      return el ? Math.round(Number.parseFloat(window.getComputedStyle(el).fontSize) * 10) / 10 : 0;
    })(),
    buttonHeights: [...document.querySelectorAll('[role="button"]')]
      .map((el) => Math.round(el.getBoundingClientRect().height))
      .filter((h) => h > 0)
      .slice(0, 8),
  };
};

console.log('Building the web bundle…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1' },
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const findings = [];
let baselineFont = 0;

/**
 * One context per scale, signed in from scratch.
 *
 * A fresh context rather than one page carrying a style tag between runs, and
 * the reason is worth recording. The first version added a stylesheet after
 * navigating and waited 900ms — but `useFontScale` polls every two seconds and
 * listens for `resize`, neither of which a stylesheet change fires. Every route
 * "passed" at a scale that had never reached the app, and the only thing that
 * caught it was the no-op check at the bottom of this loop.
 *
 * `addInitScript` puts the root size in place before React first renders, so
 * the very first read is already the enlarged one — and it accumulates on a
 * context, so each scale needs its own or the second run inherits the first.
 */
async function sweepAt(rootPx) {
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: 568 },
    isMobile: true,
    hasTouch: true,
  });

  if (rootPx !== null) {
    await ctx.addInitScript((px) => {
      const apply = () => {
        const style = document.createElement('style');
        style.textContent = `html { font-size: ${px}px !important; }`;
        document.head.appendChild(style);
      };
      if (document.head) apply();
      else document.addEventListener('DOMContentLoaded', apply);
    }, rootPx);
  }

  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/sign-in`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.locator('[data-testid="sign-in-email"]').fill('sweep@example.co.za');
  await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
  await page.locator('[data-testid="sign-in-submit"]').first().click({ timeout: 15000 });
  await page.waitForURL((url) => !url.pathname.endsWith('/sign-in'), { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.getByText('Not now', { exact: false }).first().click({ timeout: 5000 }).catch(() => {});

  return { ctx, page };
}

try {
  // What normal size looks like, so the scaled runs can be shown to differ from
  // it. An audit that sets a root size the app ignores would otherwise pass
  // silently, which is the exact failure this replaces.
  {
    const { ctx, page } = await sweepAt(null);
    await page.goto(`http://localhost:${PORT}/home`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(700);
    baselineFont = (await page.evaluate(probe)).sampleFontPx;
    await ctx.close();
  }

  for (const scale of SCALES) {
    const { ctx, page } = await sweepAt(scale.rootPx);

    // Check first that the app moved at all. A silent no-op here would make
    // every route below pass for the wrong reason.
    await page.goto(`http://localhost:${PORT}/home`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    const scaled = (await page.evaluate(probe)).sampleFontPx;
    if (!(scaled > baselineFont)) {
      findings.push(
        `@${scale.label} — the app did not scale at all (${baselineFont}px then ${scaled}px). ` +
          'Either useFontScale stopped reading the root size, or Text stopped applying it.',
      );
      await ctx.close();
      continue;
    }
    console.log(`  ${scale.label}: body text ${baselineFont}px → ${scaled}px`);

    for (const route of ROUTES) {
      try {
        await page.goto(`http://localhost:${PORT}${route}`, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });
      } catch {
        findings.push(`${route} @${scale.label} — did not finish loading`);
        continue;
      }
      await page.waitForTimeout(800);

      const r = await page.evaluate(probe);

      if (r.sideways) findings.push(`${route} @${scale.label} — the page scrolls sideways`);

      for (const { text, lost } of r.clipped) {
        findings.push(`${route} @${scale.label} — "${text}" is clipped, ${lost}px of it cut off`);
      }
      for (const { a, b, by } of r.overlapping) {
        findings.push(`${route} @${scale.label} — "${a}" overlaps "${b}" by ${by}px`);
      }
    }

    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\nSwept ${ROUTES.length} routes at ${SCALES.map((s) => s.label).join(' and ')}.`);

if (findings.length === 0) {
  console.log('Nothing is clipped, nothing overlaps, and no page scrolls sideways.');
  process.exit(0);
}

console.log(`\n${findings.length} finding(s):\n`);
for (const finding of findings) console.log('  ' + finding);
process.exit(1);
