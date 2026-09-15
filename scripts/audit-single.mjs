#!/usr/bin/env node
/**
 * The file we actually hand over, driven the way it is actually delivered.
 *
 * Thirty-two sweeps build this app and every one of them builds it the same
 * way: `expo export --platform web` into a directory, served by a small Node
 * server each script writes for itself. That server has a fallback — any path
 * it does not recognise gets `index.html` — because otherwise deep links would
 * not resolve.
 *
 * Nobody outside this repository is ever served by that.
 *
 * What leaves this repository is one file, `bbq-chicken-app.html`, produced by
 * `bundle-single-file.mjs`, published as an artifact and attached to a message.
 * Thirty-nine versions of it have gone to the client. It has been opened by
 * exactly one thing: a person, by eye, who would notice a blank page and would
 * not notice a font that quietly fell back or an image requested over the wire
 * from a host that has no such file.
 *
 * Two differences make the directory build a poor stand-in, and both of them
 * are differences the bundler *knows about* and writes code for:
 *
 *   1. **Nothing may be fetched.** Every asset is meant to be a `data:` URI
 *      inside the document. The bundler prints `Inlined 135/145 assets` and
 *      exits 0 whichever those numbers are — an asset it failed to rewrite
 *      stays a path like `/assets/assets/brand/lockup@2x.png`, which the
 *      sweeps' own fallback servers answer with `index.html` and a real host
 *      answers with 404. In the directory build a missed asset is invisible
 *      by construction: the server hides it.
 *
 *      (135 of 145 is the healthy number, not a shortfall: the other ten are
 *      `@2x/@3x/@4x` density files Metro emits and the web runtime never
 *      names, so there is no literal for the bundler to replace. Checked
 *      rather than argued — driven at devicePixelRatio 1, 2 and 3 the page
 *      fetches nothing and every `<img>` carries its own bytes.)
 *
 *   2. **The document is not at `/`.** It is served at `/artifact/<id>`, or
 *      off a disk at `file:///…`. Expo Router reads `location.pathname` to
 *      choose the first screen, so at any of those paths it matches nothing
 *      and renders the catch-all: "This page has moved on. It may have been
 *      taken off the menu." The bundler injects a shim to prevent exactly
 *      that, and the shim has never been run at a path that is not `/`.
 *
 * So this sweep serves the single file the way a single-document host serves
 * it — **one document, and 404 for everything else, no fallback** — and asks
 * the questions the directory build cannot be asked:
 *
 *   • does anything leave the page at all?
 *   • do the pictures have pixels, or is that an alt-text-shaped hole?
 *   • which screen does it open on?
 *   • does the app still run, or did it only paint?
 *
 * Three deliveries, because the bundler's own doc names three and behaves
 * differently in each:
 *
 *   1. hosted at a deep path  — the published artifact; shim rewrites the path
 *   2. hosted at the root     — the control; shim has nothing to rewrite
 *   3. opened off a disk      — `file://`, where the browser refuses the
 *                               rewrite and the shim falls back to pressing
 *                               the catch-all's own "Back to home"
 *
 * Case 2 is what makes 1 and 3 mean anything: if the app failed to start for
 * some reason that has nothing to do with where it was served, all three go
 * red together and the finding is not about delivery.
 *
 * Run: npm run audit:single
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SINGLE = path.join(root, '.preview-web', 'bbq-chicken-app.html');
const PORT = 8361;

/**
 * The path the published artifact is actually served at.
 *
 * A real id rather than `/somewhere`, because the shape matters: two segments,
 * no trailing slash, and a second segment that looks enough like a route
 * parameter to be worth checking the router does not try to match it.
 */
const HOSTED_AT = '/artifact/UqZAS73xJEkuDgyb5iD6VZ';

const LUNCHTIME = Date.UTC(2026, 8, 9, 10, 30);

/**
 * What the app must be showing once it has started.
 *
 * `onboarding-next` is the welcome carousel's button — the first screen a
 * customer with empty storage is meant to meet. `not-found-screen` is the
 * catch-all, and is the specific wrong answer this sweep exists to catch.
 */
const WELCOME = '[data-testid="onboarding-next"]';
const CATCH_ALL = '[data-testid="not-found-screen"]';

