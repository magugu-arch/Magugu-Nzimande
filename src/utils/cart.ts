import { businessRules } from '@/constants/config';
import type {
  CartLine,
  CartTotals,
  FulfilmentType,
  OptionGroup,
  Product,
  SelectedOption,
} from '@/types';
import { hasPassed } from './datetime';
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

/**
 * The terms a voucher was granted under — enough to re-decide it at any time.
 *
 * The cart used to keep the *discount* a voucher produced and throw the terms
 * away. That froze the number: apply a 15% code to a R596 basket for R89.40
 * off, then take items out until the basket is R149 — under the code's own
 * R150 minimum — and the R89.40 still came off. A 60% discount on an order
 * that no longer qualified for the voucher at all.
 *
 * Keeping the terms and deriving the discount makes that impossible: the
 * discount is a function of the basket, so it moves with it.
 */
export interface VoucherTerms {
  code: string;
  discountType: 'percentage' | 'fixed' | 'freeItem' | 'freeDelivery';
  /**
   * Which product a `freeItem` voucher makes free. See `Voucher.freeProductId`.
   *
   * Carried in the terms rather than looked up, for the same reason every
   * other term is: the discount is a function of the basket and the terms
   * travel with the cart.
   */
  freeProductId?: string;
  discountValue: number;
  minimumSpend: number;
  /**
   * ISO date the voucher stops being worth anything. Optional, and absent
   * means it never expires.
   *
   * These terms deliberately hold what a voucher *asks for* rather than what
   * it was once worth — and this was the one term left out. Expiry was checked
   * exactly once, as the code was typed, against a boolean stamped at fetch
   * time; after that the cart had no way to know. Driven in a browser: apply
   * SPICY15, move the clock on eight days, and it was still taken at checkout
   * and printed on the confirmation as "Promo discount −R 31.35" — R 214.65
   * charged against R 246.00 owed, six days after the voucher died.
   */
  expiresAt?: string;
}

/**
 * The terms to hold, taken off the voucher the customer chose.
 *
 * There are two doors into the cart's voucher slot — typing a code in the cart
 * and tapping a card on the vouchers screen — and each wrote this object out
 * by hand. The cart's copy carried `expiresAt`; the vouchers screen's copy
 * listed four fields and stopped. So a voucher tapped rather than typed
 * reached the basket with no date on it, `voucherExpired` had nothing to read,
 * and the guard above — built, tested and driven in a browser — was simply not
 * there on that path. Tap SPICY15 today, order in eight days, and the discount
 * still comes off.
 *
 * The two copies could not disagree in any way a type would catch, because
 * every field they share is spelled the same and the missing one is optional.
 * Deriving the object once removes the possibility rather than the instance:
 * a term added to `VoucherTerms` is now carried through both doors or through
 * neither.
 */
export function voucherTerms(voucher: {
  code: string;
  discountType: VoucherTerms['discountType'];
  discountValue: number;
  minimumSpend: number;
  expiresAt?: string;
}): VoucherTerms {
  return {
    code: voucher.code,
    discountType: voucher.discountType,
    discountValue: voucher.discountValue,
    minimumSpend: voucher.minimumSpend,
    ...(voucher.expiresAt ? { expiresAt: voucher.expiresAt } : {}),
  };
}

/** Whether the voucher is past its date. No date means it never is. */
export function voucherExpired(voucher: VoucherTerms, now: Date = new Date()): boolean {
  return hasPassed(voucher.expiresAt, now);
}

/**
 * Whether the basket still meets what the voucher asked for.
 *
 * The single gate: `voucherDiscount` and `voucherFreesDelivery` both come
 * through here, so a rule added once applies to both kinds of voucher.
 */
export function voucherQualifies(
  voucher: VoucherTerms,
  subtotal: number,
  now: Date = new Date(),
  lines: CartLine[] = [],
): boolean {
  return voucherBlocker(voucher, subtotal, now, lines) === null;
}

/**
 * What is stopping this voucher being worth anything, or nothing.
 *
 * Three different things, asking three different things of the customer, and
 * the cart screen had copy for two of them. A `freeItem` voucher wants a
 * particular product in the basket, and without it `voucherDiscount` returns
 * zero while `voucherQualifies` — which only knew about spend and expiry —
 * went on saying yes. The cart would then have printed "R 0.00 off applied"
 * under a green tick, which is the same class of untruth as the "Free item"
 * label that started this.
 *
 * Returned as a reason rather than a boolean so the screen can say which one
 * it is: an expired code cannot be fixed at all, a minimum can be fixed by
 * adding anything, and a missing item can only be fixed by adding that item.
 */
