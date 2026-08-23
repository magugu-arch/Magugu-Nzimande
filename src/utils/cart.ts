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

/** Why a line could not be carried forward. */
export type DroppedReason = 'off-menu' | 'unavailable' | 'option-gone';

export interface DroppedLine {
  line: CartLine;
  reason: DroppedReason;
}

export interface RepricedLine {
  line: CartLine;
  previousUnitPrice: number;
}

export interface CartReconciliation {
  /** The lines to keep, at today's prices. */
  lines: CartLine[];
  dropped: DroppedLine[];
  repriced: RepricedLine[];
  /** Whether anything at all needs to be written back to the store. */
  changed: boolean;
}

/**
 * Bring a saved cart back into agreement with the menu.
 *
 * The cart is persisted to disk with every price baked into it — base price,
 * each option's delta, the line total. That is right for showing a basket
 * offline and wrong the moment the menu moves underneath it. A basket left
 * overnight would happily check out at yesterday's prices, or order an item
 * that has since come off the menu entirely.
 *
 * The reorder flow already refuses to re-add an unavailable product and says
 * so. This applies the same rule to the basket the customer is actually
 * holding.
 *
 * Repricing is silent-but-reported: the line stays, at today's price, and the
 * caller tells the customer. Dropping is not something to do quietly, which is
 * why each dropped line carries its reason.
 */
export function reconcileCart(lines: CartLine[], products: Product[]): CartReconciliation {
  const byId = new Map(products.map((product) => [product.id, product]));

  const kept: CartLine[] = [];
  const dropped: DroppedLine[] = [];
  const repriced: RepricedLine[] = [];
  let quietlyUpdated = false;

  for (const line of lines) {
    const product = byId.get(line.productId);

    if (!product) {
      dropped.push({ line, reason: 'off-menu' });
      continue;
    }
    if (!product.available) {
      dropped.push({ line, reason: 'unavailable' });
      continue;
    }

    // Re-resolve every chosen option against the product as it stands now. A
    // vanished or withdrawn option means this exact configuration cannot be
    // made any more — quietly dropping the option would cook something the
    // customer did not order, so the line goes and they are told.
    const currentOptions: SelectedOption[] = [];
    let configurationBroken = false;

    for (const chosen of line.selectedOptions) {
      const group = product.optionGroups.find((candidate) => candidate.id === chosen.groupId);
      const option = group?.options.find((candidate) => candidate.id === chosen.optionId);

      if (!group || !option || !option.available) {
        configurationBroken = true;
        break;
      }

      currentOptions.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDelta: option.priceDelta,
      });
    }

    if (configurationBroken) {
      dropped.push({ line, reason: 'option-gone' });
      continue;
    }

    const unitPrice = unitPriceFor(product.basePrice, currentOptions);

    const updated: CartLine = {
      ...line,
      name: product.name,
      assetKey: product.assetKey,
      unitBasePrice: product.basePrice,
      selectedOptions: currentOptions,
      unitPrice,
      lineTotal: multiplyRand(unitPrice, line.quantity),
    };

    kept.push(updated);

    // A renamed or re-shot item still has to be written back, but it is not
    // worth interrupting the customer over. Only a price change is.
    if (unitPrice !== line.unitPrice) {
      repriced.push({ line: updated, previousUnitPrice: line.unitPrice });
    } else if (!sameLine(line, updated)) {
      quietlyUpdated = true;
    }
  }

  return {
    lines: kept,
    dropped,
    repriced,
    changed: dropped.length > 0 || repriced.length > 0 || quietlyUpdated,
  };
}

/** Whether reconciliation left a line byte-for-byte as it found it. */
function sameLine(before: CartLine, after: CartLine): boolean {
  return (
    before.name === after.name &&
    before.assetKey === after.assetKey &&
    before.unitBasePrice === after.unitBasePrice &&
    before.unitPrice === after.unitPrice &&
    before.lineTotal === after.lineTotal &&
    before.selectedOptions.length === after.selectedOptions.length &&
    before.selectedOptions.every((option, index) => {
      const next = after.selectedOptions[index];
      return (
        next !== undefined &&
        option.optionId === next.optionId &&
        option.optionName === next.optionName &&
        option.groupName === next.groupName &&
        option.priceDelta === next.priceDelta
      );
    })
  );
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
