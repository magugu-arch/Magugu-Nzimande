import type {
  LoyaltyAccount,
  MenuSnapshot,
  Order,
  Product,
  Reward,
  Store,
  TierDefinition,
  Voucher,
} from '@/types';

/**
 * What has to be true of a response before the app is allowed to believe it.
 *
 * `request<T>` casts the parsed JSON to `T`. Every type in `src/types` is a
 * promise about the wire that nothing checks, which is fine while the mock is
 * the only source and stops being fine the day a real endpoint answers. It has
 * already produced three holes, each patched at the consumer:
 *
 *   - a store's coordinates interpolated into a maps URL unchecked
 *   - `deliveryRange` measuring `NaN` and reading it as out of range
 *   - `directionsTargetFor` routing to `0, 0`
 *
 * And one that no consumer could patch: `formatPrice` rendered anything
 * non-finite as `R 0.00`, so a backend returning money as strings — which is
 * ordinary, and done precisely to keep float precision off the wire — put
 * `R 0.00` on every menu tile while the arithmetic coerced correctly and
 * charged the real amount.
 *
 * This is the boundary version. It is deliberately **not** a schema: a schema
 * per endpoint has to be maintained alongside the type and drifts from it
 * silently, and a strict one rejects a response over a field the app never
 * reads. What each check asserts is only what the app would otherwise get
 * wrong — the numbers it does arithmetic on, the ids it looks things up by.
 * Everything else is left alone and arrives as it always did.
 *
 * A failure becomes one honest error at the fetch, so the screen shows its own
 * "couldn't load" state, rather than a strange number three components away.
 */
export class MalformedResponse extends Error {
  constructor(readonly detail: string) {
    super(detail);
    this.name = 'MalformedResponse';
  }
}

function fail(where: string, value: unknown): never {
  const seen = value === undefined ? 'nothing' : `${typeof value} ${JSON.stringify(value)}`;
  throw new MalformedResponse(`${where} should be a number, got ${seen}`);
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MalformedResponse(`${where} should be an object`);
  }
  return value as Record<string, unknown>;
}

function items(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new MalformedResponse(`${where} should be a list`);
  return value;
}

/**
 * A number the app can do arithmetic with and print.
 *
 * Strict rather than coercing. `"129.00"` could be turned into 129 here and
 * everything would work — but silently accepting it means the next field the
 * backend stringifies is one nobody notices, and it makes this file responsible
 * for guessing what a value was meant to be. Saying so once, loudly, at the
 * fetch is the whole point.
 */
function number(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(where, value);
  return value;
}

/** Optional, and absent is fine — but present and unusable is not. */
function optionalNumber(value: unknown, where: string): void {
  if (value === undefined || value === null) return;
  number(value, where);
}

function text(value: unknown, where: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new MalformedResponse(`${where} should be a non-empty string`);
  }
}

/* -------------------------------------------------------------------------- */

function checkProduct(value: unknown, where: string): void {
  const product = record(value, where);
  text(product.id, `${where}.id`);
  text(product.name, `${where}.name`);
  // Every price a customer sees on the menu comes from here.
  number(product.basePrice, `${where}.basePrice`);

  for (const [index, rawGroup] of items(
    product.optionGroups ?? [],
    `${where}.optionGroups`,
  ).entries()) {
    const group = record(rawGroup, `${where}.optionGroups[${index}]`);
    for (const [option, rawOption] of items(
      group.options ?? [],
      `${where}.optionGroups[${index}].options`,
    ).entries()) {
      const at = `${where}.optionGroups[${index}].options[${option}]`;
      // A surcharge that cannot be added is a surcharge the customer is
      // charged and never shown.
      number(record(rawOption, at).priceDelta, `${at}.priceDelta`);
    }
  }
}

export function checkedProduct(value: unknown): Product {
  checkProduct(value, 'product');
  return value as Product;
}

export function checkedMenu(value: unknown): MenuSnapshot {
  const menu = record(value, 'menu');
  for (const [index, product] of items(menu.products, 'menu.products').entries()) {
    checkProduct(product, `menu.products[${index}]`);
  }
  return value as MenuSnapshot;
}

function checkOrder(value: unknown, where: string): void {
  const order = record(value, where);
  text(order.id, `${where}.id`);

  // The bill. Checked field by field because a total the app cannot read is
  // the one number a customer is entitled to see correctly.
  const totals = record(order.totals, `${where}.totals`);
  for (const field of ['subtotal', 'deliveryFee', 'serviceFee', 'discount', 'total']) {
    number(totals[field], `${where}.totals.${field}`);
  }
  optionalNumber(totals.rewardsDiscount, `${where}.totals.rewardsDiscount`);
  optionalNumber(totals.pointsEarned, `${where}.totals.pointsEarned`);

  // Drives the countdown on the screen a hungry person watches.
  number(order.etaMinutes, `${where}.etaMinutes`);

  // Optional since the record stopped carrying `0, 0` for a branch it does not
  // know; present and unreadable would put a maps pin in the sea.
  optionalNumber(order.storeLatitude, `${where}.storeLatitude`);
  optionalNumber(order.storeLongitude, `${where}.storeLongitude`);
}

export function checkedOrder(value: unknown): Order {
  checkOrder(value, 'order');
  return value as Order;
}

