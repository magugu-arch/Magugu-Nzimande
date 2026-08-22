import { businessRules } from '@/constants/config';
import type {
  CartLine,
  CartTotals,
  FulfilmentType,
  OptionGroup,
  Product,
  SelectedOption,
} from '@/types';
import { multiplyRand, randToPoints, sumRand } from './money';

/**
 * Cart mathematics. Pure functions only — the Zustand store calls into here so
 * pricing rules stay testable and are never duplicated inside a screen.
 */

/** Stable identity for a configured line: same product + same options = same line. */
export function buildLineId(productId: string, selectedOptions: SelectedOption[]): string {
  const fingerprint = selectedOptions
    .map((option) => `${option.groupId}:${option.optionId}`)
    .sort()
    .join('|');
  return fingerprint.length > 0 ? `${productId}__${fingerprint}` : productId;
}

export function resolveSelectedOptions(
  groups: OptionGroup[],
  selection: Record<string, string[]>,
): SelectedOption[] {
  const resolved: SelectedOption[] = [];
  groups.forEach((group) => {
    const chosenIds = selection[group.id] ?? [];
    chosenIds.forEach((optionId) => {
      const option = group.options.find((candidate) => candidate.id === optionId);
      if (!option) return;
      resolved.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDelta: option.priceDelta,
      });
    });
  });
  return resolved;
}

export function unitPriceFor(basePrice: number, selectedOptions: SelectedOption[]): number {
  return sumRand([basePrice, ...selectedOptions.map((option) => option.priceDelta)]);
}

export function buildCartLine(
  product: Product,
  selectedOptions: SelectedOption[],
  quantity: number,
  specialInstructions?: string,
): CartLine {
  const unitPrice = unitPriceFor(product.basePrice, selectedOptions);
  const safeQuantity = clampQuantity(quantity);
  return {
    id: buildLineId(product.id, selectedOptions),
    productId: product.id,
    name: product.name,
    assetKey: product.assetKey,
    unitBasePrice: product.basePrice,
    quantity: safeQuantity,
    selectedOptions,
    ...(specialInstructions && specialInstructions.trim().length > 0
      ? { specialInstructions: specialInstructions.trim() }
      : {}),
    unitPrice,
    lineTotal: multiplyRand(unitPrice, safeQuantity),
  };
}

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(businessRules.maxQuantityPerLine, Math.max(1, Math.round(quantity)));
}

/** Default selection a customiser opens with, honouring each group's minimum. */
export function defaultSelectionFor(product: Product): Record<string, string[]> {
  const selection: Record<string, string[]> = {};
  product.optionGroups.forEach((group) => {
    const defaults = group.defaultOptionIds.filter((id) =>
      group.options.some((option) => option.id === id && option.available),
    );
    if (defaults.length === 0 && group.minSelect > 0) {
      const firstAvailable = group.options.find((option) => option.available);
      selection[group.id] = firstAvailable ? [firstAvailable.id] : [];
    } else {
      selection[group.id] = defaults.slice(0, Math.max(1, group.maxSelect));
    }
  });
  return selection;
}

/** Groups whose minimum has not been met yet, for the "add to cart" gate. */
export function unmetOptionGroups(
  groups: OptionGroup[],
  selection: Record<string, string[]>,
): OptionGroup[] {
  return groups.filter((group) => (selection[group.id] ?? []).length < group.minSelect);
}

export interface TotalsInput {
  lines: CartLine[];
  fulfilmentType: FulfilmentType;
  /** Rand discount from a voucher/promo code. */
  voucherDiscount?: number;
  /** Rand discount from redeemed loyalty points. */
  rewardsDiscount?: number;
  /** Overrides the standard fee (e.g. a store-specific rate). */
  deliveryFeeOverride?: number;
}

export function calculateTotals({
  lines,
  fulfilmentType,
  voucherDiscount = 0,
  rewardsDiscount = 0,
  deliveryFeeOverride,
}: TotalsInput): CartTotals {
  const subtotal = sumRand(lines.map((line) => line.lineTotal));

  const baseDeliveryFee = deliveryFeeOverride ?? businessRules.deliveryFee;
  // An empty basket is never charged: no lines, no fees.
  const deliveryFee =
    lines.length === 0 ||
    fulfilmentType !== 'delivery' ||
    subtotal >= businessRules.freeDeliveryThreshold
      ? 0
      : baseDeliveryFee;

  const serviceFee = lines.length > 0 ? businessRules.serviceFee : 0;

  // Discounts can never exceed what the customer is actually paying for food.
  const discount = Math.min(voucherDiscount, subtotal);
  const rewards = Math.min(rewardsDiscount, Math.max(0, subtotal - discount));

  const total = Math.max(0, sumRand([subtotal, deliveryFee, serviceFee, -discount, -rewards]));

  return {
    subtotal,
    deliveryFee,
    serviceFee,
    discount,
    rewardsDiscount: rewards,
    total,
    // Points accrue on food value only, never on fees or discounted amounts.
    pointsEarned: randToPoints(Math.max(0, sumRand([subtotal, -discount, -rewards]))),
  };
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

/** `Large · Soy Garlic · Extra sauce` — the summary shown under a cart line. */
export function describeOptions(line: CartLine): string {
  return line.selectedOptions.map((option) => option.optionName).join(' · ');
}

export function meetsDeliveryMinimum(subtotal: number, fulfilmentType: FulfilmentType): boolean {
  if (fulfilmentType !== 'delivery') return true;
  return subtotal >= businessRules.minimumDeliverySubtotal;
}
