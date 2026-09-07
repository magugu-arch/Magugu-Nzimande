import { readFileSync } from 'node:fs';
import path from 'node:path';
import { WEB, apiRoutesOnDisk, filesUnder } from './fixtures';
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

const README = readFileSync(path.join(WEB, 'README.md'), 'utf8');

/**
 * The endpoints nothing in this app is expected to call.
 *
 * Each is entered from outside: two gateways posting callbacks, and a health
 * check a load balancer polls. Listed by hand rather than pattern-matched on
 * the word "webhook", so adding one is a decision somebody writes down.
 */
const ENTERED_FROM_OUTSIDE: Record<string, string> = {
  '/api/couriers/webhook': 'the courier posts delivery updates here',
  '/api/notifications/webhook': 'the email provider posts bounces and complaints here',
  '/api/health': 'polled by whatever is watching the deployment',
};

/** Every route handler in the app, as the path a caller would use. */
function routesOnDisk(): string[] {
  // `[id]` on disk is `:id` in the document, which is how the README writes it
  // and how anybody talking about the endpoint says it out loud.
  return apiRoutesOnDisk()
    .map((route) => route.replace(/\[(\w+)\]/g, ':$1'))
    .sort();
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

/**
 * An endpoint nobody calls.
 *
 * This repository had several: the payment stack, the account system and the
 * courier adapter were each built, tested and left with no reachable surface —
 * ten days of work that a stakeholder clicking through the site could not find.
 * Each was caught by hand, by sweeping the routes against the client code, and
 * a sweep done by hand is a sweep that stops being done.
 *
 * So it is a test. A route handler that nothing in the app calls either wants
 * wiring in, or is entered from outside and belongs in the list above with a
 * reason beside it.
 */
describe('every endpoint has a caller', () => {
  /** Everything that could call an endpoint: the app, minus the endpoints. */
  const callers = filesUnder(path.join(WEB, 'src'), /\.(ts|tsx)$/)
    .filter((file) => !file.includes(path.join('app', 'api')))
    .map((file) => readFileSync(file, 'utf8'));

  /**
   * A route is called if some file holds the literal parts of its path.
   *
   * Split around the parameters rather than matched whole, because a caller
   * builds `/api/orders/${id}/advance` and the route is `/api/orders/[id]/
   * advance` — the same endpoint, sharing no single substring. The first naive
   * version of this check reported that route as dead when it is polled by the
   * journey screen on a timer.
   */
  const isCalled = (route: string): boolean => {
    const opens = route.indexOf('[');
    const closes = route.lastIndexOf(']');
    const before = opens === -1 ? route : route.slice(0, opens);
    const after = closes === -1 ? '' : route.slice(closes + 1);
    return callers.some((text) => text.includes(before) && (after === '' || text.includes(after)));
  };

  it('is called from the app, or is listed as entered from outside', () => {
    const unreachable = apiRoutesOnDisk().filter(
      (route) => !isCalled(route) && !(route in ENTERED_FROM_OUTSIDE),
    );

    expect(unreachable, 'these endpoints exist and nothing calls them').toEqual([]);
  });

  /** The list is a record of decisions, not a place to park a mistake. */
  it('does not list an endpoint that is called after all', () => {
    const listedButCalled = Object.keys(ENTERED_FROM_OUTSIDE).filter(isCalled);
    expect(listedButCalled, 'these are called; drop them from the list').toEqual([]);
  });

  /** A path in the list that no longer exists is a stale exemption. */
  it('does not list an endpoint that no longer exists', () => {
    const onDisk = new Set(apiRoutesOnDisk());
    const gone = Object.keys(ENTERED_FROM_OUTSIDE).filter((route) => !onDisk.has(route));
    expect(gone, 'these are exempted and no longer exist').toEqual([]);
  });
});
