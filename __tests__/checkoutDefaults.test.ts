import type { Address, Store } from '@/types';
import { checkoutDefaults } from '@/features/checkout/checkoutDefaults';

const NOW = new Date('2026-08-24T13:00:00+02:00');

const branch = (id: string, latitude: number, longitude: number, opensOn?: string): Store =>
  ({
    id,
    name: `bb.q Chicken ${id}`,
    addressLine: '1 Street',
    suburb: id,
    city: 'City',
    province: 'Gauteng',
    phone: '011 000 0000',
    latitude,
    longitude,
    openingHours: [],
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    deliveryRadiusKm: 10,
    preparationMinutes: 18,
    isOpenNow: true,
    ...(opensOn ? { opensOn } : {}),
  }) as Store;

/** Alphabetical, which is how the list arrives when nobody knows where you are. */
const canalWalk = branch('Canal Walk', -33.8919, 18.5106);
const rosebank = branch('Rosebank', -26.1465, 28.0436);
const stores = [canalWalk, rosebank];

const home: Address = {
  id: 'address-home',
  label: 'Home',
  line1: '12 Alice Lane',
  suburb: 'Melrose Arch',
  city: 'Johannesburg',
  province: 'Gauteng',
  postalCode: '2196',
  latitude: -26.1327,
  longitude: 28.0673,
  isDefault: true,
};

const base = {
  fulfilmentType: 'delivery' as const,
  store: null,
  address: null,
  savedAddresses: [home],
  addressesLoading: false,
  availableStores: stores,
  now: NOW,
};

describe('what checkout fills in for somebody who has chosen nothing', () => {
  it('suggests the default address', () => {
    expect(checkoutDefaults(base).address?.id).toBe('address-home');
  });

  it('picks a branch that can actually reach it', () => {
    expect(checkoutDefaults(base).store?.id).toBe('Rosebank');
  });

  /**
   * The regression this file exists for.
   *
   * The store list resolves before the address list. As two effects, and then
   * as one effect without this wait, checkout had stores and no addresses on
   * its first run — so it chose alphabetically, and both guards are "only when
   * nothing is chosen", which made the wrong choice permanent. `audit:points`
   * failed on exactly that: "bb.q Chicken Canal Walk does not deliver to
   * Melrose Arch", for a customer who had picked neither.
   */
  it('waits rather than choosing a branch before the addresses land', () => {
    const early = checkoutDefaults({ ...base, addressesLoading: true, savedAddresses: [] });
    expect(early.store).toBeUndefined();
    expect(early.address).toBeUndefined();
  });

  it('chooses once they have landed', () => {
    const settled = checkoutDefaults({ ...base, addressesLoading: false });
    expect(settled.store?.id).toBe('Rosebank');
  });

  it('does not wait when the customer already has an address chosen', () => {
    const chosen = checkoutDefaults({ ...base, address: home, addressesLoading: true });
    expect(chosen.store?.id).toBe('Rosebank');
    // Already chosen, so nothing to set.
    expect(chosen.address).toBeUndefined();
  });

  /**
   * A guest's address query is disabled rather than pending, and an offline
   * one is paused; both report `addressesLoading: false`, so neither leaves
   * somebody staring at "Choose a store" with no way to know why.
   */
  it('does not wait for addresses that are never coming', () => {
    const guest = checkoutDefaults({ ...base, savedAddresses: [], addressesLoading: false });
    expect(guest.store?.id).toBe('Canal Walk');
  });

  it('does not wait at all for a collection order', () => {
    const collecting = checkoutDefaults({
      ...base,
      fulfilmentType: 'collection',
      addressesLoading: true,
    });
    expect(collecting.store?.id).toBe('Canal Walk');
    // No front door on a receipt for food somebody carried home themselves.
    expect(collecting.address).toBeUndefined();
  });

  it('never overrules a branch the customer picked', () => {
    const picked = checkoutDefaults({ ...base, store: canalWalk });
    expect(picked.store).toBeUndefined();
  });

  it('still suggests an address for a branch the customer picked', () => {
    // The store guard must not swallow the address half — checkout used to
    // pick a branch and a card for you and then ask you to find your own door.
    expect(checkoutDefaults({ ...base, store: canalWalk }).address?.id).toBe('address-home');
  });

  it('falls back to a trading branch when none can deliver', () => {
    const durban: Address = { ...home, latitude: -29.85, longitude: 31.02 };
    const far = checkoutDefaults({ ...base, savedAddresses: [durban] });
    // "Choose a store" from an empty list tells a customer nothing; a named
    // branch with a reason underneath it tells them what to change.
    expect(far.store).toBeDefined();
  });

  it('skips a branch that has not opened, as it always did', () => {
    const notOpenYet = branch('Aardvark', -26.14, 28.05, '2026-11-01T09:00:00+02:00');
    const opening = checkoutDefaults({ ...base, availableStores: [notOpenYet, rosebank] });
    expect(opening.store?.id).toBe('Rosebank');
  });
});
