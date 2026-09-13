#!/usr/bin/env node
/**
 * Text longer than anybody drew for.
 *
 * `audit:sparse` drove data that was *missing*. `audit:basket` drove data
 * there was a *lot of*. Nothing has ever driven data that is simply **long**,
 * and the app has more room for it than anybody intended:
 *
 *   • Of every text field in the app, five cap what can be typed — the OTP
 *     box, a postal code, a product note, a support message and a rating
 *     comment. The rest do not.
 *   • The ones that do not include every part of a delivery address: street,
 *     complex, suburb, city, province, label — and the delivery instruction
 *     that goes to the driver.
 *   • `utils/validation` has `required` and `minLength`. There is no
 *     `maxLength`. The vocabulary has a floor and no ceiling.
 *
 * So a customer can type four hundred characters into "Suburb", and the app
 * will accept it, persist it, send it to the kitchen and print it on the
 * driver's screen. Whether the backend accepts it is somebody else's contract;
 * what this sweep is about is what *this* app does with it first.
 *
 * Three runs of the same journey, and the first is the point of the other two:
 *
 *   ordinary        a normal Johannesburg address — the control
 *   long but real   the longest address a real person plausibly has, about
 *                   ninety characters a line: an estate name, a unit, a floor
 *   no ceiling      four hundred characters, to show nothing stops it
 *
 * The control is what makes a finding a finding. Every screen here already
 * draws *something*, so a probe reporting overflow on the long runs means
 * nothing unless the same probe reports none on the short one.
 *
 * Run: npm run audit:long
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { preconditionFailures } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-long');
const APP_PORT = 8311;
const BASE = `http://localhost:${APP_PORT}`;

/** Lunchtime on a Wednesday, so every branch is open. */
const LUNCHTIME = Date.UTC(2026, 8, 9, 10, 30);

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
 * One unbroken run of characters, for the case that has no spaces to wrap at.
 *
 * A long address wraps; a long *word* cannot, and the two fail differently. A
 * complex name run together, a pasted URL in a delivery note, an email address
 * in the wrong box — all of them arrive as one token, and a layout that copes
 * with the first can still be pushed off the screen by the second.
 */
const unbroken = (n) => 'n'.repeat(n);

const CASES = [
  {
    name: 'ordinary',
    control: true,
    marker: 'Melville',
    form: {
      label: 'Home',
      line1: '14 Acacia Road',
      line2: 'Unit 3',
      suburb: 'Melville',
      city: 'Johannesburg',
      province: 'Gauteng',
      postalCode: '2109',
    },
    instructions: 'Gate code 1984. Ring the bell.',
  },
  {
    name: 'long but real',
    marker: 'Weltevredenpark',
    form: {
      label: 'Mum and Dad’s place in the complex behind the shopping centre',
      line1: 'Unit 47B, Third Floor, The Majestic Heights Residential Estate, 1180 Christiaan de Wet Road',
      line2: 'Entrance off the service road, second boom gate, visitor parking bay 112',
      suburb: 'Weltevredenpark Extension 76',
      city: 'Roodepoort, City of Johannesburg Metropolitan Municipality',
      province: 'Gauteng',
      postalCode: '1709',
    },
    instructions:
      'Please do not ring the bell, the baby sleeps until seven. Come through the ' +
      'pedestrian gate on the left hand side, walk past the swimming pool and the ' +
      'braai area, and we are the third door on the right with the blue mat.',
  },
  {
    name: 'no ceiling',
    marker: 'n'.repeat(40),
    form: {
      label: unbroken(120),
      line1: unbroken(400),
      line2: unbroken(200),
      suburb: unbroken(400),
      city: unbroken(200),
      province: unbroken(120),
      postalCode: '2109',
    },
    instructions: unbroken(600),
  },
];

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
      text: (node.textContent ?? '').trim().slice(0, 40),
    });
  }
  return worst.sort((a, b) => b.over - a.over).slice(0, 2);
};

