import { FEES } from '@bbq/seed';
import {
  applyPercentage,
  sumCents,
  type Cents,
  type OrderLine,
  type OrderTotals,
  type Promotion,
  type ServiceMode,
} from '@bbq/types';

/**
 * Every total the customer sees comes from here. Cents in, cents out, one
 * rounding step at the discount, so a basket and its order always agree.
 */

function lineTotal(line: Pick<OrderLine, 'unitCents' | 'quantity'>): Cents {
  return line.unitCents * line.quantity;
}

export function subtotalOf(lines: readonly Pick<OrderLine, 'unitCents' | 'quantity'>[]): Cents {
  return sumCents(lines.map(lineTotal));
}

/**
 * What an offer takes off, given the lines it applies to.
 *
 * The discount comes off the named product's lines, not off the whole basket.
 * It used to come off the subtotal, which meant an offer sold as "twenty
 * percent off every sauced wing" took twenty percent off the chicken, the sides
 * and the drinks in the same order — several times what it advertised, on every
 * basket that was mostly not wings.
 *
 * Whether the offer runs at all is decided in `lib/promotions.ts`. By the time
 * a promotion reaches here it has already been checked; passing null is how a
 * caller says there is no valid offer.
 */
export function discountOf(
  lines: readonly Pick<OrderLine, 'unitCents' | 'quantity' | 'slug'>[],
  promotion: Promotion | null,
): Cents {
  if (!promotion) return 0;

  const eligible = lines.filter((line) => line.slug === promotion.productSlug);
  if (eligible.length === 0) return 0;

  // Rounded once, here, so the discount shown in the basket is the discount
  // charged. Never recomputed from a formatted string.
  return applyPercentage(subtotalOf(eligible), promotion.discountRate);
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
  lines: readonly Pick<OrderLine, 'unitCents' | 'quantity' | 'slug'>[],
  mode: ServiceMode,
  promotion: Promotion | null,
): OrderTotals {
  const subtotalCents = subtotalOf(lines);
  const discountCents = discountOf(lines, promotion);
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
