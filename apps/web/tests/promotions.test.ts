import { PROMOTIONS } from '@bbq/seed';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST as createOrderRoute } from '@/app/api/orders/route';
import { findPromotion, isRunningNow, promotionFor } from '@/lib/promotions';
import { sastNow } from '@/lib/trading';
import { discountOf } from '@/lib/pricing';
import {
  aDeliveryStore,
  aProduct,
  aSuburbOf,
  blankState,
  bodyOf,
  orderLine,
  orderRequest,
  registerCustomer,
  request,
  withAccounts,
} from './fixtures';

/**
 * The conditions the offers advertise.
 *
 * Every promotion carried its terms as a sentence for the customer — "Every
 * Wednesday, 11:00 to close", "collection only", "New accounts, one use" — and
 * nothing checked any of them. The code was looked up, found, and its discount
 * applied at any hour on any day to any basket, at a rate taken off the whole
 * subtotal rather than off the item the offer names.
 *
 * These hold both halves: that an offer runs when it says it runs, and that it
 * takes off what it says it takes off.
 */

beforeEach(blankState);

/** A moment in SAST, given as the UTC instant two hours behind it. */
const sast = (day: string, hour: number, minute = 0) =>
  new Date(`${day}T${String(hour - 2).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);

// 2026-09-02 is a Wednesday; the days either side follow.
const TUESDAY = '2026-09-01';
const WEDNESDAY = '2026-09-02';
const THURSDAY = '2026-09-03';
const SUNDAY = '2026-09-06';

describe('the clock the offers run on', () => {
  it('reads South African time whatever the visitor’s own clock says', () => {
    // 08:30 UTC is 10:30 in Johannesburg, on the same day.
    expect(sastNow(new Date(`${WEDNESDAY}T08:30:00Z`))).toEqual({ day: 3, minute: 630 });
  });

  /**
   * The one that would have been wrong in a quiet way: 23:00 UTC is already
   * tomorrow in Johannesburg, so an offer for Wednesday has to have ended.
   */
  it('rolls the day over for a late-evening UTC instant', () => {
    expect(sastNow(new Date(`${WEDNESDAY}T23:30:00Z`))).toEqual({ day: 4, minute: 90 });
  });

  it('rolls a Saturday night over to Sunday rather than to day seven', () => {
    // 2026-09-05 is a Saturday. 22:10 UTC is 00:10 on Sunday in SAST.
    expect(sastNow(new Date('2026-09-05T22:10:00Z')).day).toBe(0);
  });
});

describe('a day-restricted offer', () => {
  const onWednesday = { mode: 'Collection' as const, isFirstOrder: false };

  it('runs on its day', () => {
    expect(promotionFor('MIDWEEK', { ...onWednesday, now: sast(WEDNESDAY, 12) }).ok).toBe(true);
  });

  /** The defect: twenty percent off, every day of the week. */
  it('does not run on any other day', () => {
    for (const day of [TUESDAY, THURSDAY, SUNDAY]) {
      expect(promotionFor('MIDWEEK', { ...onWednesday, now: sast(day, 12) }).ok, day).toBe(false);
    }
  });

  it('refuses in the offer’s own words, so the customer reads what sold it', () => {
    const result = promotionFor('MIDWEEK', { ...onWednesday, now: sast(TUESDAY, 12) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/every wednesday/i);
  });
});

describe('a time-restricted offer', () => {
  const tuesday = (hour: number, minute = 0) => ({
    mode: 'Collection' as const,
    isFirstOrder: false,
    now: sast(TUESDAY, hour, minute),
  });

  it('runs inside its window', () => {
    // PICKTWO: every Tuesday, 11:00 to 22:00.
    expect(promotionFor('PICKTWO', tuesday(11)).ok).toBe(true);
    expect(promotionFor('PICKTWO', tuesday(21, 59)).ok).toBe(true);
  });

  it('does not run before it opens', () => {
    expect(promotionFor('PICKTWO', tuesday(10, 59)).ok).toBe(false);
  });

  /** Half-open at the top: an offer "to 22:00" is over at 22:00. */
  it('is over at its closing minute rather than one minute later', () => {
    expect(promotionFor('PICKTWO', tuesday(22)).ok).toBe(false);
  });

  it('honours a window with only a closing time', () => {
    // ONETRAY: weekdays before 16:00.
    expect(promotionFor('ONETRAY', tuesday(9)).ok).toBe(true);
    expect(promotionFor('ONETRAY', tuesday(16)).ok).toBe(false);
  });

  it('honours a window with only an opening time', () => {
    // SIDEBYSIDE: daily after 20:00.
    expect(promotionFor('SIDEBYSIDE', tuesday(19, 59)).ok).toBe(false);
    expect(promotionFor('SIDEBYSIDE', tuesday(20)).ok).toBe(true);
  });
});

describe('a mode-restricted offer', () => {
  const onThursday = (mode: 'Delivery' | 'Collection') => ({
    mode,
    isFirstOrder: false,
    now: sast(THURSDAY, 12),
  });

  it('runs on the mode it names', () => {
    // CAMPUS: Thursdays, collection.
    expect(promotionFor('CAMPUS', onThursday('Collection')).ok).toBe(true);
  });

  it('does not run on another', () => {
    const result = promotionFor('CAMPUS', onThursday('Delivery'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/collection only/i);
  });
});

describe('a first-order offer', () => {
  const anyTime = { mode: 'Delivery' as const, now: sast(WEDNESDAY, 12) };

  it('runs for a first order', () => {
    expect(promotionFor('FIRSTCRUNCH', { ...anyTime, isFirstOrder: true }).ok).toBe(true);
  });

  /** The defect: "New accounts, one use" worked for anyone, repeatedly. */
  it('does not run for somebody who has ordered before', () => {
    expect(promotionFor('FIRSTCRUNCH', { ...anyTime, isFirstOrder: false }).ok).toBe(false);
  });
});

describe('the order route', () => {
  /**
   * A delivery order needs a store that delivers and a suburb it serves; the
   * default fixture store is a collection store, and passing only
   * `mode: 'Delivery'` gets a 400 from the route rather than the refusal
   * under test.
   */
  const delivery = () => {
    const store = aDeliveryStore();
    return { storeId: store.id, mode: 'Delivery', address: '12 Oak Avenue', suburb: aSuburbOf(store) };
  };

  const orderWith = (code: string, over: Record<string, unknown> = {}) =>
    createOrderRoute(
      request('/api/orders', {
        body: orderRequest([orderLine(aProduct())], { promoCode: code, ...over }),
      }),
    );

  it('refuses a code that is not ours', async () => {
    const response = await orderWith('NOTACODE');
    expect(response.status).toBe(409);
  });

  /**
   * A guest is not "new" in the sense the offer means. There is no account to
   * remember that they used it, so one use would mean once per browser.
   */
  it('refuses a first-order offer to a guest', async () => {
    const response = await orderWith('FIRSTCRUNCH', delivery());
    expect(response.status).toBe(409);
    expect((await bodyOf<{ error: string }>(response)).error).toMatch(/first order/i);
  });

  it('refuses a first-order offer to somebody who has already ordered', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      const place = () =>
        createOrderRoute(
          request('/api/orders', {
            cookie,
            body: orderRequest([orderLine(aProduct())], delivery()),
          }),
        );

      expect((await place()).status).toBe(201);

      const second = await createOrderRoute(
        request('/api/orders', {
          cookie,
          body: orderRequest([orderLine(aProduct())], {
            ...delivery(),
            promoCode: 'FIRSTCRUNCH',
          }),
        }),
      );
      expect(second.status).toBe(409);
    });
  });

  /**
   * The rule the server exists to enforce. A client can send any mode it likes
   * in the body, but the offer is checked against the mode the order is
   * actually placed for.
   */
  it('refuses a collection-only offer on a delivery order', async () => {
    const response = await orderWith('CAMPUS', delivery());
    expect(response.status).toBe(409);
  });
});

describe('every offer in the catalogue', () => {
  /**
   * A guard, not a rule. Each `window` was written by reading the offer's own
   * `validity` sentence; if a new offer arrives with conditions in the sentence
   * and none in the window, it would be advertised and never enforced — which
   * is the state all six of these were in.
   */
  it('has its stated conditions in a form the checkout can check', () => {
    for (const promotion of PROMOTIONS) {
      const saysDay = /monday|tuesday|wednesday|thursday|friday|weekday|daily/i.test(
        promotion.validity,
      );
      const saysTime = /\d{2}:\d{2}|before|after|close/i.test(promotion.validity);
      const saysMode = /collection|delivery|dine/i.test(promotion.validity + promotion.copy);

      const { days, fromMinute, toMinute, modes } = promotion.window;

      if (saysDay && !/daily/i.test(promotion.validity)) {
        expect(days.length, `${promotion.code} names days but restricts none`).toBeGreaterThan(0);
      }
      if (saysTime) {
        expect(
          fromMinute !== null || toMinute !== null,
          `${promotion.code} names a time but restricts none`,
        ).toBe(true);
      }
      if (saysMode) {
        // Named in the copy either as a restriction or as "both"; only the
        // restrictive ones must narrow the modes.
        const restrictive = /only|collection only/i.test(promotion.copy + promotion.validity);
        if (restrictive) {
          expect(modes.length, `${promotion.code} says only but allows all`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('names a product that the discount can actually come off', () => {
    for (const promotion of PROMOTIONS) {
      const basket = [{ unitCents: 10_000, quantity: 1, slug: promotion.productSlug }];
      expect(discountOf(basket, promotion), promotion.code).toBeGreaterThan(0);
    }
  });
});

describe('the offers page’s view of what is running', () => {
  it('says an offer is on when its day and time are on', () => {
    const midweek = findPromotion('MIDWEEK');
    expect(midweek).not.toBeNull();
    if (midweek) {
      expect(isRunningNow(midweek, sast(WEDNESDAY, 12))).toBe(true);
      expect(isRunningNow(midweek, sast(TUESDAY, 12))).toBe(false);
    }
  });

  /**
   * A first-order offer is still on today even for somebody it is not for.
   * "Running" is a question about the clock, not about the customer.
   */
  it('does not call a first-order offer closed for a returning customer', () => {
    const first = findPromotion('FIRSTCRUNCH');
    expect(first).not.toBeNull();
    if (first) expect(isRunningNow(first, sast(WEDNESDAY, 12))).toBe(true);
  });
});