if (!existsSync(SINGLE)) {
  console.error(
    `No single-file build at ${path.relative(root, SINGLE)}.\n  npm run preview:single`,
  );
  process.exit(2);
}

/**
 * Refuse to measure a file older than the code it claims to be.
 *
 * The same trap `bundle-single-file.mjs` guards against, one step later: a
 * sweep that greens a stale document has reported on a build nobody has.
 */
function newestSourceTime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestSourceTime(full) : statSync(full).mtimeMs);
  }
  return newest;
}

if (statSync(SINGLE).mtimeMs < newestSourceTime(path.join(root, 'src'))) {
  console.error(
    `${path.relative(root, SINGLE)} is older than src/, so it is not the current app.\n` +
      '  npm run preview:single',
  );
  process.exit(2);
}

const documentBytes = readFileSync(SINGLE);

/*
  ───────────────────────────────────────────────────────────────────────────
  Half one: every asset the export emitted, checked against the document
  before a browser is involved.

  The runtime half below watches what the page fetches, and on its own it
  proves less than it looks like it proves: it can only speak for the screens
  it opens. An asset missed on the rewards screen is not requested by a sweep
  that stops at onboarding, so `fetched: 0` would print and mean "nothing on
  this screen" while reading like "nothing in the file". A counterfactual
  caught that — one data URI put back to a path, and this sweep stayed green.

  So the file is also read as a file. For every asset `expo export` wrote,
  exactly one of two things must be true:

    • the bundler replaced its path with a data URI — it is inside the
      document and there is nothing left to fetch; or
    • the bundle never mentioned it — an emitted file nothing references,
      which on this build is the ten `@2x/@3x/@4x` density variants Metro
      writes out and the web runtime never asks for. Verified rather than
      assumed: driven at devicePixelRatio 1, 2 and 3, the page fetched
      nothing and every `<img>` was a data URI.

  A path still sitting in the document that *names a file the export wrote* is
  the third case, and is the bug: the bundler prints `Inlined 135/145` and
  exits 0 whatever those numbers are.
  ───────────────────────────────────────────────────────────────────────────
*/
const exportedAssets = path.join(root, '.preview-web', 'assets');
if (!existsSync(exportedAssets)) {
  console.error(
    `The export beside ${path.basename(SINGLE)} is gone, so which assets should have been\n` +
      'inlined cannot be known and half this sweep cannot run. A green from the other half\n' +
      'would read like a whole answer.\n  npm run preview:single',
  );
  process.exit(2);
}

function emitted(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? emitted(full) : [full];
  });
}

const documentText = documentBytes.toString('utf8');
const notInlined = emitted(exportedAssets)
  .map((file) => '/' + path.relative(path.join(root, '.preview-web'), file).split(path.sep).join('/'))
  .filter((key) => documentText.includes(key));

/**
 * A single-document host, and nothing more.
 *
 * **No fallback.** This is the whole difference from the other thirty-two
 * sweeps: they answer any unknown path with `index.html`, which is right for a
 * directory build with deep links and which turns a missed asset into a silent
 * success. Here an un-inlined asset gets the 404 a real host would give it, and
 * Playwright sees the request.
 */
function serve() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (pathname === HOSTED_AT || pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(documentBytes);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('no such file');
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
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

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium',
  );
  process.exit(2);
}

const DELIVERIES = [
  {
    name: 'published at a deep path',
    url: `http://localhost:${PORT}${HOSTED_AT}`,
    note: 'the artifact host',
    expect: 'welcome',
  },
  {
    name: 'served at the root',
    url: `http://localhost:${PORT}/`,
    note: 'the control',
    expect: 'welcome',
  },
  {
    /*
      The one delivery that legitimately does not open on welcome.

      From `file://` the browser forbids rewriting the path, so the shim's
      other half presses the catch-all's own "Back to home" — and lands on
      home, past onboarding, not on the welcome carousel. That is a reasonable
      recovery and the sweep should not call it a failure; what it should
      require is that the recovery happens at all.
    */
    name: 'opened off a disk',
    url: pathToFileURL(SINGLE).href,
    note: 'double-clicked, no server',
    expect: 'somewhere real',
  },
];

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const findings = [];
const rows = [];

