import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  holdSessionExpiryWhile,
  reportSessionExpired,
  resetSessionState,
  setSessionExpiredHandler,
} from '@/services/apiClient';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

afterEach(() => resetSessionState());

/**
 * 1 — the state nothing had produced, because reaching it needs three things
 * to go wrong in order.
 *
 * The card authorises. `/v1/orders` answers 401 — an access token that aged
 * out in the seconds between the two calls. The refresh fails, so the API
 * client clears the tokens and fires the app's session-expired handler, which
 * clears the basket and replaces the route.
 *
 * All of that happens while `submitOrder` is still awaiting. It then returns
 * `stranded` — the outcome that exists to say "your card was authorised and
 * there is no order; call the store" — and there is no longer a screen to say
 * it on. Driven in Chromium, the customer ends on:
 *
 *     Welcome back
 *     Sign in to reorder your favourites, track deliveries and spend your points.
 *
 * with a hold on their card, a basket that has been emptied, and no way to
 * learn either happened. The one failure `submitOrder` was written to prevent,
 * arriving through a door it did not know about.
 */
describe('a session that expires while the money is moving', () => {
  it('holds the expiry until the sequence has an answer', async () => {
    const told: { duringPayment: boolean }[] = [];
    setSessionExpiredHandler((expiry) => told.push(expiry));

    let firedInside = false;
    await holdSessionExpiryWhile(async () => {
      // Whatever the API client does mid-sequence, the app must not be told
      // yet — the screen has no message to show until this resolves.
      reportSessionExpired();
      firedInside = told.length > 0;
      return 'stranded';
    });

    expect(firedInside).toBe(false);
    expect(told).toEqual([{ duringPayment: true }]);
  });

  it('fires immediately when no payment is in flight', () => {
    const told: { duringPayment: boolean }[] = [];
    setSessionExpiredHandler((expiry) => told.push(expiry));

    reportSessionExpired();

    expect(told).toEqual([{ duringPayment: false }]);
  });

  /**
   * 2 — a counter rather than a flag. Nothing stops two attempts overlapping —
   * checkout's in-flight guard makes it unlikely rather than impossible — and
   * a boolean would let the inner one lower the latch for the outer.
   */
  it('stays held while any attempt is still running', async () => {
    const told: unknown[] = [];
    setSessionExpiredHandler((expiry) => told.push(expiry));

    let innerDone = false;
    await holdSessionExpiryWhile(async () => {
      await holdSessionExpiryWhile(async () => {
        reportSessionExpired();
      });
      innerDone = told.length > 0;
    });

    expect(innerDone).toBe(false);
    expect(told).toHaveLength(1);
  });

  /** 3 — and it reports once, not once per deferred 401. */
  it('reports a single expiry however many requests met one', async () => {
    const told: unknown[] = [];
    setSessionExpiredHandler((expiry) => told.push(expiry));

    await holdSessionExpiryWhile(async () => {
      reportSessionExpired();
      reportSessionExpired();
      reportSessionExpired();
    });

    expect(told).toHaveLength(1);
  });

  /** 4 — a sequence that never met a 401 must not raise one on the way out. */
  it('says nothing at all when the payment went fine', async () => {
    const told: unknown[] = [];
    setSessionExpiredHandler((expiry) => told.push(expiry));

    await holdSessionExpiryWhile(async () => 'placed');

    expect(told).toEqual([]);
  });

  /** 5 — and the latch comes down even when the sequence throws. */
  it('lowers the latch on a thrown sequence, so the app is not deaf afterwards', async () => {
    const told: unknown[] = [];
    setSessionExpiredHandler((expiry) => told.push(expiry));

    await expect(
      holdSessionExpiryWhile(async () => {
        throw new Error('place failed');
      }),
    ).rejects.toThrow('place failed');

    // The expiry that arrives next is an ordinary one, reported at once.
    reportSessionExpired();
    expect(told).toEqual([{ duringPayment: false }]);
  });
});

/**
 * 6 — the wiring, which is where a fix like this is usually undone.
 */
