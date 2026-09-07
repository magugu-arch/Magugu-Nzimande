import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB, filesUnder, routeHandlers } from './fixtures';

/**
 * Who may call what, checked against the routes rather than remembered.
 *
 * Every write behind the console is guarded and every account endpoint is
 * scoped to the session that called it. That is true today; it is true because
 * somebody remembered each time, and the failure mode is a new route added in a
 * hurry with the guard left off. That route works perfectly in testing — it is
 * the *absence* of a refusal that is the bug, and nothing about using the
 * feature reveals it.
 *
 * So it is a test. It is deliberately structural rather than behavioural: the
 * suites next door drive the refusals through the real handlers and prove they
 * work, and this proves that every handler has one at all. Both halves are
 * needed — a guard that is called but broken passes here, and a guard that is
 * missing entirely passes there by never being exercised.
 */

const routesUnder = (folder: string): string[] =>
  filesUnder(path.join(WEB, 'src/app/api', folder), /route\.ts$/).map((file) =>
    path.relative(WEB, file),
  );

/**
 * The endpoints a person with no session must be able to reach.
 *
 * Each is how somebody *gets* a session, or how they recover one they cannot
 * use. Listed by hand with the reason beside it, so adding to this list is a
 * decision somebody writes down rather than a guard quietly omitted.
 */
const OPEN_BY_DESIGN: Record<string, string> = {
  'src/app/api/admin/session/route.ts': 'the console sign-in itself',
  'src/app/api/account/route.ts': 'registration, which creates the first session',
  'src/app/api/account/session/route.ts': 'customer sign-in, sign-out and whoami',
  'src/app/api/account/reset/route.ts': 'password reset, for somebody who cannot sign in',
};

describe('the console', () => {
  const routes = routesUnder('admin');

  it('has routes to check, so a passing run means something', () => {
    expect(routes.length).toBeGreaterThan(4);
  });

  it('refuses anyone who is not an operator, on every handler', () => {
    const unguarded = routes
      .filter((route) => !(route in OPEN_BY_DESIGN))
      .flatMap((route) =>
        routeHandlers(route)
          .filter((handler) => !handler.body.includes('refuseUnlessOperator'))
          .map((handler) => `${handler.verb} ${route}`),
      );

    expect(unguarded, 'these console handlers take no operator check').toEqual([]);
  });
});

