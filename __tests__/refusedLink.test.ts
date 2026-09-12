import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { ApiRequestError, isNotFound, isRefused, notFound } from '@/services/apiClient';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

function sourceFiles(dir = 'src'): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const here = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(here);
    return /\.tsx?$/.test(entry.name) ? [here] : [];
  });
}

/*
  ───────────────────────────────────────────────────────────────────────────
  The link that is not yours.

  Order links get shared. Push notifications go stale. Ids are short enough to
  mistype and, in a URL bar, short enough to change on purpose. Every deep link
  in this app has three endings, and only one of them had ever been driven: the
  id exists and is yours.

  The other two come from the server and they are different facts —

      404   there is no such thing
      403   there is, and it is somebody else's

  — and **nothing in this app read 403 at all.** Every detail screen branched
  on `isNotFound`. So a customer opening a friend's order link met "Something
  went wrong. Check your connection and try again", with a button the server
  would refuse every single time it was pressed.

  Which is this repository's oldest rule, arriving from a new direction and for
  the first time inside the *error* state: an error state is a claim about the
  app, and that one was false. The server had behaved perfectly.

  Four findings, from `npm run audit:notyours`:

    an order that is not yours     generic error, futile retry
    a reward that is not yours     futile retry
    access withdrawn mid-session   futile retry
    a reward that failed to load   "It may have expired" — for a timeout

  The last is the one the sweep found by accident, and it is the same defect
  the product and offers screens were fixed for rounds ago: expiry is a claim
  about the rewards catalogue, and an app that could not reach the catalogue
  has no business making one. It survived because no sweep had ever refused
  this screen.
  ───────────────────────────────────────────────────────────────────────────
*/

const refusal = (status: number) => new ApiRequestError({ code: 'x', message: 'no', status });

/**
 * FIXTURE 1 — what counts as a refusal, and what deliberately does not.
 */
describe('1 — an answer that trying again cannot change', () => {
  it('reads both endings the server has for a link', () => {
    expect(isRefused(refusal(404))).toBe(true);
    expect(isRefused(refusal(403))).toBe(true);
  });

  it('leaves 401 alone, because that one the app can act on', () => {
    // `execute` refreshes and retries a 401, and a customer who really has been
    // signed out needs the sign-in door rather than "we can't find that".
    expect(isRefused(refusal(401))).toBe(false);
  });

  it('leaves a broken server alone, because trying again might work', () => {
    for (const status of [500, 502, 503, 429]) {
      expect(isRefused(refusal(status))).toBe(false);
    }
  });

  it('says nothing about a failure that never reached the server', () => {
    // A timeout and a dead host carry no status at all. Claiming "that is not
    // yours" about one of those would be the same invention in the opposite
    // direction.
    expect(isRefused(new Error('Network request failed'))).toBe(false);
    expect(isRefused(undefined)).toBe(false);
    expect(isRefused(null)).toBe(false);
  });

  it('keeps isNotFound as the narrower question, for callers that need it', () => {
    expect(isNotFound(refusal(404))).toBe(true);
    expect(isNotFound(refusal(403))).toBe(false);
    expect(isRefused(notFound('gone'))).toBe(true);
  });
});

/**
 * FIXTURE 2 — one condition, not two branches, and the reason is privacy.
 */
