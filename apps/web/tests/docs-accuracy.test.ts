import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The website's documents, against the website.
 *
 * The Expo app in this repository has had a test like this for a while; the
 * website's four documents drifted freely, and it showed. Over one working
 * session the costing document claimed 27 API endpoints against 25, the
 * readiness table described payment as an unwired seam after it had been wired
 * through checkout, and the README listed password reset under work still to do
 * when it was built and reachable. Each was corrected by hand, which is the
 * kind of fix that lasts until the next commit.
 *
 * What is checked here is only what is exactly checkable: the endpoint list
 * against the route files, both ways. Prose about what a seam does is not
 * mechanically verifiable and is not pretended to be — but an endpoint list is
 * the part a new developer works from, and the part that goes stale first.
 */

const WEB = path.resolve(__dirname, '..');
const README = readFileSync(path.join(WEB, 'README.md'), 'utf8');

/** Every route handler in the app, as the path a caller would use. */
function routesOnDisk(): string[] {
  const base = path.join(WEB, 'src/app/api');
  const found: string[] = [];

  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full, `${prefix}/${entry}`);
      } else if (entry === 'route.ts') {
        found.push(`/api${prefix}`);
      }
    }
  };

  walk(base, '');
  // `[id]` on disk is `:id` in the document, which is how the README writes it
  // and how anybody talking about the endpoint says it out loud.
  return found.map((route) => route.replace(/\[(\w+)\]/g, ':$1')).sort();
}

/**
 * The endpoint list from the README's fenced block.
 *
 * Read from that block alone rather than from the whole file, so a passing
 * mention of an endpoint in prose is not mistaken for documenting it.
 */
function documentedRoutes(): string[] {
  const block = README.match(/### Endpoints\s*\n+```\n([\s\S]*?)```/);
  if (!block?.[1]) throw new Error('The README has no Endpoints block to check');

  return [...block[1].matchAll(/\/api\/[A-Za-z0-9/:*_-]+/g)]
    .map((match) => match[0])
    .sort();
}

/** A documented `/api/admin/*` covers every route beneath it. */
const coveredByWildcard = (route: string, documented: string[]) =>
  documented.some(
    (entry) => entry.endsWith('/*') && route.startsWith(entry.slice(0, -1)),
  );

describe('the README endpoint list', () => {
  /**
   * The direction that matters most. A route nobody documented is a route the
   * next developer finds by reading the source, which is the thing the list
   * exists to save them.
   */
  it('names every route handler in the app', () => {
    const documented = documentedRoutes();
    const missing = routesOnDisk().filter(
      (route) => !documented.includes(route) && !coveredByWildcard(route, documented),
    );

    expect(missing, `undocumented routes: ${missing.join(', ')}`).toEqual([]);
  });

  /** And the other way: an endpoint that was removed but still documented. */
  it('names no route that does not exist', () => {
    const onDisk = routesOnDisk();
    const phantom = documentedRoutes().filter(
      (route) => !route.endsWith('/*') && !onDisk.includes(route),
    );

    expect(phantom, `documented but absent: ${phantom.join(', ')}`).toEqual([]);
  });
});

describe('what the README says is outstanding', () => {
  const outstanding = README.slice(README.indexOf('## Still not built'));

  /**
   * Three things moved from "not here" to built during one session, and the
   * README kept listing them. A reader planning the remaining work would have
   * budgeted for all three.
   */
  it('does not still list work that has been done', () => {
    // Each of these is now built, so the sentence that introduced it as missing
    // must be gone. Matched on the phrasing the document used.
    for (const done of [
      /Password reset, which needs a messaging provider/i,
      /payment.{0,40}is not wired into checkout/i,
    ]) {
      expect(outstanding, `still listed as outstanding: ${done}`).not.toMatch(done);
    }
  });

  /**
   * The things that genuinely are outstanding, and are commercial rather than
   * technical. If one of these disappears from the document it is because
   * somebody decided it was done, and that decision should be deliberate.
   */
  it('still names the blockers engineering cannot clear', () => {
    for (const blocker of [/database/i, /legal|POPIA|lawyer/i, /monitoring/i]) {
      expect(outstanding).toMatch(blocker);
    }
  });
});

describe('the demo data flag', () => {
  /**
   * `DEMO_DATA` is the switch that says no commercial value in this build has
   * been approved. It comes off in the same change that replaces the numbers.
   *
   * Checked against the documents in both directions, because both are ways to
   * mislead: a build still full of invented prices whose README has stopped
   * warning about them, and a build with real prices whose README still calls
   * them demo values. The second is the one that would get a real price
   * dismissed as a placeholder.
   *
   * A first draft of this test looked for a `priceNote` field on each product.
   * There is no such field — the flag is this constant — so it counted zero
   * placeholders, took its own else branch and passed without checking
   * anything.
   */
  it('agrees with what the README says about the prices', async () => {
    const { DEMO_DATA } = (await import('@bbq/seed')) as { DEMO_DATA: boolean };

    if (DEMO_DATA) {
      expect(README, 'prices are unapproved; the README must say so').toMatch(
        /\[CONFIRM\]|demo value|unapproved/i,
      );
    } else {
      expect(
        README,
        'prices have been approved; the README must stop calling them demo values',
      ).not.toMatch(/every catalogue price is a placeholder/i);
    }
  });

  /** The flag is only meaningful if the values it describes are still there. */
  it('is still set, because no approved prices have arrived', async () => {
    const { DEMO_DATA } = (await import('@bbq/seed')) as { DEMO_DATA: boolean };
    expect(DEMO_DATA).toBe(true);
  });
});