export function checkedOrders(value: unknown): Order[] {
  for (const [index, order] of items(value, 'orders').entries()) {
    checkOrder(order, `orders[${index}]`);
  }
  return value as Order[];
}

function checkStore(value: unknown, where: string): void {
  const store = record(value, where);
  text(store.id, `${where}.id`);
  text(store.name, `${where}.name`);
  // Decides whether a customer is offered delivery at all, and where a maps
  // app is pointed.
  number(store.latitude, `${where}.latitude`);
  number(store.longitude, `${where}.longitude`);
  number(store.deliveryRadiusKm, `${where}.deliveryRadiusKm`);
}

export function checkedStore(value: unknown): Store {
  checkStore(value, 'store');
  return value as Store;
}

export function checkedStores(value: unknown): Store[] {
  for (const [index, store] of items(value, 'stores').entries()) {
    checkStore(store, `stores[${index}]`);
  }
  return value as Store[];
}

export function checkedLoyaltyAccount(value: unknown): LoyaltyAccount {
  const account = record(value, 'loyalty');
  // The balance a customer spends rewards against.
  number(account.pointsBalance, 'loyalty.pointsBalance');
  optionalNumber(account.lifetimePoints, 'loyalty.lifetimePoints');
  return value as LoyaltyAccount;
}

/* -------------------------------------------------------------------------- */
/*
  The loyalty side, added after `audit:wire` drove it.

  That sweep points a production bundle at a stub backend and bends one field
  at a time — money as a string, a list wrapped in an envelope, a null where an
  array was promised. Each is a thing a competent backend team ships on
  purpose, and every one of them reached a screen unexamined: ten of the
  forty-eight `request<T>` calls carried a `parse`, and none of the loyalty
  ones did.

  Worth recording how the first run of that sweep misled me, because it is the
  failure this file exists to prevent, committed by the tool written to find
  it. Its stub answered `/v1/loyalty/tiers` with `{ id, minPoints }` — invented
  field names, not the ones in `types/rewards.ts` — so every case failed for
  the baseline's reasons and the sweep reported five crashed screens. The app
  had not crashed. A stub that is wrong everywhere proves only that the app
  dislikes rubbish. Against a baseline written field-for-field from the types,
  nothing crashed at all, and the real defect turned out to be quieter and
  worse: see `(tabs)/rewards.tsx`.
*/

function checkReward(value: unknown, where: string): void {
  const reward = record(value, where);
  text(reward.id, `${where}.id`);
  // Points a member spends, and rand off a bill. Both are arithmetic, and
  // both are printed beside a button that takes something away for good.
  number(reward.pointsCost, `${where}.pointsCost`);
  number(reward.discountValue, `${where}.discountValue`);
}

export function checkedRewards(value: unknown): Reward[] {
  for (const [index, reward] of items(value, 'rewards').entries()) {
    checkReward(reward, `rewards[${index}]`);
  }
  return value as Reward[];
}

/**
 * The redemption itself, which is the moment the points actually leave.
 *
 * `discount` is not read off the reward — a delivery reward is worth the fee
 * when there is one and nothing at all when there is not — so it is a separate
 * number on the wire and needs its own check.
 */
export function checkedRedemption(value: unknown): { reward: Reward; discount: number } {
  const redemption = record(value, 'redemption');
  checkReward(redemption.reward, 'redemption.reward');
  number(redemption.discount, 'redemption.discount');
  return value as { reward: Reward; discount: number };
}

/**
 * The tier ladder.
 *
 * `pointsPerRand` is the number every points figure in the app is multiplied
 * by — the basket's "you'll earn", the confirmation, the balance a member
 * watches. A string here does not throw where it is used, because `*` coerces;
 * it throws two components away, or worse, does not.
 */
export function checkedTiers(value: unknown): TierDefinition[] {
  for (const [index, raw] of items(value, 'tiers').entries()) {
    const tier = record(raw, `tiers[${index}]`);
    text(tier.name, `tiers[${index}].name`);
    number(tier.threshold, `tiers[${index}].threshold`);
    number(tier.pointsPerRand, `tiers[${index}].pointsPerRand`);
  }
  return value as TierDefinition[];
}

/**
 * A promo code the customer just typed, answered by the server.
 *
 * `discount` is what comes off the bill on the next screen. The voucher inside
 * carries its own two figures, and they are checked by the same rule the
 * wallet's are.
 */
export function checkedVoucherValidation<T>(value: unknown): T {
  const result = record(value, 'voucherValidation');
  number(result.discount, 'voucherValidation.discount');
  checkVoucher(result.voucher, 'voucherValidation.voucher');
  return value as T;
}

function checkVoucher(value: unknown, where: string): void {
  const voucher = record(value, where);
  text(voucher.code, `${where}.code`);
  // Both feed the discount that comes off a bill.
  number(voucher.discountValue, `${where}.discountValue`);
  number(voucher.minimumSpend, `${where}.minimumSpend`);
}

export function checkedVouchers(value: unknown): Voucher[] {
  for (const [index, raw] of items(value, 'vouchers').entries()) {
    checkVoucher(raw, `vouchers[${index}]`);
  }
  return value as Voucher[];
}
