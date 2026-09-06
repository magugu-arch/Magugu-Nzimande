import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  checkedAddresses,
  checkedPaymentIntent,
  checkedPaymentMethods,
  checkedPaymentResult,
  checkedSession,
  MalformedResponse,
} from '@/services/wireChecks';
import { savedPaymentMethods } from '@/services/data/accountData';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * 1 — the sharpest unchecked response in the app.
 *
 * `submitOrder` reads the authorisation as `if (!authorisation.success)` and
 * then hands `authorisation.intentId` to `release`. Neither was checked, and
 * `request<T>` casts the parsed JSON to `PaymentResult` without looking at it.
 *
 * A gateway that answers
 *
 *     { "success": "false", "message": "Insufficient funds" }
 *
 * is read as a **successful** authorisation, because `"false"` is truthy. The
 * order is placed against a payment that did not happen. That is not an exotic
 * response — a string boolean is what a loosely typed ORM or a JSON:API-ish
 * house style produces without anybody deciding to.
 */
describe('the authorisation that decides whether money moved', () => {
  it('accepts a real answer, either way', () => {
    expect(() => checkedPaymentResult({ success: true, intentId: 'pi_1' })).not.toThrow();
    expect(() =>
      checkedPaymentResult({ success: false, intentId: 'pi_1', message: 'Declined' }),
    ).not.toThrow();
  });

  it('refuses a success that is merely truthy', () => {
    // The one that places an order against a decline.
    expect(() => checkedPaymentResult({ success: 'false', intentId: 'pi_1' })).toThrow(
      MalformedResponse,
    );
    expect(() => checkedPaymentResult({ success: 'true', intentId: 'pi_1' })).toThrow(
      MalformedResponse,
    );
    expect(() => checkedPaymentResult({ success: 1, intentId: 'pi_1' })).toThrow(MalformedResponse);
  });

  /**
   * 2 — and the mirror, which is as bad in the other direction. `success`
   * absent is falsy, so a payment the gateway *did* take is reported to the
   * customer as a decline, under a button inviting them to try again.
   */
  it('refuses a success that is missing altogether', () => {
    expect(() => checkedPaymentResult({ intentId: 'pi_1' })).toThrow(MalformedResponse);
    expect(() => checkedPaymentResult({ success: null, intentId: 'pi_1' })).toThrow(
      MalformedResponse,
    );
  });

  /**
   * 3 — the handle a hold is released by. Required on both outcomes, because a
   * failed authorisation can still have taken one — which is the whole reason
   * `submitOrder` releases before it gives up.
   */
  it('requires the id a hold is released by, on a failure too', () => {
    expect(() => checkedPaymentResult({ success: false })).toThrow(MalformedResponse);
    expect(() => checkedPaymentResult({ success: true, intentId: '' })).toThrow(MalformedResponse);
    expect(() => checkedPaymentResult({ success: true, intentId: 42 })).toThrow(MalformedResponse);
  });

  it('says which field it refused, not just that it refused', () => {
    let message = '';
    try {
      checkedPaymentResult({ success: 'false', intentId: 'pi_1' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('payment.success');
    expect(message).toContain('true or false');
  });

  /** 4 — and the intent, which carries the figure about to be charged. */
  it('checks the amount on a payment intent', () => {
    expect(() =>
      checkedPaymentIntent({ intentId: 'pi_1', amount: 202, currency: 'ZAR' }),
    ).not.toThrow();
    expect(() => checkedPaymentIntent({ intentId: 'pi_1', amount: '202' })).toThrow(
      MalformedResponse,
    );
  });

  it('is wired into both payment calls', () => {
    const service = code('src/services/paymentService.ts');

    expect(service).toMatch(/parse: checkedPaymentResult<PaymentResult>/);
    expect(service).toMatch(/parse: checkedPaymentIntent<PaymentIntent>/);
  });

  /**
   * 5 — the two lines downstream that make the check worth having. If either
   * of these changes shape, the strictness above stops being the thing that
   * protects them.
   */
  it('guards the two reads it exists for', () => {
    const submit = code('src/features/checkout/submitOrder.ts');

    expect(submit).toMatch(/if \(!authorisation\.success\)/);
    expect(submit).toMatch(/release\(authorisation\.intentId\)/);
  });
});

/**
 * 6 — a way to pay the app does not know.
 *
 * `type` is not decoration. `offeredPaymentMethods` filters cash off anything
 * but a delivery, `requiresRedirect` decides whether the customer is sent to a
 * provider-hosted page, and `isSettledOnDelivery` decides whether anything is
 * authorised up front at all. An unknown `type` falls through all three — so
 * it is charged inline, as a card, whatever it actually is.
 */
describe('a payment method the app cannot categorise', () => {
  const CARD = { id: 'p1', type: 'card', label: 'Visa ending 4821', isDefault: true };

  it('accepts the six rails the app implements', () => {
    for (const type of ['card', 'eft', 'snapscan', 'cash', 'applepay', 'googlepay']) {
      expect(() => checkedPaymentMethods([{ ...CARD, type }])).not.toThrow();
    }
  });

  it('refuses one it has never heard of', () => {
    expect(() => checkedPaymentMethods([{ ...CARD, type: 'crypto' }])).toThrow(MalformedResponse);
    expect(() => checkedPaymentMethods([{ ...CARD, type: 'CARD' }])).toThrow(MalformedResponse);
    expect(() => checkedPaymentMethods([{ ...CARD, type: null }])).toThrow(MalformedResponse);
  });

  /** 7 — the seeded wallet passes its own check. */
  it('accepts the cards this app ships with', () => {
    expect(() => checkedPaymentMethods(savedPaymentMethods)).not.toThrow();
    expect(savedPaymentMethods.length).toBeGreaterThan(0);
  });
});

/**
 * 8 — the coordinates the delivery radius is measured from.
 *
 * `wireChecks`'s own opening note lists `deliveryRange` measuring `NaN` and
 * reading it as out of range among the three holes it was written for — and
 * the fix for that went to `checkStore`, the *branch* end of the same
 * measurement. The customer end stayed guarded at the consumer, with
 * `Number.isFinite` inside `deliveryRange`, which is the consumer-side patch
 * this file exists to replace with one honest failure at the fetch.
 */
describe('a saved address', () => {
  const ADDRESS = { id: 'a1', label: 'Home', line1: '14 Acacia Road' };

  it('accepts one with no coordinates, which is the ordinary case', () => {
    // The add-address form has no geocoder behind it, so most real addresses
    // in this app have never been located.
    expect(() => checkedAddresses([ADDRESS])).not.toThrow();
    expect(() => checkedAddresses([{ ...ADDRESS, latitude: null, longitude: null }])).not.toThrow();
  });

  it('refuses coordinates present and unusable', () => {
    expect(() =>
      checkedAddresses([{ ...ADDRESS, latitude: '-26.14', longitude: '28.04' }]),
    ).toThrow(MalformedResponse);
    expect(() => checkedAddresses([{ ...ADDRESS, latitude: -26.14, longitude: 'x' }])).toThrow(
      MalformedResponse,
    );
  });

  it('keeps the consumer guard as well, because two layers cost nothing', () => {
    const store = code('src/store/fulfilmentStore.ts');
    expect(store).toMatch(
      /if \(!Number\.isFinite\(latitude\) \|\| !Number\.isFinite\(longitude\)\)/,
    );
  });
});

/**
 * 9 — a session that half exists.
 *
 * A sign-in response missing `accessToken` leaves the app believing somebody
 * is signed in while every request it then makes is anonymous: their name on
 * Home, and a 401 behind everything. Failing the sign-in is the kinder answer.
 */
describe('a sign-in that did not sign anybody in', () => {
  const SESSION = {
    accessToken: 'at',
    refreshToken: 'rt',
    expiresAt: 1_800_000_000_000,
    user: { id: 'user-1', email: 'a@b.co.za' },
  };

  it('accepts a whole session', () => {
    expect(() => checkedSession(SESSION)).not.toThrow();
  });

  it('refuses one with no token, no refresh, or no expiry', () => {
    for (const field of ['accessToken', 'refreshToken', 'expiresAt']) {
      const broken = { ...SESSION } as Record<string, unknown>;
      delete broken[field];
      expect(() => checkedSession(broken)).toThrow(MalformedResponse);
    }
  });

  it('refuses one whose customer has no id', () => {
    expect(() => checkedSession({ ...SESSION, user: {} })).toThrow(MalformedResponse);
    expect(() => checkedSession({ ...SESSION, user: null })).toThrow(MalformedResponse);
  });

  it('is wired into both doors a session comes through', () => {
    const service = code('src/services/authService.ts');
    const matches = service.match(/parse: checkedSession<AuthSession>/g) ?? [];

    expect(matches.length).toBe(2);
    expect(service).toContain("'/v1/auth/sign-in'");
    expect(service).toContain("'/v1/auth/register'");
  });
});

/**
 * 10 — the sweep's own honesty, again, and it failed again.
 *
 * Three of this round's cases bend an endpoint that is only reached by
 * *pressing the button*. A case that bends `/v1/payments/authorise` and never
 * causes that call passes having proved nothing — the emptiest possible way
 * for a sweep to be green, and the failure `audit:text-scale` had on its first
 * run.
 *
 * So a case may declare the endpoint it is about, and the run fails if that
 * endpoint was never reached. The first version of that tracker recorded the
 * path *after* the CORS short-circuit and then lost the line entirely to a
 * reflow, so every money-path case reported "asked for nothing" while the
 * screens plainly showed stub data. The check was right and its instrument was
 * not — which is the same mistake as last round's stub baseline, made once
 * more in the same file.
 */
describe('the sweep proving it reached what it bent', () => {
  const audit = code('scripts/audit-wire.mjs');

  it('records every path the app asks for', () => {
    expect(audit).toMatch(/asked\.add\(pathname\)/);
  });

  it('records it before the CORS short-circuit, not after', () => {
    const handler = audit.slice(audit.indexOf('const api = createServer'));
    const record = handler.indexOf('asked.add(pathname)');
    const preflight = handler.indexOf("req.method === 'OPTIONS'");

    expect(record).toBeGreaterThan(-1);
    expect(record).toBeLessThan(preflight);
  });

  it('starts each case from an empty record', () => {
    expect(audit).toMatch(/asked = new Set\(\)/);
  });

  it('fails a case that never reached the endpoint it bends', () => {
    expect(audit).toMatch(/const neverAsked = testCase\.reaches !== undefined/);
    expect(audit).toMatch(/so this case proved nothing/);
  });

  it('declares the endpoint for every case that presses the button', () => {
    const cases = audit.slice(audit.indexOf('const CASES = ['), audit.indexOf('console.log('));
    const pressing = cases.match(/basket: true/g) ?? [];
    const declaring = cases.match(/reaches: '/g) ?? [];

    expect(pressing.length).toBeGreaterThan(0);
    expect(declaring.length).toBe(pressing.length);
  });

  it('presses the button, since none of these endpoints is reached otherwise', () => {
    expect(audit).toMatch(/checkout-place-order/);
  });
});
