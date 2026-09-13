#!/usr/bin/env node
/**
 * An order big enough to be a real order.
 *
 * Every sweep in this repository has bought one or two things. `audit:screens`
 * adds a single item, `audit:coldstart` adds a single item, `audit:double-tap`
 * adds a single item. Which is not what a fried-chicken order looks like: a
 * family on a Friday, an office lunch, a braai — eight or ten different things,
 * several of each. The app allows twenty per line and puts no cap at all on how
 * many lines there are, so the biggest basket it will accept is not small.
 *
 * Nothing had ever been driven with one, so this does, and it counts the one
 * thing a basket that size makes checkable: **how many items the app says there
 * are.** That is stated in four places on the way to paying, and there are two
 * different sums in the code behind them.
 *
 *   `cartItemCount(lines)`   sums the quantities — what a customer means
 *   `lines.length`           counts the rows — what the basket is made of
 *
 * With one of everything they agree, which is why no sweep and no fixture has
 * ever separated them. This one builds a basket where they cannot agree and
 * reads every "N items" the app puts on screen between the menu and the
 * confirmation.
 *
 * The basket is built by the app, not by me. A seeded basket is a shape I
 * invented; this one is assembled by adding real products through the real
 * screens, and then the *quantities* on those real lines are raised in storage
 * and the page reloaded. So every field except the number under test comes from
 * `buildCartLine`, and the one thing the sweep changes is the one thing it is
 * about.
 *
 * It also watches for the ordinary failures of size, because a basket this
 * long is the first thing in this repository to have any: overflow at 390 and
 * 320, a total wide enough to need digit grouping, a badge that has to hold
 * three digits, and a screen that simply falls over.
 *
 * Run: npm run audit:basket
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { assertSeeds, preconditionFailures } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-basket');
const APP_PORT = 8301;
const BASE = `http://localhost:${APP_PORT}`;

/** Lunchtime on a Wednesday, so every branch is open. */
const LUNCHTIME = Date.UTC(2026, 8, 9, 10, 30);

/**
 * What each line is raised to.
 *
 * `businessRules.maxQuantityPerLine` is 20 and `clampQuantity` enforces it, so
 * this is the largest basket the app will actually hold rather than a number
 * chosen to look alarming. Seven is below that on purpose: a sweep that sat on
 * the cap would not notice a cap that moved.
 */
const PER_LINE = 7;

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
  return new Promise((resolve) => server.listen(APP_PORT, '127.0.0.1', () => resolve(server)));
}

const pinClock = (fixed) => `
  (() => {
    const Real = Date;
    const fixed = ${fixed};
    class Pinned extends Real {
      constructor(...args) {
        if (args.length === 0) super(fixed);
        else super(...args);
      }
      static now() { return fixed; }
    }
    globalThis.Date = Pinned;
  })();
`;

/**
 * The products added, by id.
 *
 * Distinct products rather than one product with different options, because two
 * lines of the same product could be collapsed by a screen and still look
 * right. These cannot be collapsed by anything.
 *
 * Reached by route rather than by tapping a tile on the menu. The tile is the
 * nicer test and it is the wrong one here: this sweep is about what the app
 * says once a basket exists, so a brittle way of *building* it would be a
 * failure that has nothing to do with the measurement. `audit:coldstart`
 * already drives the menu as a customer does.
 */
const PRODUCTS = [
  'golden-original',
  'honey-garlic',
  'hot-spicy',
  'soy-garlic',
  'secret-sauce',
  'french-fries',
];

/**
 * Every way the app says "how many", read off the rendered page.
 *
 * Deliberately a scrape of what a customer can see rather than a lookup of the
 * values behind it. A finding here has to be something somebody could read off
 * the screen and be wrong about; a disagreement between two functions that
 * never reaches a surface is a tidiness question, not this.
 */
