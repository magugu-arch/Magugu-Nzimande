import { FEES, PROMOTIONS } from '@bbq/seed';
import {
  applyPercentage,
  sumCents,
  type Cents,
  type OrderLine,
  type OrderTotals,
  type ServiceMode,
} from '@bbq/types';

/**
 * Every total the customer sees comes from here. Cents in, cents out, one
 * rounding step at the discount, so a basket and its order always agree.
 */

export function lineTotal(line: Pick<OrderLine, 'unitCents' | 'quantity'>): Cents {
  return line.unitCents * line.quantity;
}

export function subtotalOf(lines: readonly Pick<OrderLine, 'unitCents' | 'quantity'>[]): Cents {
  return sumCents(lines.map(lineTotal));
}

export function findPromotion(code: string | null) {
  if (!code) return null;
  const normalised = code.trim().toUpperCase();
  return PROMOTIONS.find((promotion) => promotion.code === normalised) ?? null;
}

export function discountOf(subtotalCents: Cents, code: string | null): Cents {
  const promotion = findPromotion(code);
  if (!promotion) return 0;
  // Rounded once, here, so the discount shown in the basket is the discount
  // charged. Never recomputed from a formatted string.
  return applyPercentage(subtotalCents, promotion.discountRate);
}

/**
 * Delivery is charged on the subtotal after discount, so a promo code cannot
 * push a basket over the free-delivery threshold that the customer has not
 * actually paid past.
 */
export function deliveryFeeOf(
  mode: ServiceMode,
  subtotalAfterDiscountCents: Cents,
  lineCount: number,
): Cents {
  if (mode !== 'Delivery' || lineCount === 0) return 0;
  return subtotalAfterDiscountCents >= FEES.freeDeliveryOverCents ? 0 : FEES.deliveryCents;
}

export function totalsFor(
  lines: readonly Pick<OrderLine, 'unitCents' | 'quantity'>[],
  mode: ServiceMode,
  promoCode: string | null,
): OrderTotals {
  const subtotalCents = subtotalOf(lines);
  const discountCents = discountOf(subtotalCents, promoCode);
  const deliveryCents = deliveryFeeOf(mode, subtotalCents - discountCents, lines.length);
  return {
    subtotalCents,
    discountCents,
    deliveryCents,
    totalCents: subtotalCents - discountCents + deliveryCents,
  };
}

/** Cents still to spend before delivery is free, or 0 once the basket clears it. */
export function remainingToFreeDelivery(subtotalAfterDiscountCents: Cents): Cents {
  return Math.max(0, FEES.freeDeliveryOverCents - subtotalAfterDiscountCents);
}

/** Points post on completion, one per whole rand of the amount actually paid. */
export function pointsFor(totalCents: Cents): number {
  return Math.floor(totalCents / 100);
}
