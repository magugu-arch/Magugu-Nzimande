import { PERSIST_VERSION } from './persist-version.mjs';

/**
 * Proving a sweep is in the state it claims, before it measures anything.
 *
 * Four sweeps seed a customer into `localStorage` and then drive an app they
 * believe is signed in. None of them ever checked. `audit:offline` was wrong
 * about that for six rounds — it stamped its envelope `version: 0`, Zustand
 * dropped every slice on load, and six signed-in routes rendered "Sign in to
 * see your orders" while the sweep went on reporting, route by route, that
 * they "said nothing about the server at all". Which was true. About itself.
 *
 * `lib/persist-version.mjs` closed the version hole. It did not close the
 * class: a seed can also fail to arrive because a key was renamed, because
 * `keepValid` rejected a field the shape no longer has, because the store's
 * `merge` changed, or because the route redirected to sign-in for a reason
 * that has nothing to do with storage. In every one of those the sweep keeps
 * running, keeps printing ticks, and measures a stranger's app.
 *
 * That is the worst failure a sweep can have, because it is invisible by
 * construction: there is no crash, no empty output, no red. The only way to
 * find it is to run everything and notice that a number looks wrong — which is
 * how it was found, once, by accident.
 *
 * So the state is asserted from two directions that fail independently:
 *
 *   1. the seed, read back out of storage — did the envelope land, and is it
 *      stamped with a version this build accepts;
 *   2. the screen — is the app showing the thing it shows somebody who is not
 *      signed in.
 *
 * Neither alone is enough. Storage cannot see a rehydration that was refused,
 * because Zustand does not write over a slice it discarded: the seeded value
 * sits there afterwards looking perfect. The screen cannot see a seed that
 * never landed on a route with no account gate. Together they cover both, and
 * either one firing is a finding — not a warning, not a note in passing. A
 * sweep that has failed its own preconditions has not produced a weaker
 * result. It has produced no result, and must say so.
 */

/**
 * Every shape the app uses to say "you are not signed in".
 *
 * `AccountRequired` defaults its `testID` to `account-required`, and all six
 * call sites override it with `<screen>-signed-out`. Both are matched, so a
 * seventh screen is covered whichever convention it picks. Matching the
 * element rather than the copy means a rewrite of the sentence does not
 * quietly switch this check off.
 */
export const SIGN_IN_WALL = '[data-testid="account-required"], [data-testid$="-signed-out"]';

/**
 * What the app persists, and which store owns it.
 *
 * Used only to name a key in a finding — a sweep says `bbq.cart` and a reader
 * should not have to go and look up whose that is.
 */
export const SEED_OWNERS = {
  'bbq.auth': 'the customer',
  'bbq.cart': 'the basket',
  'bbq.favourites': 'the favourites',
  'bbq.fulfilment': 'the chosen branch',
};

/**
 * Read the seeded envelopes and the screen in one round trip.
 *
 * `null` means the key is absent; `undefined` means it is there and is not
 * JSON, which is a different bug and deserves a different sentence.
 */
async function observe(page, keys) {
  return page.evaluate((wanted) => {
    const seeds = {};
    for (const key of wanted) {
      let raw = null;
      try {
        raw = window.localStorage.getItem(key);
      } catch {
        raw = null;
      }
      if (raw === null) {
        seeds[key] = null;
        continue;
      }
      try {
        seeds[key] = JSON.parse(raw);
      } catch {
        seeds[key] = undefined;
      }
    }
    const wall = document.querySelector(
      '[data-testid="account-required"], [data-testid$="-signed-out"]',
    );
    return {
      seeds,
      wall: wall === null ? null : (wall.getAttribute('data-testid') ?? 'account-required'),
    };
  }, keys);
}

/**
 * The seed itself, before a browser has ever seen it.
 *
 * Checked here and not only in the page, because the reading in the page
 * cannot fail for this any more and it is worth saying why. `audit:writes`
 * was re-run with its envelope deliberately stamped `version: 0` — the exact
 * bug that started all of this — and came back green, six cases and twelve
 * runs of it. Correctly: `migrateByRevalidating` landed in the same round as
 * the version, so a mismatch no longer discards the slice. Zustand calls the
 * migrate, `merge` re-validates every field, and the store writes the slice
 * straight back stamped with *this* build's number. By the time anything can
 * be read out of the page, a wrong stamp has been quietly corrected.
 *
 * So the stamp is checked where it is still the sweep's own: over the string
 * about to be injected. That catches a literal typed in place of the shared
 * constant, a `version` field left off, and an envelope with no `state` in it
 * — none of which the app would ever complain about, and all of which mean
 * the sweep is not seeding what it thinks.
 *
 * A failure here is not a finding about the app. It is a sweep that cannot
 * run, and the caller should say so and exit rather than measure.
 *
 * @param seeds      key → the JSON string the sweep is about to write
 * @param atVersion  the version those envelopes must carry
 */
