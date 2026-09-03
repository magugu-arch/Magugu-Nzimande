import { PROMOTIONS } from '@bbq/seed';
import type { Promotion, ServiceMode } from '@bbq/types';

/**
 * Whether an offer actually runs, and on what.
 *
 * Every promotion carried its conditions as a sentence for the customer —
 * "Every Wednesday, 11:00 to close", "collection only", "New accounts, one
 * use" — and nothing checked any of them. The code was looked up, found, and
 * its discount applied at any hour on any day to any basket. An offer that
 * advertises a condition and does not apply it is money leaving the business
 * every time somebody learns the code.
 *
 * Nothing here decides what an offer means. Each rule is read off the sentence
 * the offer already carries; where the sentence names a condition that cannot
 * be checked online — a student card shown at the counter — it stays with the
 * person at the till and is not silently dropped or silently enforced.
 */

const MINUTES_IN_DAY = 24 * 60;
/** South Africa does not observe daylight saving, so the offset is a constant. */
const SAST_OFFSET_MINUTES = 2 * 60;

/** The SAST weekday and minute, whatever the visitor's own clock says. */
export function sastNow(now: Date = new Date()): { day: number; minute: number } {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const shifted = utcMinutes + SAST_OFFSET_MINUTES;
  return {
    // A time past 22:00 UTC is already tomorrow in Johannesburg.
    day: (now.getUTCDay() + Math.floor(shifted / MINUTES_IN_DAY)) % 7,
    minute: shifted % MINUTES_IN_DAY,
  };
}

export type Eligibility = {
  mode: ServiceMode;
  /**
   * Whether this order is a signed-in customer's first.
   *
   * False for a guest, which is not the same as unknown: a first-order offer
   * cannot be given to somebody there is no way to recognise again, and
   * treating a guest as new would make "one use" mean once per browser.
   */
  isFirstOrder: boolean;
  now?: Date;
};

export type PromotionRefusal =
  | { ok: true; promotion: Promotion }
  | { ok: false; reason: string };

/** The offer with this code, whether or not it is running. */
export function findPromotion(code: string | null): Promotion | null {
  if (!code) return null;
  const normalised = code.trim().toUpperCase();
  return PROMOTIONS.find((promotion) => promotion.code === normalised) ?? null;
}

/**
 * Whether the offer runs for this order, and if not, what to tell the customer.
 *
 * The reason is the offer's own `validity` sentence rather than a translation
 * of it, so a customer refused at checkout reads the same words that sold them
 * the offer instead of a second, subtly different account of the rule.
 */
export function promotionFor(code: string | null, at: Eligibility): PromotionRefusal {
  const promotion = findPromotion(code);
  if (!promotion) return { ok: false, reason: 'That promo code is not one of ours' };

  const { day, minute } = sastNow(at.now);
  const { days, fromMinute, toMinute, modes } = promotion.window;

  if (days.length > 0 && !days.includes(day)) {
    return { ok: false, reason: `${promotion.title} runs ${promotion.validity.toLowerCase()}` };
  }

  // Compared as half-open, so an offer running "to 22:00" is over at 22:00
  // rather than lasting one more minute than it says.
  if (fromMinute !== null && minute < fromMinute) {
    return { ok: false, reason: `${promotion.title} runs ${promotion.validity.toLowerCase()}` };
  }
  if (toMinute !== null && minute >= toMinute) {
    return { ok: false, reason: `${promotion.title} runs ${promotion.validity.toLowerCase()}` };
  }

  if (modes.length > 0 && !modes.includes(at.mode)) {
    return { ok: false, reason: `${promotion.title} is ${modes.join(' and ').toLowerCase()} only` };
  }

  if (promotion.firstOrderOnly && !at.isFirstOrder) {
    return {
      ok: false,
      reason: `${promotion.title} is for a first order on a new account`,
    };
  }

  return { ok: true, promotion };
}

/** Whether an offer is running now, for the offers page to say so. */
export function isRunningNow(promotion: Promotion, now?: Date): boolean {
  const result = promotionFor(promotion.code, {
    mode: promotion.window.modes[0] ?? 'Collection',
    // Asked as a question about the clock, not about a customer: an offer for
    // first orders is still "running" today even for somebody it is not for.
    isFirstOrder: true,
    now,
  });
  return result.ok;
}
