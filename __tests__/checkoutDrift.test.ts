import { readFileSync } from 'node:fs';
import path from 'node:path';

import { savedPaymentMethods } from '@/services/data/accountData';
import { offeredPaymentMethods, STANDING_RAILS } from '@/features/checkout/paymentOptions';
import {
  checkoutStillHonest,
  paymentNoLongerValid,
  priceDrift,
} from '@/features/checkout/checkoutDrift';
import { methodHasExpired } from '@/features/checkout/cardExpiry';
import { formatPrice } from '@/utils/money';
import type { PaymentMethod } from '@/types';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const lastMonthCard = savedPaymentMethods.find((m) => m.id === 'payment-mastercard-lastmonth')!;

/** The first instant of next month, which is when this month's card dies. */
const firstOfNextMonth = (from: Date = new Date()) =>
  new Date(from.getFullYear(), from.getMonth() + 1, 1, 0, 0, 1, 0);

/**
 * 1 — the card that changes its mind.
 *
 * Three cards were seeded and all three were settled: two expire years out,
 * one expired years ago. `cardHasExpired` is a comparison against the clock,
 * and nothing in the wallet had ever made it return a different answer than it
 * returned a moment earlier — so nothing had ever shown that checkout asked
 * the question once per screen and then stopped asking.
 */