/** The longest single word the app has put on the screen, and how wide it is. */
const LONGEST_WORD_PROBE = () => {
  let worst = { chars: 0, text: '' };
  for (const node of document.querySelectorAll('div, span, p, h1, h2, h3')) {
    if (node.children.length > 0) continue;
    for (const word of (node.textContent ?? '').split(/\s+/)) {
      if (word.length > worst.chars) worst = { chars: word.length, text: word.slice(0, 30) };
    }
  }
  return worst;
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
const rows = [];

try {
  for (const testCase of CASES) {
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

    // Something to deliver, so checkout is reachable at all.
    await go('/product/golden-original');
    await page.waitForTimeout(800);
    await tap('product-add-to-cart');
    await page.waitForTimeout(500);

    // --- the address, typed the way a customer types it -------------------

    await go('/checkout/address');
    await page.waitForTimeout(1200);

    const wrongState = await preconditionFailures(page, {
      where: testCase.name,
      signedIn: true,
    });
    for (const failure of wrongState) findings.push(failure);

    const addButton = page.locator('[data-testid="address-add"]').first();
    if ((await addButton.count()) > 0) await addButton.click({ timeout: 10000 });
    else await page.getByText('Add a new address', { exact: false }).first().click();
    await page.waitForTimeout(600);

    /*
      Filled by the screen's own test ids rather than by position or by label
      text. Position breaks the next time somebody reorders the form, and label
      text breaks the next time somebody rewords it — neither of which should
      be able to turn this sweep green.
    */
    const fill = async (field, value) => {
      const box = page.locator(`[data-testid="address-field-${field}"]`);
      if ((await box.count()) === 0) return false;
      await box.first().fill(value);
      return true;
    };

    const filled = {};
    for (const [field, value] of Object.entries(testCase.form)) {
      filled[field] = await fill(field, value);
    }

    const missed = Object.keys(filled).filter((field) => !filled[field]);
    if (missed.length > 0) {
      findings.push(
        `${testCase.name}: the form has no ${missed.join(', ')} field, so this case measured ` +
          `a form it did not fill.`,
      );
      await context.close();
      continue;
    }

    await page.waitForTimeout(300);
    await tap('address-save');
    await page.waitForTimeout(2000);

    /*
      Did the app take it?

      A refusal would be the good outcome and is a result either way: the point
      of the third case is that nothing refuses four hundred characters, and
      that has to be observed rather than assumed. Read out of the persisted
      address list rather than off the screen, because a screen that truncates
      would hide the length that was actually kept.
    */
    const stored = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="address-card-"]')].map((node) =>
        (node.textContent ?? '').length,
      ),
    );
    const kept = stored.length > 0 ? Math.max(...stored) : 0;

    const stillOnForm = await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="address-save"]')),
    );

    // --- the delivery note, which goes to the driver ----------------------

    const note = page.locator('[data-testid="delivery-instructions"]');
    if ((await note.count()) > 0) {
      await note.first().fill(testCase.instructions);
      await page.waitForTimeout(800);
    }

    // --- what every screen does with it -----------------------------------

    const spills = [];
    const showedIt = [];
    let longestWord = { chars: 0, text: '' };

    /*
      Measured where the text is, which took two attempts to get right.

      The first version of this navigated to each screen with a fresh page
      load, and reported zero overflows on a four-hundred-character address
      with a longest drawn word of thirteen characters — the same number as the
      control. Zero overflow because there was nothing on the screen to
      overflow: the mock backend keeps its address list in memory, so a reload
      empties it, and all three cases were measuring an empty address book.

      A real backend would have hidden that from this sweep forever. So the
      address book is measured in place, without reloading, and checkout is
      reached the way a customer reaches it — the *selected* address survives
      because `save` puts it in the fulfilment store, which persists.

      Every screen still has to prove it drew the text before its measurement
      counts. That check is the only reason the first version was caught.
    */
    const measure = async (where) => {
      if (await page.evaluate((mark) => document.body.innerText.includes(mark), testCase.marker)) {
        showedIt.push(where);
      }

      const word = await page.evaluate(LONGEST_WORD_PROBE);
      if (word.chars > longestWord.chars) longestWord = word;

      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(500);
        for (const spill of await page.evaluate(OVERFLOW_PROBE)) {
          spills.push({ where, width, ...spill });
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
    };

    await measure('the address book');

    await go('/checkout');
    await page.waitForTimeout(1500);
    const delivery = page.locator('[data-testid="fulfilment-delivery"]').first();
    if ((await delivery.count()) > 0) {
      await delivery.click({ timeout: 10000 });
      await page.waitForTimeout(1800);
    }
    await measure('checkout');

    for (const spill of spills) {
      findings.push(
        `${testCase.name} — ${spill.where} at ${spill.width}pt: ${spill.over}px past the edge ` +
          `(“${spill.text}…”)`,
      );
    }
    if (crashes.length > 0) {
      findings.push(`${testCase.name}: a screen crashed — ${crashes[0]}`);
    }
    if (showedIt.length === 0) {
      findings.push(
        `${testCase.name}: neither screen showed the address that was saved, so this case ` +
          `measured nothing. Its zero overflows are an absence, not a pass.`,
      );
    }

    rows.push({
      name: testCase.name,
      control: testCase.control === true,
      longest: Math.max(...Object.values(testCase.form).map((v) => v.length)),
      kept,
      refused: stillOnForm,
      spills: spills.length,
      worstWord: longestWord.chars,
      shown: showedIt.length,
      ok: spills.length === 0 && crashes.length === 0 && showedIt.length > 0,
    });

    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\ncase             typed   kept  refused  drawn on  overflows  longest word');
for (const row of rows) {
  console.log(
    `  ${row.ok ? '✓' : '✗'} ${row.name.padEnd(14)} ${String(row.longest).padStart(5)}` +
      ` ${String(row.kept).padStart(6)}  ${row.refused ? 'yes' : ' no'}      ` +
      `${String(row.shown)}/2      ${String(row.spills).padStart(5)}       ` +
      `${String(row.worstWord).padStart(4)}${row.control ? '   (control)' : ''}`,
  );
}

/*
  The control is the sweep's own precondition.

  Every screen here draws something at every length, so an overflow reported on
  a long case means nothing unless the same probe, on the same screens, reports
  none on an ordinary address. A control that fails means the finding is about
  the app's normal layout and this sweep is measuring the wrong thing.
*/
const control = rows.find((row) => row.control);
if (control !== undefined && !control.ok) {
  findings.unshift(
    'the ordinary address overflows too, so these findings are not about length — ' +
      'this sweep is measuring something that was already there.',
  );
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) long text does to this app.`);
  process.exit(1);
}

console.log('Every length the app accepts, it also draws inside the screen.');
