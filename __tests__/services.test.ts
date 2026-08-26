import {
  fetchBestSellers,
  fetchCategories,
  fetchMenu,
  fetchProduct,
  fetchProductsByCategory,
  fetchProductsByIds,
  searchProducts,
} from '@/services/menuService';
import {
  fetchNearestStore,
  fetchStores,
  fetchStoresForFulfilment,
  isStoreOpenAt,
} from '@/services/storeService';
import {
  cancelOrder,
  fetchActiveOrder,
  fetchOrder,
  fetchOrders,
  minutesUntilDue,
  placeOrder,
  rateOrder,
  readyLabelFor,
  statusSequence,
  workStartsAt,
} from '@/services/orderService';
import {
  discountFor,
  fetchActiveVouchers,
  fetchLoyaltyAccount,
  fetchRewards,
  fetchVouchers,
  rewardExpired,
  validateVoucherCode,
} from '@/services/rewardsService';
import {
  authorisePayment,
  isSettledOnDelivery,
  requiresRedirect,
  voidPayment,
} from '@/services/paymentService';
import { createAddress, fetchPaymentMethods } from '@/services/accountService';
import { signIn, signOut as signOutService, updateProfile } from '@/services/authService';
import { stores } from '@/services/data/storeData';
import { vouchers } from '@/services/data/rewardsData';
import type { Order, Reward, Voucher } from '@/types';
import { DEFAULT_COORDINATES, distanceKm, formatDistance } from '@/utils/geo';

