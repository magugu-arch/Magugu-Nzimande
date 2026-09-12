#!/usr/bin/env node
/**
 * The customer who updates the app.
 *
 * Four stores persist through `zustand/persist` and share one
 * `PERSIST_VERSION`, bumped — by design, per that file's own note — whenever a
 * persisted shape changes in a way `keepValid` cannot check for. That is the
 * ordinary consequence of shipping a change, not an exotic event.
 *
 * Zustand only calls `merge` when the stored version matches the current one.
 * On a mismatch it calls `migrate`; with none defined it **discards the slice**
 * — routing around the validation this app built for exactly this moment. So
 * the next bump signed every customer in the field out, emptied their basket,
 * forgot their favourites and dropped the branch they had chosen. Silently, on
 * first launch after an update.
 *
 * Not reasoned about: `audit:offline` seeded storage at `version: 0` for six
 * rounds, and five signed-in routes rendered "Sign in to see your orders" the
 * whole time without anyone noticing. That is this mechanism, already
 * observed, pointed at a sweep instead of a phone.
 *
 * This drives it the other way round: storage written by *last month's build*
 * — a lower version, everything else identical — loaded by this one. What
 * survives is what a customer keeps across an update.
 *
 * Run: npm run audit:upgrade
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { PERSIST_VERSION } from './lib/persist-version.mjs';
import { assertSeeds, preconditionFailures } from './lib/preconditions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-upgrade');
const PORT = 8231;

/** Written by the build before this one. */
const LAST_MONTH = PERSIST_VERSION - 1;

const envelope = (state, version) => JSON.stringify({ state, version });

const CUSTOMER = {
  user: {
    id: 'user-upgrade',
    firstName: 'Thandi',
    lastName: 'Mokoena',
    email: 'upgrade@example.co.za',
    phone: '+27821234567',
    avatarInitials: 'TM',
    isGuest: false,
    emailVerified: true,
    phoneVerified: true,
    createdAt: '2026-01-18T00:00:00.000Z',
  },
  isAuthenticated: true,
  isGuest: false,
  hasCompletedOnboarding: true,
  notificationPreferences: {
    orderUpdates: true,
    promotions: true,
    rewards: true,
    newProducts: false,
    channelPush: true,
    channelEmail: true,
    channelSms: false,
  },
  preferences: { defaultFulfilment: 'delivery', marketingConsent: false, preferMildFirst: false },
};

