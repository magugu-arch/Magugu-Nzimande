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
  fetchActiveOrder,
  fetchOrder,
  fetchOrders,
  placeOrder,
  readyLabelFor,
  statusSequence,
  workStartsAt,
} from '@/services/orderService';
import {
  discountFor,
  fetchActiveVouchers,
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