describe('a saved card in its final month', () => {
  it('is seeded, and is the only card whose answer can change', () => {
    expect(lastMonthCard).toBeDefined();

    const now = new Date();
    const changesMind = savedPaymentMethods.filter(
      (m) => !methodHasExpired(m, now) && methodHasExpired(m, firstOfNextMonth(now)),
    );
    expect(changesMind.map((m) => m.id)).toEqual(['payment-mastercard-lastmonth']);
  });

  /**
   * Derived, not typed. A literal `09/26` would be a fixture that quietly
   * becomes a fourth long-expired card the month after it was written — still
   * passing, testing nothing.
   */
  it('carries this month, worked out rather than written down', () => {
    const now = new Date();
    const expected = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(
      now.getFullYear() % 100,
    ).padStart(2, '0')}`;

    expect(lastMonthCard.expiry).toBe(expected);
    expect(code('src/services/data/accountData.ts')).toMatch(/expiry: expiryOfCurrentMonth\(\)/);
  });

  it('is a real option today', () => {
    const offered = offeredPaymentMethods(savedPaymentMethods, 'delivery', new Date());
    expect(offered.map((m) => m.id)).toContain('payment-mastercard-lastmonth');
  });

  /** 2 — and is gone the moment the clock crosses, with nothing else changed. */
  it('is withdrawn on the first of next month, from the same saved list', () => {
    const offered = offeredPaymentMethods(savedPaymentMethods, 'delivery', firstOfNextMonth());
    expect(offered.map((m) => m.id)).not.toContain('payment-mastercard-lastmonth');

    // And the customer is not left with nothing to pay with, which is the case
    // `offeredPaymentMethods` was written for.
    expect(offered.length).toBeGreaterThan(0);
  });

  /**
   * 3 — the defect the fixture exposed.
   *
   * Checkout computed `offered` in a `useMemo` keyed on the saved list and the
   * fulfilment type. The clock is neither, so the filter ran once per screen
   * and its answer was fixed for however long the screen stayed open. The same
   * shape as the `blocker` memo before `useNow` existed: a memo caching an
   * answer derived from something it never declared.
   */
  it('is re-decided by the screen against the ticking clock', () => {
    const screen = code('src/app/checkout/index.tsx');
    const memo = screen.slice(screen.indexOf('const offered = useMemo'));

    expect(memo).toMatch(
      /offeredPaymentMethods\(paymentMethods\.data \?\? \[\], fulfilmentType, now\)/,
    );
    expect(memo.slice(0, 260)).toMatch(/\[paymentMethods\.data, fulfilmentType, now\]/);
  });
});

/**
 * 4 — the number under the button, and the number the card is charged.
 *
 * `handlePlaceOrder` recomputes the total at the tap — `const totalsNow =
 * getTotals()` — precisely because a voucher can expire between a render and a
 * tap. The recomputed figure then went straight to `authorise`. The new number
 * is the correct number; nobody told the customer it was a different one.
 */
describe('a total that moved between the render and the tap', () => {
  it('passes silently when nothing moved, which is every ordinary order', () => {
    expect(priceDrift(215, 215)).toBeNull();
    expect(priceDrift(0, 0)).toBeNull();
  });

  it('is caught when the total went up, and quotes both figures', () => {
    const message = priceDrift(215, 245)!;

    // Through `formatPrice`, not restated: this app writes rand as "R 215.00"
    // and a test that spells the format itself is testing its own copy of it.
    expect(message).toContain(formatPrice(215));
    expect(message).toContain(formatPrice(245));
    expect(message).toContain('gone up');
    // The customer must not think a card has been touched.
    expect(message).toContain('Nothing has been charged');
  });

  /**
   * 5 — and when it went *down*, which is the half that is easy to wave
   * through. A total that fell is still a total the customer did not agree to,
   * and a basket that silently reprices downwards is one that can silently
   * reprice upwards on the next build.
   */
  it('is caught when the total came down as well', () => {
    const message = priceDrift(245, 215)!;

    expect(message).toContain('come down');
    expect(message).toContain(formatPrice(245));
    expect(message).toContain(formatPrice(215));
  });

  it('tells the customer what to do about it', () => {
    expect(priceDrift(215, 245)).toMatch(/place the order again/i);
  });
});

/**
 * 6 — the card, re-read at the tap for the same reason the clock is.
 *
 * `missingFulfilmentRequirement` is already run a second time against a fresh
 * `new Date()` rather than trusting the render's `blocker`. That check is the
 * one the comment calls "the line where the money moves", and it re-checked
 * exactly one of the five things the screen had decided.
 */
describe('a way to pay that stopped being one', () => {
  it('says nothing about a card that is still good', () => {
    const visa = savedPaymentMethods.find((m) => m.id === 'payment-visa')!;
    expect(paymentNoLongerValid(visa, new Date())).toBeNull();
  });

  it('names the card, because a wallet holds more than one', () => {
    const message = paymentNoLongerValid(lastMonthCard, firstOfNextMonth())!;

    expect(message).toContain(lastMonthCard.label);
    expect(message).toContain(lastMonthCard.expiry!);
    expect(message).toContain('Nothing has been charged');
  });

  /** 7 — rails have no expiry and must never be caught by a card rule. */
  it('never catches a rail, whatever the clock says', () => {
    const distantFuture = new Date(2099, 0, 1);
    for (const rail of STANDING_RAILS) {
      expect(paymentNoLongerValid(rail, distantFuture)).toBeNull();
    }
  });

  /**
   * 8 — and an expiry nobody can read is not an expiry this may act on.
   *
   * Refusing to let somebody pay because of a format nobody anticipated is a
   * worse failure than letting the gateway decide, which is the rule
   * `cardHasExpired` already states. This defers to it rather than reading the
   * field itself, and this is the test that keeps it deferring.
   */
  it('never blocks a card whose expiry it cannot parse', () => {
    const odd: PaymentMethod = {
      id: 'payment-odd',
      type: 'card',
      label: 'Card ending 0001',
      last4: '0001',
      expiry: 'valid thru 2027',
      isDefault: false,
    };

    expect(paymentNoLongerValid(odd, new Date(2099, 0, 1))).toBeNull();
  });
});

/**
 * 9 — both checks, in the order a customer would want to hear them.
 */
describe('the two questions asked together', () => {
  const good = savedPaymentMethods.find((m) => m.id === 'payment-visa')!;

  it('lets an unchanged order through', () => {
    expect(
      checkoutStillHonest({ shownTotal: 215, chargedTotal: 215, method: good, now: new Date() }),
    ).toBeNull();
  });

  it('reports the dead card first when both are wrong', () => {
    const message = checkoutStillHonest({
      shownTotal: 215,
      chargedTotal: 245,
      method: lastMonthCard,
      now: firstOfNextMonth(),
    })!;

    // A dead card is a thing they must fix before the price is worth reading,
    // and two problems delivered as one is neither of them explained.
    expect(message).toContain(lastMonthCard.label);
    expect(message).not.toContain(formatPrice(245));
  });

  it('reports the price when the card is fine', () => {
    const message = checkoutStillHonest({
      shownTotal: 215,
      chargedTotal: 245,
      method: good,
      now: new Date(),
    })!;

    expect(message).toContain(formatPrice(245));
  });
});

/**
 * 10 — the wiring, which is where the previous version of this check went
 * wrong.
 *
 * The fulfilment re-check raised `inFlight` and returned without lowering it,
 * so one blocked tap killed the button for the life of the screen — found by a
 * security review of this branch. A second early return on the same path is
 * the same trap, so it is asserted rather than remembered.
 */
describe('the checkout screen’s use of it', () => {
  const screen = code('src/app/checkout/index.tsx');

  it('asks before it authorises, not after', () => {
    const guard = screen.indexOf('checkoutStillHonest(');
    const authorise = screen.indexOf('submitOrder(');

    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(authorise);
  });

  it('compares the render’s figure with the tap’s, not one with itself', () => {
    const call = screen.slice(
      screen.indexOf('checkoutStillHonest('),
      screen.indexOf('if (dishonest)'),
    );

    expect(call).toMatch(/shownTotal: totals\.total/);
    expect(call).toMatch(/chargedTotal: totalsNow\.total/);
    expect(call).toMatch(/now: new Date\(\)/);
  });

  it('lowers the in-flight guard before returning, so the next tap works', () => {
    const block = screen.slice(screen.indexOf('if (dishonest)'), screen.indexOf('try {'));

    expect(block).toMatch(/inFlight\.current = false/);
    expect(block).toMatch(/setFailure\(\{ status: 'declined'/);
  });

  /**
   * And the money that is reported is the money that was taken. `purchase` was
   * sent with the render's `totals` rather than the figure handed to the
   * gateway — equal on every ordinary order, and a disagreement nobody would
   * trace back to a checkout screen on the ones this file now refuses.
   */
  it('reports the charged figure to analytics, not the rendered one', () => {
    const event = screen.slice(screen.indexOf("track('purchase'"));

    expect(event.slice(0, 400)).toMatch(/value: totalsNow\.total/);
    expect(event.slice(0, 400)).toMatch(/totalsNow\.deliveryFee, totalsNow\.serviceFee/);
    expect(event.slice(0, 400)).toMatch(/totalsNow\.discount, totalsNow\.rewardsDiscount/);
  });
});

/**
 * And the browser pass that proved it, which is the part a unit test cannot
 * reach.
 *
 * Everything above this line is the rule stated and checked in isolation. What
 * showed the rule was needed was a real Chromium sitting on checkout with a
 * live voucher, advancing the clock past its expiry and pressing the button:
 * the screen read R 483.55 and the order was placed at R 568.00.
 *
 * `smoke:order` carries that as its twelfth step so it stays proved rather than
 * remembered. This guards the step, because a sweep quietly dropped is a sweep
 * that reports green for having done nothing — the failure `audit:text-scale`
 * had on its first run.
 */
describe('the journey that found it', () => {
  const smoke = code('scripts/smoke-order.mjs');

  it('reaches checkout with the voucher still live, which is the whole point', () => {
    const pass = smoke.slice(smoke.indexOf('const drifting = await browser.newContext'));

    // In-app navigation from the cart. A reload would drop the applied voucher
    // and the pass would prove nothing — the same trap the lapsed pass names.
    expect(pass).toMatch(/tapDrift\('cart-checkout'\)/);
    expect(pass).toMatch(/the voucher was not live at checkout; this pass would prove nothing/);
  });

  it('advances the clock after the render and before the tap', () => {
    const pass = smoke.slice(smoke.indexOf('const drifting = await browser.newContext'));
    const advance = pass.indexOf('__advanceTo');
    const tap = pass.indexOf("tapDrift('checkout-place-order')");

    expect(advance).toBeGreaterThan(-1);
    expect(advance).toBeLessThan(tap);
  });

  it('fails if an order is placed, and if the refusal says nothing', () => {
    const pass = smoke.slice(smoke.indexOf('const drifting = await browser.newContext'));

    expect(pass).toMatch(/an order was placed at a total the screen never showed/);
    expect(pass).toMatch(/the tap was refused without saying why/);
  });
});
