import {
  MalformedResponse,
  checkedLoyaltyAccount,
  checkedMenu,
  checkedOrder,
  checkedOrders,
  checkedProduct,
  checkedStore,
  checkedStores,
  checkedVouchers,
} from '@/services/wireChecks';
import { menuSnapshot } from '@/services/data/menuData';
import { stores } from '@/services/data/storeData';
import { vouchers } from '@/services/data/rewardsData';

/**
 * `request<T>` casts the parsed JSON to `T`, so every type in `src/types` is a
 * promise about the wire that nothing kept. It produced four holes, three of
 * them patched at the consumer and one that no consumer could patch:
 * `formatPrice` rendered anything non-finite as `R 0.00`, so a backend
 * returning money as strings — ordinary, and done to keep float precision off
 * the wire — put "R 0.00" on every menu tile while the arithmetic coerced and
 * charged the real amount.
 *
 * These checks are the boundary version. They assert only what the app would
 * otherwise get wrong, and the first thing to prove about them is that they do
 * not reject the app's own data.
 */
describe('the mock seed satisfies every check it is fetched through', () => {
  it('accepts the seeded menu', () => {
    expect(() => checkedMenu(menuSnapshot)).not.toThrow();
  });

  it('accepts the seeded stores', () => {
    expect(() => checkedStores(stores)).not.toThrow();
  });

  it('accepts the seeded vouchers', () => {
    expect(() => checkedVouchers(vouchers)).not.toThrow();
  });
});

describe('money that is not a number', () => {
  const product = {
    id: 'golden-original',
    name: 'Golden Original Chicken',
    basePrice: 129,
    optionGroups: [{ id: 'size', options: [{ id: 'large', priceDelta: 20 }] }],
  };

  it('lets a real price through', () => {
    expect(() => checkedProduct(product)).not.toThrow();
  });

  /** The one that reached a customer: R 0.00 on the tile, R 258.00 on the bill. */
  it('refuses a price sent as a string', () => {
    expect(() => checkedProduct({ ...product, basePrice: '129.00' })).toThrow(MalformedResponse);
  });

  it('names the field and what arrived', () => {
    // A five-minute fix rather than an afternoon: whoever reads this log needs
    // to know which side to change.
    expect(() => checkedProduct({ ...product, basePrice: '129.00' })).toThrow(
      'product.basePrice should be a number, got string "129.00"',
    );
  });

  it('refuses a missing price rather than treating it as free', () => {
    const { basePrice: _gone, ...noPrice } = product;
    expect(() => checkedProduct(noPrice)).toThrow('product.basePrice should be a number');
  });

  it('refuses an option surcharge it cannot add', () => {
    const stringy = {
      ...product,
      optionGroups: [{ id: 'size', options: [{ id: 'large', priceDelta: '20' }] }],
    };
    expect(() => checkedProduct(stringy)).toThrow(
      'product.optionGroups[0].options[0].priceDelta should be a number',
    );
  });

  it('points at the offending product in a whole menu', () => {
    expect(() => checkedMenu({ products: [product, { ...product, basePrice: null }] })).toThrow(
      'menu.products[1].basePrice should be a number',
    );
  });
});

describe('the bill', () => {
  const order = {
    id: 'order-1',
    totals: {
      subtotal: 258,
      deliveryFee: 32,
      serviceFee: 5,
      discount: 0,
      rewardsDiscount: 0,
      total: 295,
      pointsEarned: 258,
    },
    etaMinutes: 40,
    storeLatitude: -26.1,
    storeLongitude: 28.05,
  };

  it('lets a real order through', () => {
    expect(() => checkedOrder(order)).not.toThrow();
  });

  it('refuses a total it cannot read', () => {
    expect(() => checkedOrder({ ...order, totals: { ...order.totals, total: '295.00' } })).toThrow(
      'order.totals.total should be a number',
    );
  });

  it('refuses an eta that would freeze the countdown', () => {
    expect(() => checkedOrder({ ...order, etaMinutes: null })).toThrow('order.etaMinutes');
  });

  /**
   * Optional because the record stopped carrying `0, 0` for a branch it does
   * not know — a point in the Gulf of Guinea that the tracking screen would
   * have offered directions to. Absent is fine; present and unreadable is not.
   */
  it('accepts an order with no branch coordinates', () => {
    const { storeLatitude: _a, storeLongitude: _b, ...unlocated } = order;
    expect(() => checkedOrder(unlocated)).not.toThrow();
  });

  it('refuses branch coordinates it cannot read', () => {
    expect(() => checkedOrder({ ...order, storeLatitude: '-26.1' })).toThrow('order.storeLatitude');
  });

  it('points at the offending order in a history', () => {
    expect(() => checkedOrders([order, { ...order, etaMinutes: 'soon' }])).toThrow(
      'orders[1].etaMinutes should be a number, got string "soon"',
    );
  });

  it('refuses a history that is not a list', () => {
    expect(() => checkedOrders({ orders: [] })).toThrow('orders should be a list');
  });
});

describe('the rest of the numbers a customer acts on', () => {
  it('refuses a branch with no coordinates, which decides who gets delivery', () => {
    expect(() => checkedStore({ id: 'a', name: 'b', deliveryRadiusKm: 10 })).toThrow(
      'store.latitude should be a number',
    );
  });

  it('refuses a delivery radius it cannot compare against', () => {
    expect(() =>
      checkedStore({ id: 'a', name: 'b', latitude: -26, longitude: 28, deliveryRadiusKm: '10' }),
    ).toThrow('store.deliveryRadiusKm should be a number');
  });

  it('refuses a points balance rewards are spent against', () => {
    expect(() => checkedLoyaltyAccount({ pointsBalance: '1840' })).toThrow(
      'loyalty.pointsBalance should be a number',
    );
  });

  it('refuses a voucher whose discount cannot come off a bill', () => {
    expect(() =>
      checkedVouchers([{ code: 'SPICY15', discountValue: '15', minimumSpend: 150 }]),
    ).toThrow('vouchers[0].discountValue should be a number');
  });

  it('refuses a voucher with a minimum spend it cannot test', () => {
    expect(() => checkedVouchers([{ code: 'SPICY15', discountValue: 15 }])).toThrow(
      'vouchers[0].minimumSpend should be a number',
    );
  });
});