export function seedProblems(seeds, { atVersion = PERSIST_VERSION } = {}) {
  const problems = [];

  for (const [key, raw] of Object.entries(seeds)) {
    const owner = SEED_OWNERS[key] ?? key;

    if (typeof raw !== 'string') {
      problems.push(`${key}: ${owner} is seeded as ${typeof raw}, and storage holds strings.`);
      continue;
    }

    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      problems.push(`${key}: ${owner} is not JSON, so the app would drop it on sight.`);
      continue;
    }

    if (envelope === null || typeof envelope !== 'object' || typeof envelope.state !== 'object') {
      problems.push(`${key}: ${owner} has no { state } in its envelope.`);
      continue;
    }
    if (envelope.version !== atVersion) {
      problems.push(
        `${key}: ${owner} is stamped version ${String(envelope.version)} and this build ` +
          `persists ${atVersion}. Import PERSIST_VERSION from lib/persist-version.mjs ` +
          `rather than writing the number here.`,
      );
    }
  }

  return problems;
}

/**
 * `seedProblems`, with the only sensible response to one.
 *
 * A sweep whose seed is malformed has nothing to measure and no result to
 * report, so it stops at exit 2 — the code this repository already uses for
 * "could not run", as distinct from 1, which means "ran, and found something".
 * Reporting these as findings would put a bug in the script under a heading
 * that reads like a bug in the app.
 */
export function assertSeeds(seeds, options) {
  const problems = seedProblems(seeds, options);
  if (problems.length === 0) return;

  console.error('This sweep cannot seed the state it measures:');
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(2);
}

/**
 * Whether this sweep is in the state it says it is.
 *
 * Returns the sentences that are wrong, or an empty array. The caller pushes
 * them into its own findings and marks the case failed: a precondition that
 * only printed a warning would leave the sweep reporting a measurement it did
 * not take, which is the thing this file exists to stop.
 *
 * @param page        a Playwright page, already navigated and settled
 * @param where       what to call this case in a finding
 * @param signedIn    assert the app accepted the session and is not gating
 * @param seeded      storage keys this case wrote and expects to have landed
 * @param atVersion   the version those envelopes should carry, or the versions
 *                    they may legitimately carry — a store that accepts a
 *                    slice writes it straight back stamped with this build's
 *                    version, so a sweep about upgrading has two right answers
 *                    and every other number is still wrong
 */
export async function preconditionFailures(
  page,
  { where, signedIn = false, seeded = [], atVersion = PERSIST_VERSION } = {},
) {
  const allowed = Array.isArray(atVersion) ? atVersion : [atVersion];
  const keys = [...new Set(signedIn ? ['bbq.auth', ...seeded] : seeded)];
  if (keys.length === 0 && !signedIn) return [];

  const { seeds, wall } = await observe(page, keys);
  const failures = [];

  for (const key of keys) {
    const envelope = seeds[key];
    const owner = SEED_OWNERS[key] ?? key;

    if (envelope === null) {
      failures.push(
        `${where}: ${key} — ${owner} was never written, so this case drove an app ` +
          `in a state nobody chose.`,
      );
      continue;
    }
    if (envelope === undefined) {
      failures.push(
        `${where}: ${key} is in storage and is not JSON, so the app could not read it.`,
      );
      continue;
    }
    /*
      Read after the app has had it, so this is not the stamp the sweep wrote.
      A store that accepts a slice writes it back under this build's number, so
      an unexpected one here means no store took it — not that the sweep typed
      the wrong literal, which is `seedProblems`' half of the job.
    */
    if (!allowed.includes(envelope.version)) {
      failures.push(
        `${where}: ${key} came back stamped version ${String(envelope.version)} where this ` +
          `build persists ${allowed.join(' or ')}. A store that took ${owner} would have ` +
          `restamped it, so nothing took it.`,
      );
    }
  }

  if (signedIn) {
    /*
      The app's own rule, from `useIsSignedOut`: `!isAuthenticated || isGuest`.
      A seed with `isGuest: true` and `isAuthenticated: true` renders the wall,
      and a sweep reading only the first flag would call that signed in.
    */
    const auth = seeds['bbq.auth'];
    const state = auth && typeof auth === 'object' ? auth.state : undefined;
    if (state !== undefined && (state?.isAuthenticated !== true || state?.isGuest === true)) {
      failures.push(
        `${where}: the seeded session is not a signed-in one ` +
          `(isAuthenticated=${String(state?.isAuthenticated)}, isGuest=${String(state?.isGuest)}).`,
      );
    }
    if (wall !== null) {
      failures.push(
        `${where}: the screen is showing ${wall}, so the session was seeded and the app ` +
          `refused it. Everything measured below this line is a signed-out app.`,
      );
    }
  }

  return failures;
}