/**
 * Open one delivery and report everything that left the page while it did.
 */
async function drive({ name, url, expect }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Africa/Johannesburg',
  });
  await context.addInitScript(pinClock(LUNCHTIME));

  const page = await context.newPage();
  const fetched = [];
  const crashes = [];
  const refused = [];

  page.on('request', (request) => {
    /*
      The document itself is the one request a self-contained file may make.

      `data:` URIs do not produce requests at all, so the count below is a
      direct reading of how much of this file is not actually in it. A favicon
      is the browser's idea rather than the app's — the bundler strips the
      <link> and Chromium asks anyway — so it is listed and not counted.
    */
    const requested = request.url();
    if (request.resourceType() === 'document') return;
    if (/\/favicon\.ico$/.test(requested)) return;
    fetched.push(`${request.resourceType()} ${requested.slice(0, 120)}`);
  });
  page.on('requestfailed', (request) => refused.push(request.url().slice(0, 120)));
  page.on('pageerror', (error) => crashes.push(String(error).slice(0, 200)));

  await page.goto(url, { waitUntil: 'load', timeout: 45000 });

  /*
    Wait for either answer rather than a fixed pause.

    The wrong screen is a screen, so a timeout here would be a third outcome
    and this sweep would not be able to tell "started on the catch-all" from
    "never started". Racing the two selectors means the sweep always knows
    which of the three it got.
  */
  /*
    Where the app came to rest, watched rather than waited for.

    The catch-all is allowed to be a moment and not a destination. Off a disk
    the browser refuses to rewrite the path, so the router genuinely matches
    nothing, the catch-all genuinely draws, and the shim's second half presses
    its "Back to home" about a tenth of a second later.

    This was first written as a race — `waitForSelector('welcome, catch-all')`
    and then judge whichever arrived. It reported "past it, to home" on one run
    and "nothing at all" on the next, from the same file, because whether the
    twenty-second wait happened to open inside that tenth of a second is
    chance. A sweep that changes its mind when you look again teaches everybody
    to look again, which costs more than the sweep is worth.

    Polling was the first correction and it was not enough on its own: the
    whole episode can open and close inside one interval, so a second run came
    back "nothing at all" from a page that was sitting on home with thirty-three
    photographs on it. Requiring the sweep to *witness* the flash is the same
    race written smaller.

    So the flash is not part of the question. Each delivery is polled for the
    thing it is actually meant to reach, and nothing else counts as arriving.
  */
  let landed = 'nothing at all';
  let settled = 0;
  for (let waited = 0; waited < 20000; waited += 150) {
    const now = await page.evaluate(
      ([welcome, catchAll]) => ({
        welcome: document.querySelector(welcome) !== null,
        catchAll: document.querySelector(catchAll) !== null,
        text: document.body.innerText.trim().length,
      }),
      [WELCOME, CATCH_ALL],
    );

    if (now.welcome) {
      landed = 'welcome';
      break;
    }
    if (expect === 'somewhere real') {
      /*
        A real screen, held across two readings 150ms apart. One reading would
        accept the splash on its way past — it draws a line of copy and no
        catch-all, and is a state the app passes through rather than a place it
        arrives at.
      */
      settled = !now.catchAll && now.text > 40 ? settled + 1 : 0;
      if (settled >= 2) {
        landed = 'past it, to home';
        break;
      }
    }
    if (waited + 150 >= 20000 && now.catchAll) landed = 'the catch-all, and stayed there';
    await page.waitForTimeout(150);
  }

  /*
    Pictures, asked for their pixels.

    An <img> whose src is a corrupt data URI lays out at its styled size and
    draws nothing, so the page looks structurally perfect and is missing every
    photograph. `naturalWidth` is zero only when the bytes did not decode.
  */
  const pictures = await page.evaluate(() => {
    const images = [...document.querySelectorAll('img')];
    return {
      total: images.length,
      blank: images.filter((img) => img.complete && img.naturalWidth === 0).length,
      remote: images.filter((img) => !img.currentSrc.startsWith('data:') && img.currentSrc !== '')
        .length,
    };
  });

  /*
    Proof that it runs, not only that it painted — and the first press of the
    first button in the app.

    An earlier draft of this compared `document.body.innerText` before and
    after pressing Next, which was the wrong probe twice over: the photograph
    is not text, so a working carousel looked broken, and the words under it
    never changed, so a broken one would have looked the same. What the press
    must do is *advance the slide*, and a slide is four things that have to
    agree — the picture, the headline, the dots and the button's own label.

    So the carousel is driven to the end and the headline is read at each step.
    That is what caught the bug this sweep was written on the way to: `index`
    was fed only by `onMomentumScrollEnd`, which react-native-web does not fire
    for a programmatic scroll, so the headline never moved off slide one, Next
    scrolled to the same offset forever, and "Get started" — the only way the
    button can finish onboarding — never appeared.
  */
  const slides = [];
  let finished = false;
  if (landed === 'welcome') {
    const panel = () =>
      page.evaluate((selector) => {
        const button = document.querySelector(selector);
        const scroller = [...document.querySelectorAll('*')].find(
          (element) => element.scrollWidth > element.clientWidth + 50,
        );
        const lines = document.body.innerText.split('\n').filter((line) => line.trim());
        return {
          headline: lines[1] ?? '',
          label: (button?.textContent ?? '').trim(),
          offset: scroller?.scrollLeft ?? null,
        };
      }, WELCOME);

    slides.push(await panel());
    /*
      One press more than there are slides. The last one is on "Get started"
      and must leave the screen, which is the half of this that a customer
      cannot work around: Skip is a 27x19 link in the corner, and a carousel
      whose own button cannot finish is a dead end for anybody who does not
      spot it.
    */
    for (let press = 0; press < 3; press += 1) {
      if ((await page.$(WELCOME)) === null) break;
      await page.click(WELCOME);
      await page.waitForTimeout(1100);
      if ((await page.$(WELCOME)) === null) {
        finished = true;
        break;
      }
      slides.push(await panel());
    }
  }

  await context.close();
  return { name, url, fetched, crashes, refused, landed, pictures, slides, finished };
}