describe('menuService', () => {
  it('returns categories in sort order', async () => {
    const categories = await fetchCategories();
    const orders = categories.map((category) => category.sortOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it('filters products by category', async () => {
    const sides = await fetchProductsByCategory('sides');
    expect(sides.length).toBeGreaterThan(0);
    sides.forEach((product) => expect(product.categoryId).toBe('sides'));
  });

  it('finds a product by id or slug', async () => {
    const byId = await fetchProduct('golden-original');
    const bySlug = await fetchProduct('golden-original-chicken');
    expect(byId.id).toBe('golden-original');
    expect(bySlug.id).toBe('golden-original');
  });

  it('rejects an unknown product', async () => {
    await expect(fetchProduct('does-not-exist')).rejects.toThrow();
  });

  it('preserves the caller ordering when fetching by ids', async () => {
    const products = await fetchProductsByIds(['french-fries', 'golden-original']);
    expect(products.map((product) => product.id)).toEqual(['french-fries', 'golden-original']);
  });

  it('drops unknown ids rather than returning holes', async () => {
    const products = await fetchProductsByIds(['golden-original', 'ghost']);
    expect(products).toHaveLength(1);
  });

  it('searches case-insensitively across name and tags', async () => {
    const results = await searchProducts('HONEY');
    expect(results.some((product) => product.id === 'honey-garlic')).toBe(true);

    const spicy = await searchProducts('spicy');
    expect(spicy.length).toBeGreaterThan(0);
  });

  it('returns nothing for an empty query', async () => {
    expect(await searchProducts('   ')).toEqual([]);
  });

  it('returns only tagged bestsellers, respecting the limit', async () => {
    const bestSellers = await fetchBestSellers(2);
    expect(bestSellers).toHaveLength(2);
    bestSellers.forEach((product) => expect(product.tags).toContain('bestseller'));
  });

  it('stamps the snapshot with an update time', async () => {
    const menu = await fetchMenu();
    expect(Number.isNaN(new Date(menu.updatedAt).getTime())).toBe(false);
  });
});

describe('storeService', () => {
  it('sorts stores by distance from the origin', async () => {
    const list = await fetchStores(DEFAULT_COORDINATES);
    const distances = list.map((store) => store.distanceKm);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });

  it('recomputes distance rather than trusting the seed value', async () => {
    const capeTown = { latitude: -33.9036, longitude: 18.4201 };
    const list = await fetchStores(capeTown);
    expect(list[0]?.city).toBe('Cape Town');
  });

  it('filters by fulfilment support', async () => {
    const dineIn = await fetchStoresForFulfilment('dinein', DEFAULT_COORDINATES);
    expect(dineIn.length).toBeGreaterThan(0);
    dineIn.forEach((store) => expect(store.supportsDineIn).toBe(true));
  });

  it('returns the nearest store for a fulfilment type', async () => {
    const nearest = await fetchNearestStore(DEFAULT_COORDINATES, 'delivery');
    expect(nearest?.supportsDelivery).toBe(true);
  });

  it('reports opening state against trading hours', () => {
    const store = stores[0];
    expect(store).toBeDefined();
    // Sandton trades 11:00–22:00 on a Monday.
    const monday = new Date(2026, 0, 5, 14, 0);
    const earlyMorning = new Date(2026, 0, 5, 6, 0);
    expect(isStoreOpenAt(store!, monday)).toBe(true);
    expect(isStoreOpenAt(store!, earlyMorning)).toBe(false);
  });
});

describe('geo', () => {
  it('measures distance between two points', () => {
    const johannesburg = { latitude: -26.2041, longitude: 28.0473 };
    const capeTown = { latitude: -33.9249, longitude: 18.4241 };
    // Great-circle distance is roughly 1 260 km.
    expect(distanceKm(johannesburg, capeTown)).toBeGreaterThan(1200);
    expect(distanceKm(johannesburg, capeTown)).toBeLessThan(1320);
  });

  it('returns zero for the same point', () => {
    expect(distanceKm(DEFAULT_COORDINATES, DEFAULT_COORDINATES)).toBe(0);
  });

  it('formats sub-kilometre distances in metres', () => {
    expect(formatDistance(0.4)).toBe('400 m');
    expect(formatDistance(2.35)).toBe('2.4 km');
  });
});

describe('orderService', () => {
  it('includes the delivery leg only for delivery orders', () => {
    expect(statusSequence('delivery')).toContain('out_for_delivery');
    expect(statusSequence('collection')).not.toContain('out_for_delivery');
    expect(statusSequence('dinein')).not.toContain('out_for_delivery');
  });

  it('labels the ready step per fulfilment type', () => {
    expect(readyLabelFor('delivery')).toBe('Out for delivery');
    expect(readyLabelFor('collection')).toBe('Ready for collection');
    expect(readyLabelFor('dinein')).toBe('Ready at your table');
  });

  it('places an order in the received state with a full timeline', async () => {
    const order = await placeOrder({
      lines: [],
      totals: {
        subtotal: 200,
        deliveryFee: 32,
        serviceFee: 5,
        discount: 0,
        rewardsDiscount: 0,
        total: 237,
        pointsEarned: 200,
      },
      fulfilmentType: 'delivery',
      storeId: 'store-sandton',
      addressId: 'address-home',
      paymentMethodId: 'payment-visa',
      paymentMethodType: 'card',
    });

    expect(order.status).toBe('received');
    expect(order.reference).toMatch(/^BBQ-\d+$/);
    expect(order.timeline).toHaveLength(statusSequence('delivery').length);
    expect(order.timeline[0]?.occurredAt).not.toBeNull();
    expect(order.timeline.at(-1)?.occurredAt).toBeNull();
    expect(order.addressSummary).toBeDefined();
    expect(order.paymentMethodLabel).toBe('Visa ending 4821');
  });

  /**
   * The order used to carry the store's name and nothing else, so the tracking
   * screen's "Call the store" dialled `tel:bb.q Chicken Sandton City`. The
   * snapshot has to agree with the store record, not merely exist.
   */
  it('carries the branch a customer would have to phone or drive to', async () => {
    const [store] = await fetchStores();
    expect(store).toBeDefined();

    const order = await placeOrder({
      lines: [],
      totals: {
        subtotal: 200,
        deliveryFee: 0,
        serviceFee: 5,
        discount: 0,
        rewardsDiscount: 0,
        total: 205,
        pointsEarned: 200,
      },
      fulfilmentType: 'collection',
      storeId: store!.id,
      paymentMethodId: 'payment-visa',
      paymentMethodType: 'card',
    });

    expect(order.storeName).toBe(store!.name);
    expect(order.storePhone).toBe(store!.phone);
    expect(order.storeAddress).toContain(store!.addressLine);
    expect(order.storeLatitude).toBe(store!.latitude);
    expect(order.storeLongitude).toBe(store!.longitude);
  });

  it('gives seeded history the same branch details as a fresh order', async () => {
    const orders = await fetchOrders();
    const stores = await fetchStores();

    // Seeded orders are written by hand in the service. Left to drift they
    // would show a phone number no longer belonging to that branch.
    for (const order of orders) {
      const store = stores.find((candidate) => candidate.id === order.storeId);
      if (!store) continue;
      expect(order.storePhone).toBe(store.phone);
      expect(order.storeName).toBe(store.name);
    }
  });

  it('surfaces the newly placed order as the active one', async () => {
    const active = await fetchActiveOrder();
    expect(active).not.toBeNull();
    expect(active?.status).not.toBe('completed');
  });

  it('seeds order history alongside live orders', async () => {
    const orders = await fetchOrders();
    expect(orders.some((order) => order.status === 'completed')).toBe(true);
  });
});

describe('rewardsService', () => {
  const fixed: Voucher = {
    id: 'v1',
    code: 'FIXED',
    title: '',
    description: '',
    discountType: 'fixed',
    discountValue: 50,
    minimumSpend: 0,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    used: false,
    expired: false,
  };

  it('caps a fixed discount at the subtotal', () => {
    expect(discountFor(fixed, 200)).toBe(50);
    expect(discountFor(fixed, 30)).toBe(30);
  });

  it('computes a percentage discount', () => {
    expect(discountFor({ ...fixed, discountType: 'percentage', discountValue: 15 }, 200)).toBe(30);
  });

  it('takes nothing off the subtotal for free delivery', () => {
    expect(discountFor({ ...fixed, discountType: 'freeDelivery', discountValue: 0 }, 200)).toBe(0);
  });

  it('validates a real code above its minimum spend', async () => {
    const result = await validateVoucherCode('welcome50', 250);
    expect(result.voucher.code).toBe('WELCOME50');
    expect(result.discount).toBe(50);
  });

  it('rejects an unknown code', async () => {
    await expect(validateVoucherCode('NOPE', 500)).rejects.toThrow(/recognise/i);
  });

  it('rejects a code below its minimum spend', async () => {
    await expect(validateVoucherCode('WELCOME50', 50)).rejects.toThrow(/at least/i);
  });

  it('rejects an already-used code', async () => {
    const usedVoucher = vouchers.find((voucher) => voucher.used);
    expect(usedVoucher).toBeDefined();
    await expect(validateVoucherCode(usedVoucher!.code, 500)).rejects.toThrow();
  });

  it('rejects an empty code', async () => {
    await expect(validateVoucherCode('  ', 500)).rejects.toThrow(/enter a promo code/i);
  });

  it('stamps expiry at fetch time so screens never read the clock', async () => {
    const list = await fetchVouchers();
    expect(list.length).toBeGreaterThan(0);
    list.forEach((voucher) => {
      expect(typeof voucher.expired).toBe('boolean');
      expect(voucher.expired).toBe(new Date(voucher.expiresAt).getTime() <= Date.now());
    });
  });

  it('returns only usable vouchers as active', async () => {
    const active = await fetchActiveVouchers();
    active.forEach((voucher) => {
      expect(voucher.used).toBe(false);
      expect(voucher.expired).toBe(false);
    });
  });
});

describe('paymentService', () => {
  it('identifies redirect rails', () => {
    expect(requiresRedirect('eft')).toBe(true);
    expect(requiresRedirect('snapscan')).toBe(true);
    expect(requiresRedirect('card')).toBe(false);
  });

  it('identifies rails settled at handover', () => {
    expect(isSettledOnDelivery('cash')).toBe(true);
    expect(isSettledOnDelivery('card')).toBe(false);
  });

  it('short-circuits authorisation for cash', async () => {
    const result = await authorisePayment({
      amount: 237,
      paymentMethodId: 'payment-cash',
      methodType: 'cash',
      orderReference: 'BBQ-1',
    });
    expect(result).toEqual({ success: true, intentId: 'cash' });
  });

  /**
   * Checkout authorises the card and then creates the order. Anything between
   * the two — a dropped connection, a 500, an expired session — used to leave
   * a hold against an order that never existed, with nothing to release it.
   */
  it('releases an authorisation for an order that never happened', async () => {
    const authorisation = await authorisePayment({
      amount: 237,
      paymentMethodId: 'payment-visa',
      methodType: 'card',
      orderReference: 'pending',
    });

    await expect(voidPayment(authorisation.intentId)).resolves.toBe(true);
  });

  it('has nothing to release for cash, which was never authorised', async () => {
    await expect(voidPayment('cash')).resolves.toBe(true);
  });

  it('authorises a card payment and returns an intent id', async () => {
    const result = await authorisePayment({
      amount: 237,
      paymentMethodId: 'payment-visa',
      methodType: 'card',
      orderReference: 'BBQ-1',
    });
    expect(result.success).toBe(true);
    expect(result.intentId).toMatch(/^pi_/);
  });
});

/**
 * `Reward.expiresAt` was declared on the type and printed on the reward screen
 * — "Expires 12 Sep" — and enforced by nothing at all. An app that states a
 * rule and does not keep it is worse than one that never mentioned it: the
 * customer reads the date, believes it, and gets the reward regardless.
 *
 * No seeded reward carries a date yet, so this is the check that stops the
 * gap re-opening the day one does.
 */
describe('rewardExpired', () => {
  const reward: Reward = {
    id: 'reward-birthday',
    name: 'Birthday treat',
    description: '',
    pointsCost: 0,
    category: 'birthday',
    redeemable: true,
    termsAndConditions: [],
  };

  const now = new Date(2026, 7, 24, 12, 0);

  it('lets a reward with no date through, which is what open-ended means', () => {
    expect(rewardExpired(reward, now)).toBe(false);
  });

  it('holds a reward that still has time on it', () => {
    const live = { ...reward, expiresAt: new Date(2026, 7, 31).toISOString() };
    expect(rewardExpired(live, now)).toBe(false);
  });

  it('refuses one whose date has gone by', () => {
    const lapsed = { ...reward, expiresAt: new Date(2026, 7, 20).toISOString() };
    expect(rewardExpired(lapsed, now)).toBe(true);
  });

  /** Same rule as the voucher: a malformed date is not a reason to take a
   * benefit away from a customer. */
  it('does not expire a reward over an unreadable date', () => {
    const broken = { ...reward, expiresAt: 'next Tuesday-ish' };
    expect(rewardExpired(broken, now)).toBe(false);
  });
});

/**
 * Tracking counted from when the customer paid and ignored `scheduledFor`
 * entirely. An order booked for tomorrow at 18:00 and paid for at 14:00 today
 * read "Completed — Enjoy. Thanks for ordering with bb.q." by 14:42 the same
 * afternoon, and fell out of Active into Past orders. Verified in a browser.
 *
 * Scheduling stopped being an edge case the moment closed branches began
 * telling customers to schedule, which is now the app's standard answer
 * outside trading hours.
 */
describe('workStartsAt', () => {
  const base = {
    id: 'order-1',
    reference: 'BBQ-1',
    placedAt: new Date(2026, 7, 24, 14, 0).toISOString(),
    fulfilmentType: 'delivery',
    status: 'received',
    timeline: [],
    lines: [],
    totals: {} as never,
    storeId: 's1',
    storeName: 'bb.q Chicken Rosebank',
    storePhone: '011 447 2200',
    storeAddress: '177 Oxford Rd',
    storeLatitude: -26.1465,
    storeLongitude: 28.0436,
    paymentMethodLabel: 'Card',
    etaMinutes: 42,
  } as unknown as Order;

  it('starts an ASAP order the moment it is placed', () => {
    expect(workStartsAt(base).toISOString()).toBe(base.placedAt);
  });

  /** Ready when the customer asked for it, not the instant they paid. */
  it('works back from the slot for a scheduled order', () => {
    const scheduled = {
      ...base,
      scheduledFor: new Date(2026, 7, 25, 18, 0).toISOString(),
    } as Order;

    // 42 minutes before 18:00 tomorrow.
    expect(workStartsAt(scheduled).toISOString()).toBe(new Date(2026, 7, 25, 17, 18).toISOString());
  });

  /**
   * A slot inside the preparation window would otherwise start the kitchen's
   * clock before the order existed.
   */
  it('never starts before the order was placed', () => {
    const soon = {
      ...base,
      scheduledFor: new Date(2026, 7, 24, 14, 10).toISOString(),
    } as Order;

    expect(workStartsAt(soon).toISOString()).toBe(base.placedAt);
  });

  it('falls back to the placed time on an unreadable slot', () => {
    const broken = { ...base, scheduledFor: 'tomorrow evening' } as Order;
    expect(workStartsAt(broken).toISOString()).toBe(base.placedAt);
  });
});

/**
 * The helper above is only half the story — the bug was that `advance` never
 * called it. This drives the whole path: place a scheduled order, let
 * three quarters of an hour go by, and read it back the way the tracking
 * screen does.
 */
describe('tracking a scheduled order', () => {
  const totals = {
    subtotal: 200,
    deliveryFee: 32,
    serviceFee: 5,
    discount: 0,
    rewardsDiscount: 0,
    total: 237,
    pointsEarned: 200,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is still "received" 45 minutes later when the slot is tomorrow', async () => {
    const placed = await placeOrder({
      lines: [],
      totals,
      fulfilmentType: 'delivery',
      storeId: 'store-sandton',
      paymentMethodId: 'pm-1',
      paymentMethodType: 'card',
      scheduledFor: new Date(Date.now() + 28 * 3_600_000).toISOString(),
    });

    expect(placed.status).toBe('received');

    // Three quarters of an hour passes. Long enough to have finished an ASAP
    // order twice over — this one is not due until tomorrow.
    const later = Date.now() + 45 * 60_000;
    jest.spyOn(Date, 'now').mockReturnValue(later);

    const tracked = await fetchOrder(placed.id);
    expect(tracked.status).toBe('received');

    // And it stays out of the finished pile, which is where it was landing.
    expect(tracked.status).not.toBe('completed');
  });

  it('still marches an ASAP order along on the same clock', async () => {
    const placed = await placeOrder({
      lines: [],
      totals,
      fulfilmentType: 'delivery',
      storeId: 'store-sandton',
      paymentMethodId: 'pm-1',
      paymentMethodType: 'card',
    });

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 45 * 60_000);

    const tracked = await fetchOrder(placed.id);
    expect(tracked.status).toBe('completed');
  });
});

/**
 * The mock resolved an order's address and payment method against the seeded
 * arrays its ledgers were *initialised* from, which is a different thing the
 * moment anybody adds anything. Two failures came out of that, both landing on
 * the confirmation screen — the one a customer reads to check the app
 * understood them.
 *
 * Driven as somebody who installed the app that morning:
 *
 *     the confirmation does not name the address they typed —
 *     it says "Your address"
 */
describe('what a placed order records about itself', () => {
  const totals = {
    subtotal: 200,
    deliveryFee: 32,
    serviceFee: 5,
    discount: 0,
    rewardsDiscount: 0,
    total: 237,
    pointsEarned: 200,
  };

  it('names an address the customer added, not only a seeded one', async () => {
    const added = await createAddress({
      label: 'Home',
      line1: '14 Acacia Road',
      suburb: 'Rosebank',
      city: 'Johannesburg',
      province: 'Gauteng',
      postalCode: '2196',
      latitude: -26.1446,
      longitude: 28.0424,
      isDefault: false,
    });

    const order = await placeOrder({
      lines: [],
      totals,
      fulfilmentType: 'delivery',
      storeId: 'store-sandton',
      addressId: added.id,
      paymentMethodId: 'payment-visa',
      paymentMethodType: 'card',
    });

    expect(order.addressId).toBe(added.id);
    expect(order.addressSummary).toBe('14 Acacia Road, Rosebank');
  });

  /**
   * Cash, SnapScan and instant EFT are rails bb.q accepts rather than things a
   * customer saves, so their ids match nothing in any ledger. The label fell
   * back to a flat 'Card' — so an order somebody is paying for at their own
   * front door came back reading "Paid with: Card".
   */
  it('names the rail when there is no saved method to name', async () => {
    const order = await placeOrder({
      lines: [],
      totals,
      fulfilmentType: 'delivery',
      storeId: 'store-sandton',
      paymentMethodId: 'rail-cash',
      paymentMethodType: 'cash',
    });

    expect(order.paymentMethodLabel).toBe('Cash on delivery');
  });

  it('still prefers the label on a saved card, which says which card', async () => {
    const [saved] = await fetchPaymentMethods();
    expect(saved).toBeDefined();

    const order = await placeOrder({
      lines: [],
      totals,
      fulfilmentType: 'delivery',
      storeId: 'store-sandton',
      paymentMethodId: saved!.id,
      paymentMethodType: saved!.type,
    });

    expect(order.paymentMethodLabel).toBe(saved!.label);
  });
});

/**
 * Cancelling read the status as last written down rather than as it stands.
 * Every other read in the order service advances first — the status is derived
 * from the clock, so a stored one is only as fresh as the last time anybody
 * looked. This was the exception, and the only place a stored status decided
 * anything. Two hours after placing:
 *
 *     nobody opened the app  → CANCEL SUCCEEDED, status now: cancelled
 *     somebody looked first  → status is completed, and the cancel is refused
 */
describe('calling an order back', () => {
  const totals = {
    subtotal: 200,
    deliveryFee: 32,
    serviceFee: 5,
    discount: 0,
    rewardsDiscount: 0,
    total: 237,
    pointsEarned: 200,
  };

  const place = () =>
    placeOrder({
      lines: [],
      totals,
      fulfilmentType: 'delivery',
      storeId: 'store-sandton',
      paymentMethodId: 'pm-1',
      paymentMethodType: 'card',
    });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets a customer cancel one the kitchen has not started', async () => {
    const placed = await place();
    const cancelled = await cancelOrder(placed.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('refuses one that has been delivered, even if nobody ever opened the app', async () => {
    const placed = await place();

    // Two hours. Long enough to have been cooked, driven over and eaten — and
    // no screen fetched it in between, so nothing rewrote the stored status.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 120 * 60_000);

    await expect(cancelOrder(placed.id)).rejects.toThrow(/already been delivered/);
  });

  /** A driver holding the food is not the same as a kitchen not having started. */
  it('says where the order actually got to, rather than one message for all of it', async () => {
    const placed = await place();

    // Far enough in to be on its way, not far enough to have arrived — worked
    // out from the order's own ETA rather than a guessed number of minutes.
    // "Out for delivery" is the fourth of five steps, so it runs from three
    // quarters of the way through to the end.
    const onTheRoad = Date.now() + placed.etaMinutes * 0.8 * 60_000;
    jest.spyOn(Date, 'now').mockReturnValue(onTheRoad);

    await expect(cancelOrder(placed.id)).rejects.toThrow(/driver already has this order/);
  });

  it('leaves the order alone when it refuses', async () => {
    const placed = await place();
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 120 * 60_000);

    await expect(cancelOrder(placed.id)).rejects.toThrow();

    const after = await fetchOrder(placed.id);
    expect(after.status).toBe('completed');
  });
});

/**
 * Points were the one part of this app whose arithmetic nothing could check.
 * `fetchLoyaltyAccount` returned a frozen constant, so the confirmation
 * promised 287 points, the balance stayed at 1 840 and the history never
 * mentioned the order. Redeeming was worse: `redeemReward` validated the
 * reward, quoted a discount and deducted nothing, so the same 1 500-point
 * reward could be spent over and over for ever.
 *
 * When points settle is a real policy question. This takes the reading the
 * payload already implies — `PlaceOrderInput` carries `redeemedRewardId`, so a
 * redemption settles with the order, and nobody loses points by browsing.
 */
describe('the points a customer actually has', () => {
  const totals = (pointsEarned: number, rewardsDiscount = 0) => ({
    subtotal: 200,
    deliveryFee: 32,
    serviceFee: 5,
    discount: 0,
    rewardsDiscount,
    total: 237 - rewardsDiscount,
    pointsEarned,
  });

  const place = (input: Partial<Parameters<typeof placeOrder>[0]> = {}) =>
    placeOrder({
      lines: [],
      totals: totals(200),
      fulfilmentType: 'delivery',
      storeId: 'store-sandton',
      paymentMethodId: 'pm-1',
      paymentMethodType: 'card',
      ...input,
    });

  it('goes up by what the order earned, and says so in the history', async () => {
    const before = await fetchLoyaltyAccount();

    const order = await place({ totals: totals(287) });
    const after = await fetchLoyaltyAccount();

    expect(after.pointsBalance).toBe(before.pointsBalance + 287);
    expect(after.history[0]?.points).toBe(287);
    expect(after.history[0]?.orderReference).toBe(order.reference);
  });

  /**
   * The middle assertion is the one that matters. Comparing only before and
   * after passes on a ledger that never moved at all — which is exactly the
   * ledger this replaced, and exactly what it did when the frozen constant was
   * put back to check.
   */
  it('comes back off when the order is called back', async () => {
    const before = await fetchLoyaltyAccount();

    const order = await place({ totals: totals(287) });
    const awarded = await fetchLoyaltyAccount();
    expect(awarded.pointsBalance).toBe(before.pointsBalance + 287);

    await cancelOrder(order.id);
    const after = await fetchLoyaltyAccount();

    expect(after.pointsBalance).toBe(before.pointsBalance);
    expect(after.lifetimePoints).toBe(before.lifetimePoints);
  });

  /**
   * The one that could not be caught at all before: spend a reward twice.
   * With a frozen balance, `redeemable` was permanently true and nothing was
   * ever deducted.
   */
  it('charges a redeemed reward against the balance', async () => {
    const redeemable = (await fetchRewards()).find((reward) => reward.redeemable);
    expect(redeemable).toBeDefined();

    const before = await fetchLoyaltyAccount();
    await place({
      totals: totals(0, 40),
      redeemedRewardId: redeemable!.id,
    });
    const after = await fetchLoyaltyAccount();

    expect(after.pointsBalance).toBe(before.pointsBalance - redeemable!.pointsCost);
    // Spending is not un-earning: the tier must not slide back down.
    expect(after.lifetimePoints).toBe(before.lifetimePoints);
  });

  it('gives a redeemed reward back if that order is cancelled', async () => {
    const redeemable = (await fetchRewards()).find((reward) => reward.redeemable);
    const before = await fetchLoyaltyAccount();

    const order = await place({ totals: totals(0, 40), redeemedRewardId: redeemable!.id });
    const spent = await fetchLoyaltyAccount();
    expect(spent.pointsBalance).toBe(before.pointsBalance - redeemable!.pointsCost);

    await cancelOrder(order.id);
    const after = await fetchLoyaltyAccount();

    expect(after.pointsBalance).toBe(before.pointsBalance);
  });

  it('records which reward an order spent, so the discount can be explained', async () => {
    const redeemable = (await fetchRewards()).find((reward) => reward.redeemable);
    const order = await place({ totals: totals(0, 40), redeemedRewardId: redeemable!.id });

    expect(order.redeemedRewardId).toBe(redeemable!.id);
  });

  /**
   * Earning enough should move the tier, not just the number.
   *
   * Written against whatever the account currently is rather than against a
   * named tier: these tests share one mutable ledger, so by the time this runs
   * the earlier ones have already spent and earned. Asserting `silver` here
   * passed or failed on test order, which is not what it is meant to be
   * measuring.
   */
  it('moves the tier when the lifetime total crosses a threshold', async () => {
    const before = await fetchLoyaltyAccount();
    expect(before.nextTier).toBeDefined();
    const climb = before.pointsToNextTier;

    await place({ totals: totals(climb) });
    const after = await fetchLoyaltyAccount();

    expect(after.lifetimePoints).toBe(before.lifetimePoints + climb);
    expect(after.tier).toBe(before.nextTier);
    expect(after.tier).not.toBe(before.tier);
  });

  /** And the bar has to agree with the number it sits under. */
  it('keeps the progress bar between the two thresholds it spans', async () => {
    const account = await fetchLoyaltyAccount();
    expect(account.tierProgress).toBeGreaterThanOrEqual(0);
    expect(account.tierProgress).toBeLessThanOrEqual(1);
  });
});

/**
 * `Voucher.used` was read in two places and written in none. The seed marks
 * one voucher used so that state renders somewhere, but no voucher ever
 * *became* used:
 *
 *     1st use: WELCOME50 discount R 50
 *     2nd use: WELCOME50 discount R 50
 *     3rd use: WELCOME50 discount R 50
 *
 * "R50 off your first order" coming off every order there would ever be.
 */
describe('spending a promo code', () => {
  const totals = {
    subtotal: 300,
    deliveryFee: 32,
    serviceFee: 5,
    discount: 50,
    rewardsDiscount: 0,
    total: 287,
    pointsEarned: 250,
  };

  const placeWith = (voucherCode: string) =>
    placeOrder({
      lines: [],
      totals,
      fulfilmentType: 'delivery',
      storeId: 'store-sandton',
      paymentMethodId: 'pm-1',
      paymentMethodType: 'card',
      voucherCode,
    });

  it('refuses a first-order code on the second order', async () => {
    // It has to work once, or this proves nothing about the second attempt.
    const first = await validateVoucherCode('WELCOME50', 300);
    expect(first.discount).toBe(50);

    await placeWith('WELCOME50');

    await expect(validateVoucherCode('WELCOME50', 300)).rejects.toThrow(/already been used/);
  });

  it('drops a spent code out of the list of codes still worth showing', async () => {
    const active = await fetchActiveVouchers();
    expect(active.some((voucher) => voucher.code === 'WELCOME50')).toBe(false);
  });

  it('records the code on the order, so the discount line can be explained', async () => {
    const order = await placeWith('FREEDEL');
    expect(order.voucherCode).toBe('FREEDEL');
  });

  /** Somebody who cancels has not had their R50. Taking the code as well would
   * charge them for changing their mind. */
  it('hands the code back when the order is cancelled', async () => {
    const before = await validateVoucherCode('SPICY15', 300);
    expect(before.voucher.code).toBe('SPICY15');

    const order = await placeWith('SPICY15');
    await expect(validateVoucherCode('SPICY15', 300)).rejects.toThrow(/already been used/);

    await cancelOrder(order.id);

    const after = await validateVoucherCode('SPICY15', 300);
    expect(after.voucher.code).toBe('SPICY15');
  });
});

/**
 * `etaMinutes` is how long an order takes, counted from when the kitchen
 * starts — fixed when the order is placed. Tracking printed it directly, so
 * the line never moved. Driven in a browser, advancing the clock a quarter of
 * an hour at a time:
 *
 *     t+0min  : Out for delivery in 35 – 45 min
 *     t+15min : Out for delivery in 35 – 45 min
 *     t+30min : Out for delivery in 35 – 45 min
 *     t+45min : Out for delivery in 35 – 45 min
 *
 * Three quarters of an hour after ordering, on the one screen a hungry person
 * actually watches — beside a progress bar that had been climbing the whole
 * time.
 */
describe('how long until the food arrives', () => {
  const totals = {
    subtotal: 200,
    deliveryFee: 32,
    serviceFee: 5,
    discount: 0,
    rewardsDiscount: 0,
    total: 237,
    pointsEarned: 200,
  };

  const place = (scheduledFor?: string) =>
    placeOrder({
      lines: [],
      totals,
      fulfilmentType: 'delivery',
      storeId: 'store-sandton',
      paymentMethodId: 'pm-1',
      paymentMethodType: 'card',
      ...(scheduledFor ? { scheduledFor } : {}),
    });

  it('is the whole wait when the order has just been placed', async () => {
    const order = await place();
    expect(minutesUntilDue(order, new Date(order.placedAt))).toBe(order.etaMinutes);
  });

  it('counts down as the clock moves', async () => {
    const order = await place();
    const placedAt = new Date(order.placedAt).getTime();

    const atTwenty = minutesUntilDue(order, new Date(placedAt + 20 * 60_000));
    expect(atTwenty).toBe(order.etaMinutes - 20);
    expect(atTwenty).toBeLessThan(order.etaMinutes);
  });

  it('goes negative once the order is overdue, rather than sticking', async () => {
    const order = await place();
    const placedAt = new Date(order.placedAt).getTime();

    // Three quarters of an hour — past the ETA on any of the seeded branches.
    expect(minutesUntilDue(order, new Date(placedAt + 45 * 60_000))).toBeLessThanOrEqual(0);
  });

  /**
   * Counted from when the kitchen starts, not from when the customer paid —
   * or an order booked for tomorrow evening reads as overdue all night.
   */
  it('does not report a scheduled order as overdue before its slot', async () => {
    const slot = new Date(Date.now() + 28 * 3_600_000).toISOString();
    const order = await place(slot);

    // An hour after paying, the order is still a day away.
    const soonAfterPaying = new Date(new Date(order.placedAt).getTime() + 60 * 60_000);
    expect(minutesUntilDue(order, soonAfterPaying)).toBeGreaterThan(0);

    // And it is due at its slot, not at its slot plus the cooking time.
    const atTheSlot = minutesUntilDue(order, new Date(slot));
    expect(Math.abs(atTheSlot)).toBeLessThanOrEqual(1);
  });
});

/**
 * `updateProfile` returned `{ ...demoUser, ...patch }`, so saving a new phone
 * number handed back the seeded customer's identity with the patch on top —
 * and the profile screen writes the result straight into the auth store:
 *
 *     signed in as : user-sipho-example-co-za  sipho@example.co.za
 *     after editing: user-demo                 thandi@example.co.za
 *
 * Changing your phone number changed who you were. The account screen then
 * showed somebody else's email as yours, and because the id had moved, the
 * next sign-in looked like a different person and cleared the favourites that
 * had only just been made to follow their owner.
 */
describe('editing your own profile', () => {
  const signInAs = (email: string) => signIn({ email, password: 'chickenchicken' });

  it('keeps you as yourself', async () => {
    const { user } = await signInAs('sipho@example.co.za');

    const updated = await updateProfile({ phone: '+27829998877' }, user);

    expect(updated.id).toBe(user.id);
    expect(updated.email).toBe('sipho@example.co.za');
    expect(updated.phone).toBe('+27829998877');
  });

  it('carries earlier edits forward rather than starting from the seed each time', async () => {
    const { user } = await signInAs('sipho@example.co.za');

    const first = await updateProfile({ firstName: 'Sipho' }, user);
    const second = await updateProfile({ lastName: 'Dlamini' }, first);

    expect(second.firstName).toBe('Sipho');
    expect(second.lastName).toBe('Dlamini');
  });

  /** A customer may edit their email. Nobody edits their way into another account. */
  it('refuses to let a patch change the account id', async () => {
    const { user } = await signInAs('sipho@example.co.za');

    const updated = await updateProfile({ id: 'user-demo', email: 'new@example.co.za' }, user);

    expect(updated.id).toBe(user.id);
    expect(updated.email).toBe('new@example.co.za');
  });

  /**
   * The patch applies to whoever is passed in, so a stale record cannot leak
   * across a sign-out. Holding the signed-in user in module state inside the
   * service looked like the fix and was not — it is empty after any restart,
   * so the first edit on a freshly opened app fell back to the seed anyway.
   */
  it('does not carry one edit history into the next session', async () => {
    const first = await signInAs('sipho@example.co.za');
    await updateProfile({ firstName: 'Sipho' }, first.user);
    await signOutService();

    const second = await signInAs('nomsa@example.co.za');
    const updated = await updateProfile({ phone: '+27821112222' }, second.user);

    expect(updated.id).toBe(second.user.id);
    expect(updated.firstName).not.toBe('Sipho');
  });
});

/**
 * `register` sends `toE164(input.phone)` and `updateProfile` sent whatever was
 * typed, so the same customer's number was stored as "+27821234567" when they
 * signed up and "0829998877" when they edited it — two formats for one field,
 * on the number a driver phones from outside the gate.
 */
describe('the number a driver would ring', () => {
  it('is stored the same way whether it was typed at sign-up or edited later', async () => {
    const { user } = await signIn({ email: 'nomsa@example.co.za', password: 'chickenchicken' });

    const updated = await updateProfile({ phone: '0829998877' }, user);

    expect(updated.phone).toBe('+27829998877');
  });

  it('leaves an already-normalised number alone', async () => {
    const { user } = await signIn({ email: 'nomsa@example.co.za', password: 'chickenchicken' });

    const updated = await updateProfile({ phone: '+27829998877' }, user);

    expect(updated.phone).toBe('+27829998877');
  });
});

/**
 * Rating had the same bug `cancelOrder` had — it read the stored status while
 * every other read in the file advances first — and two of its own. Driven:
 *
 *     cancelled order rating: cancelled → 5 Lovely
 *     out-of-range rating: 99
 *
 * Five stars for food that was never cooked, and ninety-nine stars on a
 * five-star scale. Neither is reachable from the star picker, which offers one
 * to five on a completed order only. A screen is not a rule.
 */
describe('rating an order', () => {
  const totals = {
    subtotal: 200,
    deliveryFee: 32,
    serviceFee: 5,
    discount: 0,
    rewardsDiscount: 0,
    total: 237,
    pointsEarned: 200,
  };

  const place = () =>
    placeOrder({
      lines: [],
      totals,
      fulfilmentType: 'delivery',
      storeId: 'store-sandton',
      paymentMethodId: 'pm-1',
      paymentMethodType: 'card',
    });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Long enough for any of the seeded branches to have finished. */
  const afterItArrives = (order: Order) =>
    new Date(new Date(order.placedAt).getTime() + 120 * 60_000);

  it('accepts a rating once the order has arrived', async () => {
    const order = await place();
    jest.spyOn(Date, 'now').mockReturnValue(afterItArrives(order).getTime());

    const rated = await rateOrder(order.id, 5, 'Crispy');

    expect(rated.rating).toBe(5);
    expect(rated.ratingComment).toBe('Crispy');
  });

  it('refuses a rating on an order that was cancelled', async () => {
    const order = await place();
    await cancelOrder(order.id);

    await expect(rateOrder(order.id, 5, 'Lovely')).rejects.toThrow(/was cancelled/);
  });

  it('refuses a rating on food that has not turned up yet', async () => {
    const order = await place();

    await expect(rateOrder(order.id, 5)).rejects.toThrow(/once it has arrived/);
  });

  /**
   * Advanced before the status is read, the same as cancelling. An order that
   * finished while nobody was looking is still finished.
   */
  it('lets somebody rate an order that finished while the app was closed', async () => {
    const order = await place();
    expect(order.status).toBe('received');

    jest.spyOn(Date, 'now').mockReturnValue(afterItArrives(order).getTime());

    // No fetch in between — nothing has rewritten the stored status.
    const rated = await rateOrder(order.id, 4);
    expect(rated.rating).toBe(4);
  });

  it.each([0, 6, 99, -1, 2.5, Number.NaN])('refuses %p stars', async (bad) => {
    const order = await place();
    jest.spyOn(Date, 'now').mockReturnValue(afterItArrives(order).getTime());

    await expect(rateOrder(order.id, bad)).rejects.toThrow(/1 to 5 stars/);
  });
});
