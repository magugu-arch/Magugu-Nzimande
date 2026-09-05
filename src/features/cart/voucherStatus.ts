import type { CartLine, CartTotals } from '@/types';
import { voucherBlocker, type VoucherTerms } from '@/utils/cart';
import { formatPrice } from '@/utils/money';
import { formatShortDate } from '@/utils/datetime';

/**
 * The sentence under an applied promo code.
 *
 * Four outcomes, because a voucher can be stuck for three different reasons
 * and each asks something different of the customer:
 *
 *   - expired — cannot be fixed at all;
 *   - below the minimum — can be fixed by adding anything;
 *   - missing the item it makes free — can only be fixed by adding that item;
 *   - or it is working, and the line says what it took off.
 *
 * The third was missing. `freeItem` is the fourth member of `discountType` and
 * nothing had ever seeded one, so the only voucher that asks for a particular
 * product had never been in a basket. Without the item `voucherDiscount`
 * returns zero, and the screen's two-way branch would have printed
 * "R 0.00 off applied" beside a green tick — the same class of untruth as the
 * "Free item" label the wallet was already showing over a fixed rand discount.
 *
 * `freeItemName` is resolved by the caller against the menu, because this
 * knows about vouchers and not about products. Absent, the sentence still
 * works: "Add the free item to use this code" is vaguer than naming it and
 * still tells somebody what to do.
 */
export function voucherStatus(
  voucher: VoucherTerms,
  totals: Pick<CartTotals, 'subtotal' | 'discount'>,
  lines: CartLine[],
  freeItemName: string | null,
  now: Date = new Date(),
): string {
  switch (voucherBlocker(voucher, totals.subtotal, now, lines)) {
    case 'expired':
      return voucher.expiresAt
        ? `That code expired on ${formatShortDate(voucher.expiresAt)}`
        : 'That code has expired';
    case 'minimum':
      return `Spend ${formatPrice(voucher.minimumSpend)} to use this code`;
    case 'missingItem':
      return freeItemName
        ? `Add ${freeItemName} to use this code`
        : 'Add the free item to use this code';
    case null:
      if (voucher.discountType === 'freeDelivery') return 'Free delivery applied';
      return `${formatPrice(totals.discount)} off applied`;
  }
}