/*
  Deliberately not the demo set.

  `favouritesStore` seeds `['honey-garlic', 'cheesling-fries', 'korean-rice-bowl']`
  as its *initial* state in a mock build, so a run that discards the persisted
  slice still renders hearts — and the first version of this sweep counted two
  of them in both arms and could not fail. These four are chosen from the
  catalogue and share nothing with that set, so the count separates "kept what
  the customer saved" from "fell back to the demo".
*/
const SEEDED_BY_THE_APP = ['honey-garlic', 'cheesling-fries', 'korean-rice-bowl'];
const FAVOURITES = {
  productIds: ['golden-original', 'soy-garlic', 'hot-spicy', 'boneless'],
};

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
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(OUT, pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(OUT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed.');
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
  for (const written of [PERSIST_VERSION, LAST_MONTH]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      timezoneId: 'Africa/Johannesburg',
    });
    await context.addInitScript(
      ({ auth, favourites }) => {
        try {
          window.localStorage.setItem('bbq.auth', auth);
          window.localStorage.setItem('bbq.favourites', favourites);
        } catch {
          // A context that refuses storage is a browser problem, not an app one.
        }
      },
      { auth: envelope(CUSTOMER, written), favourites: envelope(FAVOURITES, written) },
    );

    /*
      Stamped with this arm's version, which for the older arm is deliberately
      not the current one — so the assertion is that each arm seeded what it
      meant to, not that both seeded the same thing.
    */
    assertSeeds(
      { 'bbq.auth': envelope(CUSTOMER, written), 'bbq.favourites': envelope(FAVOURITES, written) },
      { atVersion: written },
    );

    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/account/profile`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    await page.waitForTimeout(3000);

    /*
      Not `signedIn` — that is this sweep's whole question, and a precondition
      that asserted the answer would turn the LAST_MONTH arm green by fiat.

      What it does assert is narrower and still worth having: the envelopes are
      there and readable. `addInitScript` failing silently, or a renamed key,
      would leave both arms measuring a browser nobody seeded, and both would
      agree — which is the shape this sweep reads as "an update changed
      nothing". Two versions are legitimate here and no third is: a slice the
      store accepts is written straight back stamped with this build's number,
      so the LAST_MONTH arm ends at PERSIST_VERSION when the migrate works and
      at LAST_MONTH when it does not.
    */
    const wrongState = await preconditionFailures(page, {
      where: `written by version ${written}`,
      seeded: ['bbq.auth', 'bbq.favourites'],
      atVersion: [written, PERSIST_VERSION],
    });
    for (const failure of wrongState) findings.push(failure);

    const profile = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');

    /*
      Read out of the store rather than off the screen.

      The first version of this looked for the customer's first name in
      `innerText` and reported both runs as signed out. The profile screen puts
      the name in an input *value*, which `innerText` does not carry — so the
      detector was measuring the DOM's idea of text while the screen said
      "Member since Sun, 18 Jan" a line above. Rehydration is a fact about the
      store, so the store is what to ask.
    */
    const survived = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('bbq.auth');
        const state = raw ? JSON.parse(raw).state : null;
        return {
          authenticated: Boolean(state?.isAuthenticated),
          userId: state?.user?.id ?? null,
        };
      } catch {
        return { authenticated: false, userId: null };
      }
    });

    // Both halves: the flag, and the person it is about. A rehydration that
    // kept the flag and lost the profile would be worse than being signed out.
    const signedIn =
      survived.authenticated &&
      survived.userId === 'user-upgrade' &&
      !/Sign in to|Create an account/i.test(profile);

    /*
      Counted off the menu, not out of storage.

      Two ways this measurement could not fail, and both were live at once.

      It first read `bbq.favourites` back from `localStorage` — but a store that
      discards its persisted slice does not necessarily write over it, so the
      old value sits there untouched and the count is the one that went in.

      And `favouritesStore` seeds `['honey-garlic', 'cheesling-fries',
      'korean-rice-bowl']` as its *initial* state in a mock build, so even a
      discarded slice renders hearts. The seeded favourites above are chosen to
      share nothing with that set, so the labels separate "kept what the
      customer saved" from "fell back to the demo".

      A filled heart is rendered from `useFavouritesStore`, so reading the
      buttons asks the store what it actually rehydrated.
    */
    await page
      .goto(`http://localhost:${PORT}/menu`, { waitUntil: 'networkidle', timeout: 45000 })
      .catch(() => {});
    await page.waitForTimeout(3000);
    const hearted = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll('[aria-label^="Remove "][aria-label$=" from favourites"]'),
      ).map((node) =>
        (node.getAttribute('aria-label') ?? '')
          .replace(/^Remove /, '')
          .replace(/ from favourites$/, ''),
      ),
    );

    const label = written === PERSIST_VERSION ? 'this build' : `an older build (v${written})`;

    if (!signedIn) {
      findings.push(
        `storage written by ${label}: the customer was signed out on first launch — ` +
          `the profile screen reads: ${profile.slice(0, 110)}`,
      );
    }
    /*
      The menu paginates, so the count is a floor rather than an equality: what
      matters is that the customer's own favourites came back rather than the
      app's demo set. Zero of theirs, or any of the demo ones, means the slice
      was dropped and the initial state took over.
    */
    /*
      Names on screen, ids in storage, so they are compared through a slug.

      The first attempt asked whether a demo *id* contained a rendered *name* —
      backwards, and dead: `'honey-garlic'.includes('honey garlic chicken')` is
      false, so the check never fired even on the run where every saved
      favourite had been dropped. Third time on this one measurement, and each
      version failed the same way: it could not distinguish the outcome it
      existed to report.
    */
    const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const theirs = hearted.filter((name) =>
      FAVOURITES.productIds.some((id) => slug(name).startsWith(id)),
    );
    const demo = hearted.filter((name) =>
      SEEDED_BY_THE_APP.some((id) => slug(name).startsWith(id)),
    );

    rows.push({ label, signedIn, theirs: theirs.length });

    if (theirs.length === 0) {
      findings.push(
        `storage written by ${label}: none of the customer's own favourites survived — ` +
          `the store fell back to its initial state`,
      );
    }
    if (demo.length > 0) {
      findings.push(
        `storage written by ${label}: the app's demo favourites are on screen (${demo.join(', ')}), ` +
          `so what the customer saved was dropped`,
      );
    }

    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\nstorage written by          still signed in   their favourites');
for (const row of rows) {
  console.log(
    `  ${row.label.padEnd(26)}${(row.signedIn ? 'yes' : 'NO').padEnd(18)}${row.theirs} of ${FAVOURITES.productIds.length}`,
  );
}

console.log();
if (findings.length > 0) {
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(`\n${findings.length} thing(s) an update took away from the customer.`);
  process.exit(1);
}

console.log('An update keeps the customer signed in, and keeps what they saved.');