describe('what the app does with the fact', () => {
  it('keeps the customer where the message is', () => {
    const expiry = code('src/features/system/useSessionExpiry.ts');

    expect(expiry).toMatch(/setSessionExpiredHandler\(\(\{ duringPayment \}\) =>/);
    expect(expiry).toMatch(/forgetLocally\(\{ redirect: !duringPayment \}\)/);
  });

  /**
   * 7 — and forgets everything else regardless. None of the basket, the
   * address or the query cache depends on where the customer is standing, and
   * a session that has expired is a session whose data must go.
   */
  it('still forgets the basket, the address and the cache', () => {
    const signOut = code('src/features/system/useSignOut.ts');
    const forget = signOut.slice(signOut.indexOf('const forget = useCallback'));

    expect(forget.slice(0, 300)).toMatch(/clearCart\(\)/);
    expect(forget.slice(0, 300)).toMatch(/forgetFulfilment\(\)/);
    expect(forget.slice(0, 300)).toMatch(/queryClient\.clear\(\)/);
    expect(forget.slice(0, 300)).toMatch(/if \(redirect\) router\.replace/);
  });

  /** 8 — the deliberate sign-out still redirects, because nothing is pending. */
  it('leaves the ordinary sign-out exactly as it was', () => {
    const signOut = code('src/features/system/useSignOut.ts');
    const deliberate = signOut.slice(signOut.indexOf('const signOut = useCallback'));

    expect(deliberate.slice(0, 500)).toMatch(/forget\(\);/);
  });

  it('wraps the money sequence and nothing else', () => {
    const submit = code('src/features/checkout/submitOrder.ts');

    expect(submit).toMatch(/return holdSessionExpiryWhile\(\(\) => attemptOrder\(/);
    expect(submit).toMatch(/async function attemptOrder\(/);
  });
});

/**
 * 9 — and the harness, which was wrong first and passed for it.
 *
 * `audit:wire` seeded the customer's profile into `bbq.auth` and nothing else.
 * Tokens live in `secureStorage`, which falls back to AsyncStorage on web
 * under their own keys — so every request went out with no `Authorization`
 * header, and `execute` reads a 401 with no header as a **guest** who never
 * had a session rather than one that expired. The case was driving the guest
 * path under another name, and passing.
 *
 * That is why the first counterfactual for this round showed no difference at
 * all: it was never exercising the code the fix is about.
 */
describe('the sweep that had to be fixed before it could find it', () => {
  const audit = code('scripts/audit-wire.mjs');

  it('seeds the tokens as well as the profile', () => {
    expect(audit).toMatch(/window\.localStorage\.setItem\('bbq\.auth\.accessToken'/);
    expect(audit).toMatch(/window\.localStorage\.setItem\('bbq\.auth\.refreshToken'/);
  });

  it('uses the keys secureStorage actually falls back to', () => {
    const storage = code('src/services/secureStorage.ts');

    const access = /const ACCESS_TOKEN_KEY = '([^']+)'/.exec(storage)?.[1];
    const refresh = /const REFRESH_TOKEN_KEY = '([^']+)'/.exec(storage)?.[1];

    expect(access).toBeDefined();
    expect(refresh).toBeDefined();
    expect(audit).toContain(`'${access!}'`);
    expect(audit).toContain(`'${refresh!}'`);
  });

  /**
   * 10 — and it checks the route rather than the words.
   *
   * "Sign in to finish this." is a legitimate message *on* the checkout screen
   * — it is what a guest is told — and a word-match cannot tell that apart
   * from having been sent to the sign-in screen. The first version of this
   * case forbade the phrase and reported a failure that was its own.
   */
  it('fails a case that navigated away from the screen it was reading', () => {
    expect(audit).toMatch(/staysOn/);
    expect(audit).toMatch(/the message it was meant to show went with it/);
  });

  it('401s the void endpoint by its full path, not by a prefix', () => {
    // `/v1/payments` as a key also matched `/v1/payments/authorise`, so the
    // card never authorised and the sequence under test never ran.
    expect(audit).toMatch(/statuses\['\/v1\/payments\/pi_stranded'\] = 401/);
    expect(audit).not.toMatch(/statuses\['\/v1\/payments'\] = 401/);
  });
});
