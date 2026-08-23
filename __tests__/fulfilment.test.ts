import { act } from '@testing-library/react-native';
import type { Address, Store } from '@/types';
import {
  missingFulfilmentRequirement,
  useFulfilmentStore,
  type FulfilmentRequirements,
} from '@/store/fulfilmentStore';

const store: Store = {
  id: 'rosebank',
  name: 'bb.q Chicken Rosebank',
  suburb: 'Rosebank',
  city: 'Johannesburg',
  province: 'Gauteng',
  distanceKm: 2.4,
  addressLine: '50 Bath Avenue',
  latitude: -26.1456,
  longitude: 28.0421,
  phone: '+27110000000',
  supportsDelivery: true,
  supportsCollection: true,
  supportsDineIn: true,
  preparationMinutes: 18,
  openingHours: [],
  isOpenNow: true,
};

const address: Address = {
  id: 'home',
  label: 'Home',
  line1: '12 Oxford Road',
  suburb: 'Rosebank',
  city: 'Johannesburg',
  province: 'Gauteng',
  postalCode: '2196',
  latitude: -26.146,
  longitude: 28.041,
  isDefault: true,
};

const base: FulfilmentRequirements = {
  fulfilmentType: 'delivery',
  store: null,
  address: null,
  tableNumber: '',
};

describe('missingFulfilmentRequirement', () => {
  it('asks for a store first', () => {
    expect(missingFulfilmentRequirement(base)).toBe('Choose a store');
  });

  it('asks for an address once a store is chosen, for delivery', () => {
    expect(missingFulfilmentRequirement({ ...base, store })).toBe('Add a delivery address');
  });

  it('is satisfied by a store and an address', () => {
    expect(missingFulfilmentRequirement({ ...base, store, address })).toBeNull();
  });

  it('wants no address for collection', () => {
    expect(
      missingFulfilmentRequirement({ ...base, fulfilmentType: 'collection', store }),
    ).toBeNull();
  });

  /**
   * The hole this closes: every screen showed "Closed" on the store card and
   * then let the order through anyway. A shut kitchen cannot cook.
   */
  describe('a closed store', () => {
    const closed = { ...store, isOpenNow: false };

    it('blocks an order meant for now', () => {
      expect(missingFulfilmentRequirement({ ...base, store: closed, address })).toBe(
        'bb.q Chicken Rosebank is closed — schedule for later',
      );
    });

    it('allows one scheduled for later, which is the point of scheduling', () => {
      expect(
        missingFulfilmentRequirement({
          ...base,
          store: closed,
          address,
          scheduledFor: '2026-08-23T18:30:00.000Z',
        }),
      ).toBeNull();
    });

    it('still refuses dine-in, scheduled or not — there is nowhere to sit', () => {
      expect(
        missingFulfilmentRequirement({
          ...base,
          fulfilmentType: 'dinein',
          store: closed,
          tableNumber: '14',
          scheduledFor: '2026-08-23T18:30:00.000Z',
        }),
      ).toBe('bb.q Chicken Rosebank is closed');
    });

    it('says nothing about opening hours when the store is open', () => {
      expect(missingFulfilmentRequirement({ ...base, store, address })).toBeNull();
    });
  });

  it('wants a table number for dine-in, and not whitespace', () => {
    const dinein = { ...base, fulfilmentType: 'dinein' as const, store };
    expect(missingFulfilmentRequirement(dinein)).toBe('Enter your table number');
    expect(missingFulfilmentRequirement({ ...dinein, tableNumber: '   ' })).toBe(
      'Enter your table number',
    );
    expect(missingFulfilmentRequirement({ ...dinein, tableNumber: '14' })).toBeNull();
  });
});

/**
 * The regression this exists for: checkout memoised its blocker on the store's
 * `missingRequirement` method, whose identity never changes, so the memo kept
 * returning the first answer it ever computed. Picking a store left the Place
 * Order button disabled, still reading "Choose a store".
 *
 * A pure function cannot go stale, so this asserts the property that matters —
 * the same inputs that the screen re-renders on produce a fresh answer.
 */
describe('the blocker keeps up with the store', () => {
  beforeEach(() => {
    act(() => {
      useFulfilmentStore.getState().reset();
    });
  });

  it('clears as each requirement is met', () => {
    const read = () => {
      const { fulfilmentType, store: s, address: a, tableNumber } = useFulfilmentStore.getState();
      return missingFulfilmentRequirement({ fulfilmentType, store: s, address: a, tableNumber });
    };

    expect(read()).toBe('Choose a store');

    act(() => {
      useFulfilmentStore.getState().setStore(store);
    });
    expect(read()).toBe('Add a delivery address');

    act(() => {
      useFulfilmentStore.getState().setAddress(address);
    });
    expect(read()).toBeNull();
  });

  it('agrees with the store method it replaced', () => {
    act(() => {
      useFulfilmentStore.getState().setStore(store);
    });

    const state = useFulfilmentStore.getState();
    expect(state.missingRequirement()).toBe(
      missingFulfilmentRequirement({
        fulfilmentType: state.fulfilmentType,
        store: state.store,
        address: state.address,
        tableNumber: state.tableNumber,
      }),
    );
  });
});
