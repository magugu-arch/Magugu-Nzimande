import type { Voucher } from '@/types';
import { formatShortDate } from '@/utils/datetime';

/**
 * Whether a code in the wallet can still be spent, and how to say so.
 *
 * Two screens ask this and only one of them used to. The Vouchers screen wrote
 * the three-way caption inline — used / expired / expires — and the Offers
 * screen, which is where a customer actually meets a promo code, asked nothing
 * at all: it printed the code in a large box under "Use this code at checkout"
 * beside a Copy button, whatever the wallet said about it.
 *
 * So a promotion could advertise a code the customer had already spent, invite
 * them to copy it, and let them find out at the cart — after building a basket
 * — that it was gone. The cart refuses it correctly; the problem is where the
 * refusal happens, which is three screens and a decision later than the offer
 * that promised it.
 *
 * `used` is tested before `expired` because a spent code is spent whatever the
 * date says, and because the seeded example is both: nothing in this app stops
 * a voucher expiring after it has been used.
 */
export type VoucherStanding = 'used' | 'expired' | 'live';

export function voucherStanding(voucher: Pick<Voucher, 'used' | 'expired'>): VoucherStanding {
  if (voucher.used) return 'used';
  if (voucher.expired) return 'expired';
  return 'live';
}

/** The wallet's own caption, in one place so two screens cannot drift apart. */
export function voucherStandingCopy(
  voucher: Pick<Voucher, 'used' | 'expired' | 'expiresAt'>,
): string {
  switch (voucherStanding(voucher)) {
    case 'used':
      return 'Already used';
    case 'expired':
      return `Expired ${formatShortDate(voucher.expiresAt)}`;
    case 'live':
      return `Expires ${formatShortDate(voucher.expiresAt)}`;
  }
}

/**
 * What the Offers screen says instead of "Use this code at checkout".
 *
 * Null when the code is good, so the ordinary case draws exactly what it drew
 * before. The wording says what happened rather than only that something is
 * wrong: "you have already used this code" is an answer, "this code is not
 * valid" is a puzzle.
 */
export function promoCodeWarning(
  voucher: Pick<Voucher, 'used' | 'expired' | 'expiresAt'> | undefined,
): string | null {
  // A code the wallet has never heard of is not a code this app can judge. The
  // promotion may be running against a voucher the backend issues on demand,
  // and refusing it here would break every offer the wallet does not preload.
  if (!voucher) return null;

  switch (voucherStanding(voucher)) {
    case 'used':
      return 'You have already used this code, so it will not come off at checkout.';
    case 'expired':
      return `This code expired on ${formatShortDate(voucher.expiresAt)} and will not come off at checkout.`;
    case 'live':
      return null;
  }
}