describe('a customer’s own records', () => {
  const routes = routesUnder('account');

  it('has routes to check', () => {
    expect(routes.length).toBeGreaterThan(3);
  });

  /**
   * The rule with the sharpest edge. An order-history endpoint that takes whose
   * history to return as a parameter returns anybody's, and the failure is
   * invisible until it is a headline.
   */
  it('is reached only through the session, on every handler', () => {
    const unguarded = routes
      .filter((route) => !(route in OPEN_BY_DESIGN))
      .flatMap((route) =>
        routeHandlers(route)
          .filter((handler) => !handler.body.includes('refuseUnlessSignedIn'))
          .map((handler) => `${handler.verb} ${route}`),
      );

    expect(unguarded, 'these account handlers take no session check').toEqual([]);
  });

  /** And none of them takes an account id from the caller. */
  it('never reads whose records to return from the request', () => {
    const offenders = routes.flatMap((route) =>
      routeHandlers(route)
        .filter((handler) => /searchParams\.get\(\s*['"]accountId/.test(handler.body))
        .map((handler) => `${handler.verb} ${route}`),
    );

    expect(offenders, 'these read an account id from the caller').toEqual([]);
  });
});

describe('the list of endpoints open by design', () => {
  /** A stale exemption is a guard nobody will notice is missing. */
  it('names only routes that exist', () => {
    const onDisk = new Set([...routesUnder('admin'), ...routesUnder('account')]);
    const gone = Object.keys(OPEN_BY_DESIGN).filter((route) => !onDisk.has(route));

    expect(gone, 'these are exempted and no longer exist').toEqual([]);
  });

  /**
   * And each one really is open. If a route on this list grows a guard, the
   * exemption is the thing that is now wrong.
   */
  it('names only routes that are actually open', () => {
    const guarded = Object.keys(OPEN_BY_DESIGN).filter((route) =>
      routeHandlers(route).every(
        (handler) =>
          handler.body.includes('refuseUnlessOperator') ||
          handler.body.includes('refuseUnlessSignedIn'),
      ),
    );

    expect(guarded, 'these are guarded; drop them from the list').toEqual([]);
  });
});

/**
 * The webhooks, which are open by necessity and guarded by signature instead.
 *
 * These have no session and cannot have one — a gateway posting a callback has
 * no cookie — so the guard is that the bytes were signed by somebody holding
 * the shared secret. Two properties matter, and only one of them is about
 * having a check at all.
 *
 * The other is order. An integration that parses first and verifies second
 * still refuses the request, and has already acted on it — read an order id,
 * looked something up, written a log line naming it. The verification has to
 * come before anything reads the body's meaning, and that is a property of
 * where the lines sit rather than of what they do, so no behavioural test
 * catches it being reordered.
 */
describe('the webhooks', () => {
  /**
   * Two schemes, and the rule is different for each.
   *
   * PayFast, Uber and our sandbox sign the bytes, so the handler must read the
   * bytes — `request.json()` cannot be checked against a signature over what
   * was sent, because re-serialising parsed JSON does not reliably reproduce
   * it.
   *
   * Mailgun signs three fields carried *inside* the body, so its handler has to
   * parse before it can verify anything at all. Writing one rule for both would
   * have marked correct code as broken, and the fix somebody made to satisfy
   * the test would have been the bug.
   */
  const SIGNED_OVER_BYTES = [
    'src/app/api/payments/webhook/route.ts',
    'src/app/api/couriers/webhook/route.ts',
  ];
  const SIGNED_OVER_FIELDS = 'src/app/api/notifications/webhook/route.ts';

  it('all exist, so a passing run means something', () => {
    for (const route of [...SIGNED_OVER_BYTES, SIGNED_OVER_FIELDS]) {
      expect(routeHandlers(route).length, route).toBeGreaterThan(0);
    }
  });

  it('read the raw bytes where the signature covers them', () => {
    const parsingFirst = SIGNED_OVER_BYTES.flatMap((route) =>
      routeHandlers(route)
        .filter((handler) => /\brequest\.json\(\)/.test(handler.body))
        .map((handler) => `${handler.verb} ${route}`),
    );

    expect(parsingFirst, 'these read a parsed body a signature cannot cover').toEqual([]);
  });

  it('verify before they parse, where the signature covers the bytes', () => {
    const wrongWayRound = SIGNED_OVER_BYTES.flatMap((route) =>
      routeHandlers(route)
        .filter((handler) => {
          const verified = handler.body.search(/\bverify\w*\(/);
          const parsed = handler.body.search(/\bparse\w*\(/);
          return verified !== -1 && parsed !== -1 && parsed < verified;
        })
        .map((handler) => `${handler.verb} ${route}`),
    );

    expect(wrongWayRound, 'these parse before verifying').toEqual([]);
  });

  /**
   * And Mailgun, which must parse first, still verifies before it reads
   * anything that means something. Parsing to reach the signature envelope is
   * unavoidable; acting on `event-data` before the signature is checked is the
   * thing that would turn a public URL into a way to suppress any address.
   */
  it('verifies before reading the part of the body that carries meaning', () => {
    for (const handler of routeHandlers(SIGNED_OVER_FIELDS)) {
      const verified = handler.body.search(/verifyMailgunSignature\(/);
      // The access, not the type annotation that also names the field. Matching
      // the bare string found the field in the `payload` type declared at the
      // top of the handler, and called correct code broken.
      const acted = handler.body.search(/payload\[['"]event-data/);
      if (verified === -1 || acted === -1) continue;

      expect(verified, `${handler.verb} acts on the body before verifying`).toBeLessThan(acted);
    }
  });
});
