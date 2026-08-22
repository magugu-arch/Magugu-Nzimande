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
  fetchOrders,
  placeOrder,
  readyLabelFor,
  statusSequence,
} from '@/services/orderService';
import {
  discountFor,
  fetchActiveVouchers,
  fetchVouchers,
  validateVoucherCode,
} from '@/services/rewardsService';
import { authorisePayment, isSettledOnDelivery, requiresRedirect } from '@/services/paymentService';
import { stores } from '@/services/data/storeData';
import { vouchers } from '@/services/data/rewardsData';
import type { Voucher } from '@/types';
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
    });

    expect(order.status).toBe('received');
    expect(order.reference).toMatch(/^BBQ-\d+$/);
    expect(order.timeline).toHaveLength(statusSequence('delivery').length);
    expect(order.timeline[0]?.occurredAt).not.toBeNull();
    expect(order.timeline.at(-1)?.occurredAt).toBeNull();
    expect(order.addressSummary).toBeDefined();
    expect(order.paymentMethodLabel).toBe('Visa ending 4821');
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
