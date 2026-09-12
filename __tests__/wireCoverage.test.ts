import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import {
  MalformedResponse,
  checkedDispatch,
  checkedFavourites,
  checkedOtpVerification,
  checkedProfile,
  checkedPromotions,
  checkedSupportTopics,
  checkedTicket,
} from '@/services/wireChecks';
import { promotionIsRunning } from '@/services/rewardsService';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
  ───────────────────────────────────────────────────────────────────────────
  The responses nobody checked.

  `wireChecks` turns a response the app cannot believe into one honest failure
  at the fetch rather than a strange number three components away. Its rule is
  deliberately narrow — check what the app does arithmetic on or looks things
  up by, never become a schema — and the rule was being applied to whichever
  endpoints a round happened to touch.

  Counted: 23 of 46 `request` calls carried a `parse`. The other 23 were not a
  considered list; they were the ones nobody had needed yet. This closes the
  gap and makes the remainder an invariant rather than a tally.
  ───────────────────────────────────────────────────────────────────────────
*/

/**
 * FIXTURE 1 — the invariant, which is the point of the round.
 *
 * Not "more endpoints are checked" but **every response the app reads is
 * checked, and the only unchecked calls return nothing.** A number can drift;
 * this cannot drift without failing.
 */
describe('1 — every response the app reads is checked', () => {
  const calls: { file: string; returns: string; parsed: boolean }[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(__dirname, '..', dir), { withFileTypes: true })) {
      const here = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(here);
      else if (entry.name.endsWith('.ts')) {
        const source = read(here);
        for (const match of source.matchAll(
          /request<([^>]*)>\(\s*(?:`[^`]*`|'[^']*')([^;]*?)\);/gs,
        )) {
          calls.push({
            file: here,
            returns: match[1]!.trim(),
            parsed: match[2]!.includes('parse:'),
          });
        }
      }
    }
  };
  walk('src/services');

  it('finds the request calls at all, so this cannot pass by reading nothing', () => {
    expect(calls.length).toBeGreaterThanOrEqual(40);
  });

  it('leaves nothing unchecked that returns something', () => {
    const unchecked = calls.filter((call) => !call.parsed).map((call) => call.returns);

    // Every one of them is `void`: there is no body, so there is nothing a
    // check could look at. Listed as the set rather than the count, so adding
    // an unchecked endpoint that returns data fails here by name.
    expect([...new Set(unchecked)]).toEqual(['void']);
  });
});

/**
 * FIXTURE 2 — promotions, whose whole life is two dates.
 *
 * `promotionIsRunning` compares them with `new Date(…).getTime()`, and every
 * comparison against `NaN` is false. So a promotion with an unreadable date
 * vanishes from the list *and* is reported by `fetchPromotion` as "That offer
 * has ended" — the wrong half of the one distinction that function exists to
 * draw, said to somebody who followed a live link.
 */
describe('2 — a promotion with a date the app cannot read', () => {
  const promotion = {
    id: 'promo-1',
    headline: 'Two for Tuesday',
    validFrom: '2026-09-01T00:00:00.000Z',
    validUntil: '2026-12-31T23:59:59.000Z',
  };

  it('lets a well-formed one through', () => {
    const list = [promotion];
    expect(checkedPromotions(list)).toBe(list);
  });

  it('refuses a missing window', () => {
    const { validUntil: _gone, ...half } = promotion;
    expect(() => checkedPromotions([half])).toThrow(MalformedResponse);
    expect(() => checkedPromotions([half])).toThrow(/validUntil/);
  });

  it('refuses a date sent as a number, which is how epochs arrive', () => {
    expect(() => checkedPromotions([{ ...promotion, validFrom: 1788000000000 }])).toThrow(
      MalformedResponse,
    );
  });

  /**
   * The reason it matters, stated as the behaviour rather than as the check: a
   * date that does not parse is not "expired", it is unknown, and the rule
   * treats it as not running. That is the safe direction and it is still a
   * silent one, which is why the refusal belongs at the fetch.
   */
  it('is the failure the check prevents', () => {
    const unreadable = { ...promotion, validFrom: 'last Tuesday' } as never;
    expect(promotionIsRunning(unreadable, new Date('2026-10-01T12:00:00.000Z'))).toBe(false);
  });
});

/**
 * FIXTURE 3 — favourites, which are looked up by.
 *
 * `favourites.includes(product.id)` decides whether a heart is filled, and the
 * list is written straight into persisted storage. A number where a string was
 * promised matches no product at all, so a customer's favourites empty
 * themselves and the app cannot tell that from having been told the truth.
 */
describe('3 — a favourites list that is not product ids', () => {
  it('lets a list of ids through, empty included', () => {
    const ids = ['golden-original', 'soy-garlic'];
    expect(checkedFavourites(ids)).toBe(ids);
    expect(checkedFavourites([])).toEqual([]);
  });

  it('refuses a number among the ids', () => {
    expect(() => checkedFavourites(['golden-original', 7])).toThrow(MalformedResponse);
    expect(() => checkedFavourites(['golden-original', 7])).toThrow(/favourites\[1\]/);
  });

  it('refuses an object list, which is the other shape a backend sends', () => {
    expect(() => checkedFavourites([{ productId: 'golden-original' }])).toThrow(MalformedResponse);
  });
});

/**
 * FIXTURE 4 — the ticket reference, which is all the customer is given.
 *
 * "Reference {ticketId}. We usually reply within one business day." Absent,
 * that reads "Reference undefined" — under a tick, above a promise about a
 * reply, to somebody who has just reported a problem. Last round gave that
 * screen an honest failure path; this is the success path lying instead.
 */
describe('4 — a support ticket with no reference', () => {
  it('lets a real one through', () => {
    const ticket = { ticketId: 'SUP-10241' };
    expect(checkedTicket(ticket)).toBe(ticket);
  });

  it('refuses one with nothing to quote', () => {
    expect(() => checkedTicket({})).toThrow(/ticket\.ticketId/);
    expect(() => checkedTicket({ ticketId: 10241 })).toThrow(MalformedResponse);
  });
});

/**
 * FIXTURE 5 — the profile, which is persisted.
 *
 * Worse than a bad render: `updateProfile` writes this into the auth store,
 * which `persist` puts on disk, so a malformed profile survives the app being
 * closed and reopened. The verification flags gate screens, and a string
 * `"false"` is truthy.
 */
describe('5 — a profile the app would keep', () => {
  const profile = {
    id: 'user-1',
    email: 'thandi@example.co.za',
    emailVerified: true,
    phoneVerified: false,
  };

  it('lets a real one through', () => {
    expect(checkedProfile(profile)).toBe(profile);
  });

  it('refuses a verification flag sent as a string', () => {
    expect(() => checkedProfile({ ...profile, emailVerified: 'false' })).toThrow(MalformedResponse);
    expect(() => checkedProfile({ ...profile, phoneVerified: 'true' })).toThrow(MalformedResponse);
  });

  it('refuses one with no id, which every later request is about', () => {
    const { id: _gone, ...anonymous } = profile;
    expect(() => checkedProfile(anonymous)).toThrow(/profile\.id/);
  });
});

/**
 * FIXTURE 6 — the one nobody read at all.
 *
 * `verifyOtp` was typed `Promise<{ verified: true }>` — a literal `true` — and
 * `verify.tsx` does `await verifyOtp(…)` and moves on. So a backend answering
 * `200 { "verified": false }` would have confirmed a phone number on the
 * strength of the status line alone.
 *
 * Nothing noticed because the mock throws on a wrong code. Against a real
 * backend those are not the same thing: a wrong code is exactly the case a
 * verification endpoint is entitled to answer 200 to, with the answer in the
 * body.
 */
describe('6 — a verification the app took on trust', () => {
  it('reads the flag now, strictly', () => {
    expect(checkedOtpVerification({ verified: true })).toEqual({ verified: true });
    expect(() => checkedOtpVerification({ verified: 'true' })).toThrow(MalformedResponse);
    expect(() => checkedOtpVerification({})).toThrow(/verification\.verified/);
  });

  it('refuses to report a verification the server did not give', () => {
    const service = code('src/services/authService.ts');
    const verify = service.slice(service.indexOf('export async function verifyOtp'));

    expect(verify.slice(0, 700)).toMatch(/if \(!answer\.verified\)/);
    expect(verify.slice(0, 700)).toMatch(/throw new Error\('That code is not right/);
  });

  it('no longer claims a literal true it cannot know', () => {
    const service = code('src/services/authService.ts');
    expect(service).toMatch(/request<\{ verified: boolean \}>/);
  });
});

/**
 * FIXTURE 7 — the address quoted back to somebody locked out.
 *
 * "If an account exists for {sentTo}, we have sent a link to reset your
 * password." Shared by three endpoints that make the same promise in the same
 * words, so it is one rule rather than three.
 */
describe('7 — what was sent, and where', () => {
  it('lets a real dispatch through', () => {
    const sent = { sentTo: '+27821234567' };
    expect(checkedDispatch(sent)).toBe(sent);
  });

  it('refuses one with nowhere named', () => {
    expect(() => checkedDispatch({})).toThrow(/dispatch\.sentTo/);
  });

  it('is wired into all three endpoints that send something', () => {
    const service = code('src/services/authService.ts');
    expect(service.match(/parse: checkedDispatch/g) ?? []).toHaveLength(3);
  });
});

/**
 * FIXTURE 8 — a help topic that can never be found.
 *
 * Text alone is not checked here; that is the rule. `category` is the
 * exception, because the help screen builds its filter chips from it and
 * matches on it — so a topic in an undefined category is present in the list,
 * absent from every filter, and silent about both.
 */
describe('8 — a support topic filed under nothing', () => {
  const topic = { id: 'faq-1', question: 'Where is my order?', category: 'orders' };

  it('lets the five real categories through', () => {
    for (const category of ['orders', 'delivery', 'payments', 'rewards', 'account']) {
      expect(checkedSupportTopics([{ ...topic, category }])).toBeDefined();
    }
  });

  it('refuses one nobody defined, and says which are allowed', () => {
    expect(() => checkedSupportTopics([{ ...topic, category: 'billing' }])).toThrow(
      MalformedResponse,
    );
    expect(() => checkedSupportTopics([{ ...topic, category: 'billing' }])).toThrow(
      /orders, delivery, payments, rewards, account/,
    );
  });
});

/**
 * FIXTURE 9 — the checks that already existed and were not attached.
 *
 * Three of this round's gaps needed no new rule at all. `checkedAddresses`,
 * `checkedPaymentMethods` and `checkedOrder` were written, tested and wired
 * into one call each while a second call returning the same shape went
 * unguarded beside them — the setter that returns the list, the creator that
 * returns the row.
 *
 * The same shape as `isStoreOpenAt` having a passing test and not one caller:
 * nothing wrong with the answer, nothing asking for it.
 */
describe('9 — rules that existed with half their callers', () => {
  const account = code('src/services/accountService.ts');
  const orders = code('src/services/orderService.ts');

  it('checks the address list however it was obtained', () => {
    // The GET, the create, and the default-setter.
    expect((account.match(/checkedAddresses/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('checks the payment methods the default-setter hands back', () => {
    expect(account.match(/parse: checkedPaymentMethods/g) ?? []).toHaveLength(2);
  });

  it('checks the order a rating comes back as', () => {
    const rate = orders.slice(orders.indexOf('export async function rateOrder'));
    expect(rate.slice(0, 500)).toMatch(/parse: checkedOrder/);
  });
});

/**
 * FIXTURE 10 — the one that cannot be checked from here, and is written down
 * instead.
 *
 * `voidPayment` is the only `request<void>` whose *absence* of a body is
 * load-bearing. When an order fails after the card was authorised, checkout
 * tells the customer "Your card was not charged" if that call succeeds and
 * "your card was authorised, call the store" if it does not — on the strength
 * of the status line alone.
 *
 * There is no body to check and inventing a response shape for an endpoint
 * nobody has specified would be designing somebody else's API, which §8 and
 * §12 both rule out. So it is a documented contract rather than a check, and
 * this holds it in the launch audit where handover reads it.
 */
describe('10 — the contract that has to hold on the other side', () => {
  it('still reads a 2xx as released, deliberately', () => {
    const payments = code('src/services/paymentService.ts');
    const release = payments.slice(payments.indexOf('export async function voidPayment'));

    expect(release.slice(0, 400)).toMatch(/request<void>/);
    expect(release.slice(0, 400)).toMatch(/return true;/);
    // And a throw is the only thing that means "not released".
    expect(release.slice(0, 400)).toMatch(/catch \{\s*return false;/);
  });

  it('is named in the launch audit rather than assumed', () => {
    const audit = code('scripts/audit-launch-readiness.mjs');

    expect(audit).toMatch(/Payment void must mean voided/);
    expect(audit).toMatch(/must answer non-2xx if the authorisation was not/);
  });
});