export function voucherBlocker(
  voucher: VoucherTerms,
  subtotal: number,
  now: Date = new Date(),
  lines: CartLine[] = [],
): 'expired' | 'minimum' | 'missingItem' | null {
  if (voucherExpired(voucher, now)) return 'expired';
  if (subtotal < voucher.minimumSpend) return 'minimum';
  if (
    voucher.discountType === 'freeItem' &&
    !lines.some((line) => line.productId === voucher.freeProductId)
  ) {
    return 'missingItem';
  }
  return null;
}

/**
 * Rand a voucher removes from a given subtotal, or nothing when the basket no
 * longer qualifies. The single implementation of this rule — rewardsService
 * validates codes through it too, so a voucher cannot be worth one amount at
 * the moment it is entered and another at checkout.
 */
export function voucherDiscount(
  voucher: VoucherTerms,
  subtotal: number,
  now: Date = new Date(),
  /**
   * The basket, for the one mechanic whose worth is a thing in it rather than
   * a number on the voucher. Optional so the four call sites that only have a
   * subtotal keep working; a `freeItem` voucher without them is worth nothing,
   * which is the safe direction — it charges full price rather than taking
   * money off for an item nobody put in.
   */
  lines: CartLine[] = [],
): number {
  if (!voucherQualifies(voucher, subtotal, now, lines)) return 0;

  switch (voucher.discountType) {
    case 'fixed':
      return Math.min(voucher.discountValue, subtotal);
    /**
     * The price of the item, not a rand amount that happens to sit beside it.
     *
     * This shared the `fixed` case, so a voucher the wallet advertised as
     * "Free item" took `Math.min(discountValue, subtotal)` off — and nothing
     * on `Voucher` said which item was meant, so the two numbers could not
     * agree even in principle. A free French Fries against a `discountValue`
     * of 0 was worth nothing at all; against 62 it would have discounted a
     * basket containing no fries.
     *
     * One unit, at the price actually charged for it — `unitPrice` includes
     * the options chosen, so a large fries is worth more than a regular one,
     * which is what "free fries" means to somebody who ordered a large. The
     * cheapest matching line when there are several, so a voucher for one item
     * cannot be spent on the dearest configuration of it by accident.
     */
    case 'freeItem': {
      const matching = lines.filter((line) => line.productId === voucher.freeProductId);
      if (matching.length === 0) return 0;
      return Math.min(Math.min(...matching.map((line) => line.unitPrice)), subtotal);
    }
    case 'percentage':
      return Math.round(subtotal * (voucher.discountValue / 100) * 100) / 100;
    case 'freeDelivery':
      // Carried by the delivery fee, not the subtotal.
      return 0;
  }
}

/** Free delivery only stands while the basket still qualifies. */
export function voucherFreesDelivery(
  voucher: VoucherTerms,
  subtotal: number,
  now: Date = new Date(),
): boolean {
  return voucher.discountType === 'freeDelivery' && voucherQualifies(voucher, subtotal, now);
}

/** What a redeemed reward is, as far as the bill is concerned. */
export interface RewardTerms {
  /**
   * Optional because a basket persisted before rewards knew their own
   * category will not have one. Missing is read as a flat rand discount,
   * which is what every reward did before this existed.
   */
  category?: 'food' | 'discount' | 'delivery' | 'birthday';
  discount: number;
}

/**
 * How a reward reaches the bill.
 *
 * "Free Delivery" was a flat R32 off, applied whatever the order was, and
 * `calculateTotals` caps a reward against the subtotal rather than against the
 * fee it is meant to cover. So it came off the food when there was no delivery
 * to pay for:
 *
 *     COLLECT  : deliveryFee 0, rewardsDiscount 32 → R122 instead of R154
 *     OVER R350: deliveryFee 0, rewardsDiscount 32 → R420 instead of R452
 *
 * Somebody collecting their own order spent 300 points and got R32 off
 * chicken they carried home themselves; somebody whose basket already cleared
 * the free-delivery threshold got R32 for a fee nobody was charging. Both are
 * bb.q paying out for a benefit it is not providing, and the reward says
 * plainly what it is: "We cover the delivery fee on your next order."
 *
 * So a delivery reward now frees the fee — the same route `voucherFreesDelivery`
 * already takes — and is worth nothing when there is no fee. Whether that is
 * worth telling the customer before they spend the points is a question for the
 * screens; this only says what the bill does.
 */