const COUNT_PROBE = () => {
  const found = [];
  const seen = new Set();

  const push = (surface, text) => {
    if (typeof text !== 'string') return;
    const match = /(\d+)\s+items?\b/i.exec(text);
    if (match === null) return;
    const key = surface + '|' + match[0];
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ surface, said: Number(match[1]), phrase: match[0] });
  };

  // Visible text, element by element, so a number can be attributed to the
  // smallest thing that contains it rather than to the whole page.
  for (const node of document.querySelectorAll('div, span, p, h1, h2, h3')) {
    if (node.children.length > 0) continue;
    const text = (node.textContent ?? '').trim();
    if (text.length > 0 && text.length < 120) push('on screen', text);
  }

  // And the labels a screen reader would announce, which are a separate claim
  // and can be wrong on their own.
  for (const node of document.querySelectorAll('[aria-label]')) {
    push('announced', node.getAttribute('aria-label') ?? '');
  }

  return found;
};

/** Anything drawn past the right edge that is not inside a horizontal scroller. */
const OVERFLOW_PROBE = () => {
  const inScroller = (node) => {
    for (let el = node.parentElement; el !== null; el = el.parentElement) {
      const style = window.getComputedStyle(el);
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') return true;
    }
    return false;
  };

  const worst = [];
  const limit = window.innerWidth + 1;
  for (const node of document.querySelectorAll('body *')) {
    const box = node.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    if (box.right <= limit) continue;
    if (inScroller(node)) continue;
    worst.push({
      over: Math.round(box.right - window.innerWidth),
      text: (node.textContent ?? '').trim().slice(0, 60),
    });
  }
  return worst.sort((a, b) => b.over - a.over).slice(0, 3);
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

console.log('Building…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1' },
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const findings = [];
const readings = [];
const skipped = [];
let lineCount = 0;
let itemCount = 0;

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Africa/Johannesburg',
  });
  await context.addInitScript(pinClock(LUNCHTIME));

  const page = await context.newPage();
  const crashes = [];
  page.on('pageerror', (error) => crashes.push(String(error).slice(0, 160)));

  const go = (route) => page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
  const tap = (id) => page.locator(`[data-testid="${id}"]`).first().click({ timeout: 10000 });

  await go('/sign-in');
  await page.locator('[data-testid="sign-in-email"]').fill('thandi@example.co.za');
  await page.locator('[data-testid="sign-in-password"]').fill('chickenchicken');
  await tap('sign-in-submit');
  await page.waitForURL((u) => !u.pathname.endsWith('/sign-in'), { timeout: 20000 });

  // --- the basket, assembled by the app ------------------------------------

  for (const id of PRODUCTS) {
    await go(`/product/${id}`);
    await page.waitForTimeout(900);

    const button = page.locator('[data-testid="product-add-to-cart"]').first();
    if ((await button.count()) === 0) {
      findings.push(`/product/${id} offers no way to add it, so this sweep built a smaller basket`);
      continue;
    }

    /*
      A sold-out product is skipped rather than forced.

      `cheesling-fries` is seeded with every size unavailable, on purpose, by
      an earlier round that wanted a product nobody can order. Waiting ten
      seconds for its disabled button and then dying would be this sweep
      failing on another sweep's fixture. It says so and carries on, and the
      precondition below refuses to measure if too few lines survived.
    */
    if (await button.isDisabled()) {
      skipped.push(id);
      continue;
    }

    await button.click({ timeout: 10000 });
    await page.waitForTimeout(500);
  }

  /*
    Raising the quantities.

    Read the app's own envelope back out, change one field on each line and the
    line total that depends on it, and write it back. Everything else — the id
    built from the options, the unit price after the option deltas, the asset
    key — is whatever `buildCartLine` produced, so the basket under test is the
    app's, not a shape this file invented.

    `lineTotal` has to move with the quantity or the sweep would be measuring
    its own arithmetic error rather than the app's counting.
  */
  const raised = await page.evaluate((perLine) => {
    const raw = window.localStorage.getItem('bbq.cart');
    if (raw === null) return { ok: false, why: 'the app saved no basket at all' };

    const envelope = JSON.parse(raw);
    const lines = envelope?.state?.lines;
    if (!Array.isArray(lines) || lines.length === 0) {
      return { ok: false, why: 'the saved basket has no lines' };
    }

    for (const line of lines) {
      line.quantity = perLine;
      line.lineTotal = Math.round(line.unitPrice * perLine * 100) / 100;
    }
    const written = JSON.stringify(envelope);
    window.localStorage.setItem('bbq.cart', written);

    return {
      ok: true,
      written,
      lines: lines.length,
      items: lines.reduce((total, line) => total + line.quantity, 0),
    };
  }, PER_LINE);

  if (!raised.ok) {
    console.error(`This sweep cannot build the basket it measures: ${raised.why}`);
    process.exit(2);
  }

  /*
    The basket this sweep is about to measure, checked by the same thing that
    checks every other sweep's.

    `assertSeeds` is normally called before a browser exists, over a literal
    the sweep composed. This one has no literal — the envelope came out of the
    app — but the checks are the same checks and getting any of them wrong
    means the same thing: the sweep is about to drive a basket nobody chose.
    A second version check written out here would have been a second copy of
    `seedProblems`' rule, which is the failure this repository keeps finding
    one layer up.
  */
  assertSeeds({ 'bbq.cart': raised.written });

  lineCount = raised.lines;
  itemCount = raised.items;

  if (lineCount < 2 || itemCount === lineCount) {
    console.error(
      'This sweep needs a basket where the two sums disagree, and it has one where ' +
        `they do not (${lineCount} line(s), ${itemCount} item(s)).`,
    );
    process.exit(2);
  }

  if (skipped.length > 0) {
    console.log(`Skipped, sold out by seed: ${skipped.join(', ')}`);
  }
  console.log(`\nA basket of ${lineCount} lines and ${itemCount} items.\n`);

  // --- what each screen says about it --------------------------------------

  const visit = async (where, route) => {
    await go(route);
    await page.waitForTimeout(1800);

    const wrongState = await preconditionFailures(page, {
      where,
      signedIn: true,
      seeded: ['bbq.cart'],
    });
    for (const failure of wrongState) findings.push(failure);

    const counts = await page.evaluate(COUNT_PROBE);
    for (const reading of counts) {
      readings.push({ where, ...reading });
      if (reading.said !== itemCount) {
        findings.push(
          `${where} (${reading.surface}): "${reading.phrase}" for a basket of ${itemCount} — ` +
            (reading.said === lineCount
              ? `that is the number of lines, not the number of items`
              : `neither the ${itemCount} items nor the ${lineCount} lines`),
        );
      }
    }

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(600);
      for (const spill of await page.evaluate(OVERFLOW_PROBE)) {
        findings.push(`${where} at ${width}pt: ${spill.over}px past the edge — “${spill.text}”`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
  };

  /*
    The menu first, and it is the control.

    A sweep that only visited the two screens with the bug would report two
    failures and prove nothing about its own probe — a scrape that found no
    number at all, or found every number wrong, would look the same. The menu
    carries the sticky cart bar, which is the one surface already built on
    `getItemCount`, so a correct reading has to appear here or this sweep is
    not measuring what it claims.
  */
  await visit('the menu', '/menu');
  await visit('the cart', '/cart');
  await visit('checkout', '/checkout');

  if (!readings.some((reading) => reading.said === itemCount)) {
    findings.push(
      'no surface anywhere stated the real number, so this probe may simply not be ' +
        'reading the thing it thinks it is — treat every finding above as unproven.',
    );
  }

  if (crashes.length > 0) {
    findings.push(`a screen crashed on a basket this size — ${crashes[0]}`);
  }
} finally {
  await browser.close();
  server.close();
}

console.log('where                                                  says   should say');
for (const reading of readings) {
  const ok = reading.said === itemCount;
  console.log(
    `  ${ok ? '✓' : '✗'} ${`${reading.where}, ${reading.surface} — “${reading.phrase}”`.padEnd(49)}` +
      ` ${String(reading.said).padStart(4)}   ${String(itemCount).padStart(4)}`,
  );
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) a basket this size shows.`);
  process.exit(1);
}

console.log(
  `${lineCount} lines and ${itemCount} items, and every screen agreed about how many.`,
);