if (notInlined.length > 0) {
  findings.push(
    `${notInlined.length} asset(s) the export wrote are still paths in the document rather ` +
      `than their own bytes — ${notInlined[0]}${
        notInlined.length > 1 ? `, +${notInlined.length - 1} more` : ''
      }. A single-document host answers those with 404. Whether a customer sees the hole ` +
      `depends on which screen they open, which is why this is read off the file and not ` +
      `only off the wire.`,
  );
}

const server = await serve();
try {
  for (const delivery of DELIVERIES) {
    const result = await drive(delivery);
    rows.push({ ...result, note: delivery.note });

    if (result.fetched.length > 0) {
      const unique = [...new Set(result.fetched)];
      findings.push(
        `${result.name}: the file asked the network for ${unique.length} thing(s) it is supposed ` +
          `to contain — ${unique[0]}${unique.length > 1 ? `, +${unique.length - 1} more` : ''}. ` +
          `A single-document host answers those with 404, so they are missing from what the ` +
          `client sees, and the directory-build sweeps cannot see it because their servers ` +
          `answer every unknown path with index.html.`,
      );
    }
    /*
      An error the app walked away from is not the same as one that stopped it.

      Off a disk the document has a `null` origin and the History API refuses
      every call on it. The shim catches its own; the router then makes its own
      `replaceState` on the way to home and that one throws uncaught. React
      Navigation falls back to in-memory navigation, the customer arrives, and
      nothing is wrong except that the platform said no in public.

      Exempted narrowly and on purpose — this delivery, this API, and only when
      the app actually got somewhere — because "ignore errors on file://" would
      make the third row of this sweep unable to report anything at all.
    */
    const stopped = result.crashes.filter(
      (crash) =>
        !(
          delivery.expect === 'somewhere real' &&
          /SecurityError/.test(crash) &&
          /replaceState|pushState|History/.test(crash) &&
          result.landed === 'past it, to home'
        ),
    );
    rows[rows.length - 1].stopped = stopped;
    if (stopped.length > 0) {
      findings.push(`${result.name}: threw on open — ${stopped[0]}`);
    }
    if (result.landed === 'the catch-all, and stayed there') {
      findings.push(
        `${result.name}: sits on "This page has moved on". The router resolved the document's ` +
          `own path, matched no route, and the start-at-root shim in bundle-single-file.mjs ` +
          `neither rewrote the path nor recovered from it.`,
      );
    }
    if (result.landed === 'nothing at all') {
      findings.push(
        `${result.name}: drew neither the welcome screen nor the catch-all within 20s, so the ` +
          `app did not start.`,
      );
    }
    if (delivery.expect === 'welcome' && !result.landed.startsWith('welcome')) {
      findings.push(
        `${result.name}: should open on the welcome carousel and opened on ${result.landed}.`,
      );
    }

    /*
      The carousel, judged on whether it is one.

      Three separate ways it can be broken and each gets its own sentence,
      because "onboarding is broken" is not something anybody can act on.
    */
    if (result.slides.length > 0) {
      const headlines = result.slides.map((slide) => slide.headline);
      const offsets = result.slides.map((slide) => slide.offset);

      if (new Set(headlines).size < headlines.length) {
        findings.push(
          `${result.name}: pressing Next moved the picture and left the words behind — the ` +
            `headline read "${headlines[0]}" on ${headlines.length} consecutive slides. The ` +
            `customer is reading one slide and looking at another.`,
        );
      }
      if (new Set(offsets).size < offsets.length) {
        findings.push(
          `${result.name}: the carousel stopped moving at offset ${offsets[offsets.length - 1]} ` +
            `and further presses of Next did nothing.`,
        );
      }
      if (!result.finished) {
        findings.push(
          `${result.name}: Next never became "Get started" — last label "${
            result.slides[result.slides.length - 1]?.label ?? '?'
          }" — so the app's first screen cannot be finished with its own button. Skip is the ` +
            `only way out, and it is a 27x19 link in the corner.`,
        );
      }
    }
    if (result.pictures.blank > 0) {
      findings.push(
        `${result.name}: ${result.pictures.blank} of ${result.pictures.total} pictures decoded ` +
          `to nothing. The data URI is there and its bytes are not an image.`,
      );
    }
    if (result.pictures.remote > 0) {
      findings.push(
        `${result.name}: ${result.pictures.remote} picture(s) are still pointing at a URL ` +
          `rather than carrying their own bytes.`,
      );
    }
  }
} finally {
  await browser.close();
  server.close();
}