export function rewardEffect(
  reward: RewardTerms | null | undefined,
  fulfilmentType: FulfilmentType,
): { rewardsDiscount: number; freeDelivery: boolean } {
  if (!reward) return { rewardsDiscount: 0, freeDelivery: false };

  if (reward.category === 'delivery') {
    return { rewardsDiscount: 0, freeDelivery: fulfilmentType === 'delivery' };
  }

  return { rewardsDiscount: reward.discount, freeDelivery: false };
}

/**
 * The bill for a basket, and what the reward took off it.
 *
 * One function, because working out how a voucher and a reward reach the
 * totals was being assembled at the call site — and the moment there were two
 * call sites they disagreed. The reward's worth in particular has to be
 * measured as the difference it makes to the total, not read back from what it
 * was worth when it was redeemed: that is the mistake the voucher used to make,
 * and a "Free Delivery" reward is worth the fee when there is one and nothing
 * at all when there is not.
 */
export interface BasketInput {
  lines: CartLine[];
  fulfilmentType: FulfilmentType;
  voucher?: VoucherTerms | null;
  reward?: RewardTerms | null;
  now?: Date;
}

export function priceBasket({
  lines,
  fulfilmentType,
  voucher = null,
  reward = null,
  now = new Date(),
}: BasketInput): { totals: CartTotals; rewardWorth: number } {
  const subtotal = sumRand(lines.map((line) => line.lineTotal));

  // The voucher's worth is recomputed against the basket as it stands, never
  // read back from what it was worth when it was entered.
  const voucherOff = voucher ? voucherDiscount(voucher, subtotal, now, lines) : 0;
  const voucherFreesIt = voucher !== null && voucherFreesDelivery(voucher, subtotal, now);

  const applied = rewardEffect(reward, fulfilmentType);

  const withoutReward = calculateTotals({
    lines,
    fulfilmentType,
    voucherDiscount: voucherOff,
    ...(voucherFreesIt ? { deliveryFeeOverride: 0 } : {}),
  });

  const totals = calculateTotals({
    lines,
    fulfilmentType,
    voucherDiscount: voucherOff,
    rewardsDiscount: applied.rewardsDiscount,
    ...(voucherFreesIt || applied.freeDelivery ? { deliveryFeeOverride: 0 } : {}),
  });

  return {
    /*
      The reason, kept rather than discarded. `voucherFreesIt` is worked out
      here and was used only to zero the fee, so the receipt was left printing
      "Free" with no way to say whether the code did it or the basket simply
      cleared R350. Only when the voucher is what did it: a basket over the
      threshold is free on its own account, code or no code.
    */
    totals: voucherFreesIt ? { ...totals, deliveryFreedByVoucher: true } : totals,
    rewardWorth: Math.max(0, sumRand([withoutReward.total, -totals.total])),
  };
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
export type DroppedReason = 'off-menu' | 'unavailable' | 'option-gone' | 'options-changed';

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

    // Every chosen option still exists — but the rules about how many you may
    // choose can move too. A group whose `maxSelect` drops from three to one,
    // or whose `minSelect` rises from nought to one, leaves an old line
    // carrying a combination the kitchen can no longer make, priced with
    // whatever surcharges it was built with.
    //
    // This function's whole job is bringing a saved basket back into agreement
    // with the menu, and it was checking that the options exist without
    // checking that the selection is still legal. Reorder walks the same data
    // — it re-adds the options an old order was placed with — so both routes
    // were carrying it.
    const chosenPerGroup = new Map<string, number>();
    for (const option of currentOptions) {
      chosenPerGroup.set(option.groupId, (chosenPerGroup.get(option.groupId) ?? 0) + 1);
    }

    const selectionIllegal = product.optionGroups.some((group) => {
      const chosen = chosenPerGroup.get(group.id) ?? 0;
      return chosen < group.minSelect || chosen > group.maxSelect;
    });

    if (selectionIllegal) {
      dropped.push({ line, reason: 'options-changed' });
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