describe('2 — the app does not confirm what it is refused', () => {
  it('gives 403 and 404 the same answer', () => {
    // Telling somebody "that order exists but is not yours" confirms the
    // existence of a stranger's order to anybody who can type an id. The copy
    // written for the 404 covers both without it.
    expect(isRefused(refusal(403))).toBe(isRefused(refusal(404)));
  });

  it('says so where the next reader will look', () => {
    const client = read('src/services/apiClient.ts');

    expect(client).toMatch(/confirms the existence of somebody\s+\* else's order/);
    expect(client).toMatch(/401 is \*\*not\*\* here/);
  });

  it('keeps the wording that already covered both', () => {
    // "It may be too old to show, or it belonged to another account" was
    // written for the 404 branch and is exactly the 403 case. The wording
    // existed; the status routed around it.
    expect(code('src/app/order/[id]/index.tsx')).toContain('it belonged to another account');
  });
});

/**
 * FIXTURE 3 — every screen that looks something up by id reads it.
 */
describe('3 — the four detail screens', () => {
  const DETAIL = [
    'src/app/order/[id]/index.tsx',
    'src/app/product/[id].tsx',
    'src/app/offers/[id].tsx',
    'src/app/rewards/[id].tsx',
  ];

  it.each(DETAIL)('%s branches on a refusal', (file) => {
    const source = code(file);

    expect(source).toMatch(/import \{[^}]*isRefused[^}]*\} from '@\/services\/apiClient';/);
    expect(source).toMatch(/isRefused\((order|product|promotion|reward)\.error\)/);
  });

  it('leaves no screen still asking only about 404', () => {
    // Derived rather than listed: a fifth detail screen written next month
    // cannot quietly reintroduce the narrower question.
    const narrow = sourceFiles()
      .filter((file) => file.startsWith('src/app/'))
      .filter((file) => /isNotFound\((order|product|promotion|reward)\.error\)/.test(code(file)));

    expect(narrow).toEqual([]);
  });
});

/**
 * FIXTURE 4 — a button that re-asks an answered question.
 *
 * The retry is not cosmetic. It is the difference between a screen that has
 * told the customer where they stand and one that invites them to keep
 * pressing until they give up.
 */
describe('4 — no retry on an answer that will not change', () => {
  const REFUSED_BRANCHES: [string, string][] = [
    ['src/app/product/[id].tsx', "We can't find that item"],
    ['src/app/rewards/[id].tsx', "We can't find that reward"],
  ];

  it.each(REFUSED_BRANCHES)('%s offers no retry beside "%s"', (file, title) => {
    const source = code(file);
    const at = source.indexOf(title);

    expect(at).toBeGreaterThan(-1);
    // The whole `<ErrorState …/>` element that carries this title.
    const element = source.slice(source.lastIndexOf('<ErrorState', at), source.indexOf('/>', at));
    expect(element).not.toMatch(/onRetry/);
  });

  it('keeps the retry where trying again genuinely might work', () => {
    // The control this rule needs: a 500 is the app not knowing, and the next
    // attempt really might succeed.
    for (const [file] of REFUSED_BRANCHES) {
      expect(code(file)).toMatch(/<ErrorState onRetry=\{\(\) => void \w+\.refetch\(\)\} \/>/);
    }
  });

  it('still gives the customer somewhere to go instead', () => {
    expect(code('src/app/product/[id].tsx')).toContain('Back to the menu');
    expect(code('src/app/rewards/[id].tsx')).toContain('Browse the menu');
    expect(code('src/app/order/[id]/index.tsx')).toContain('See your orders');
  });
});

/**
 * FIXTURE 5 — the sweep, and the control that makes its green a measurement.
 */
describe('5 — audit:notyours', () => {
  const audit = read('scripts/audit-notyours.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:notyours']).toBe('node scripts/audit-notyours.mjs');
  });

  it('carries a case where the generic error is the right answer', () => {
    expect(audit).toMatch(/a server that is genuinely broken/);
    expect(audit).toMatch(/control: true/);
  });

  it('drives access being withdrawn after the screen has already drawn it', () => {
    // The query keeps the data it already has beside the new error, so a screen
    // rendering `data` whenever it is present would go on showing a stranger's
    // address and card. It does not — and that is a measurement, not a hope.
    expect(audit).toMatch(/grantOnce/);
    expect(audit).toMatch(/access withdrawn after the screen has drawn it/);
  });

  it('names what of theirs must never reach a screen', () => {
    for (const leak of ['their order reference', 'their name', 'their address', 'their card']) {
      expect(audit).toContain(leak);
    }
  });

  it('matches the retry by its button rather than its sentence', () => {
    // The copy could be reworded and the invitation to re-ask a refusal would
    // still be there.
    expect(audit).toMatch(/const OFFERS_A_RETRY = \/Try again\/i;/);
  });
});