/*
  The header states what was measured, never what was hoped.

  An earlier draft printed "every asset is either inside it or unreferenced"
  unconditionally, so a run that went on to report a missed asset opened by
  denying it. A summary that contradicts the findings below it is worse than
  no summary: the eye reads the first line.
*/
console.log(
  `\n${(statSync(SINGLE).size / 1e6).toFixed(1)} MB, one document. ${
    notInlined.length === 0
      ? 'Every asset the export wrote is either inside it or unreferenced.'
      : `${notInlined.length} asset(s) the export wrote are still paths in it.`
  }\n`,
);
console.log('delivery                     opens on                    slides  pictures  fetched');
for (const row of rows) {
  const clean =
    row.fetched.length === 0 &&
    row.stopped.length === 0 &&
    !row.landed.startsWith('the catch-all') &&
    row.landed !== 'nothing at all' &&
    row.pictures.blank === 0 &&
    row.pictures.remote === 0 &&
    (row.slides.length === 0 || row.finished);
  const carousel = row.slides.length === 0 ? '—' : `${row.slides.length}${row.finished ? '✓' : '✗'}`;
  console.log(
    `  ${clean ? '✓' : '✗'} ${row.name.padEnd(26)} ${row.landed.padEnd(27)} ` +
      `${carousel.padEnd(7)} ` +
      `${`${row.pictures.total - row.pictures.blank}/${row.pictures.total}`.padEnd(9)} ` +
      `${row.fetched.length}   (${row.note})`,
  );
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) wrong with the file we hand over.`);
  process.exit(1);
}

console.log(
  `The published file starts, runs and draws itself with nothing fetched, at a deep path, at ` +
    `the root and off a disk.`,
);
