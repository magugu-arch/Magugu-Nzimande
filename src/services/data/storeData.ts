import type { OpeningHours, Store } from '@/types';

/** Standard trading hours: 10:00 – 22:00 every day. */
const STANDARD_HOURS: OpeningHours[] = Array.from({ length: 7 }, (_, day) => ({
  day,
  opensAt: '10:00',
  closesAt: '22:00',
}));

const LATE_HOURS: OpeningHours[] = Array.from({ length: 7 }, (_, day) => ({
  day,
  opensAt: '11:00',
  closesAt: day === 5 || day === 6 ? '23:00' : '22:00',
}));

/**
 * bb.q Chicken South Africa store network.
 *
 * `distanceKm` is not seeded, because it is a fact about the customer rather
 * than about the branch. The store service fills it in against their real
 * coordinates when location has been granted, and leaves it absent when it has
 * not — the app used to substitute the Johannesburg CBD there and print the
 * result as the customer's own distance.
 *
 * It used to sit here as `0` on every record, which `fetchStore` passed through
 * untouched: opening a single branch showed "0 m away".
 */
export const stores: Store[] = [
  {
    id: 'store-sandton',
    name: 'bb.q Chicken Sandton City',
    addressLine: 'Shop L47, Sandton City, 83 Rivonia Rd',
    suburb: 'Sandhurst',
    city: 'Johannesburg',
    province: 'Gauteng',
    phone: '011 883 0100',
    latitude: -26.1076,
    longitude: 28.0567,
    openingHours: LATE_HOURS,
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    deliveryRadiusKm: 10,
    preparationMinutes: 18,
    isOpenNow: true,
  },
  {
    id: 'store-rosebank',
    name: 'bb.q Chicken Rosebank',
    addressLine: 'The Zone @ Rosebank, 177 Oxford Rd',
    suburb: 'Rosebank',
    city: 'Johannesburg',
    province: 'Gauteng',
    phone: '011 447 2200',
    latitude: -26.1465,
    longitude: 28.0436,
    openingHours: STANDARD_HOURS,
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    deliveryRadiusKm: 10,
    preparationMinutes: 20,
    isOpenNow: true,
  },
  {
    id: 'store-fourways',
    name: 'bb.q Chicken Fourways',
    addressLine: 'Fourways Mall, Cnr William Nicol & Witkoppen',
    suburb: 'Fourways',
    city: 'Johannesburg',
    province: 'Gauteng',
    phone: '011 465 3400',
    latitude: -26.0173,
    longitude: 28.0114,
    openingHours: STANDARD_HOURS,
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: false,
    deliveryRadiusKm: 10,
    preparationMinutes: 22,
    isOpenNow: true,
  },
  /**
   * Shut today, while its published hours say it is open.
   *
   * `isOpenNow` is the kitchen's own veto — the power cut, the burst pipe, the
   * shift nobody turned up for — and `isTradingNow` has honoured it since it
   * was written. Every one of the seven branches was seeded `true`, so the
   * veto had never once fired, and the code downstream of it had never run
   * against the case it exists for. In a country with scheduled load-shedding
   * this is not an exotic state; it is a Tuesday.
   *
   * Everything else about this branch is ordinary on purpose. The fixture is
   * one flag, so what it exposes is about the flag rather than about a branch
   * assembled to be strange.
   */
  {
    id: 'store-menlyn',
    name: 'bb.q Chicken Menlyn Park',
    addressLine: 'Menlyn Park Shopping Centre, Atterbury Rd',
    suburb: 'Menlyn',
    city: 'Pretoria',
    province: 'Gauteng',
    phone: '012 348 7700',
    latitude: -25.7828,
    longitude: 28.2764,
    openingHours: STANDARD_HOURS,
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    deliveryRadiusKm: 10,
    preparationMinutes: 19,
    isOpenNow: false,
  },
  {
    id: 'store-vanda',
    name: 'bb.q Chicken V&A Waterfront',
    addressLine: 'Shop 6142, Victoria Wharf, Breakwater Blvd',
    suburb: 'V&A Waterfront',
    city: 'Cape Town',
    province: 'Western Cape',
    phone: '021 418 9900',
    latitude: -33.9036,
    longitude: 18.4201,
    openingHours: LATE_HOURS,
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    deliveryRadiusKm: 10,
    preparationMinutes: 21,
    isOpenNow: true,
  },
  {
    id: 'store-canalwalk',
    name: 'bb.q Chicken Canal Walk',
    addressLine: 'Canal Walk Shopping Centre, Century Blvd',
    suburb: 'Century City',
    city: 'Cape Town',
    province: 'Western Cape',
    phone: '021 555 4400',
    latitude: -33.8919,
    longitude: 18.5106,
    openingHours: STANDARD_HOURS,
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: false,
    deliveryRadiusKm: 10,
    preparationMinutes: 20,
    isOpenNow: true,
  },
  {
    id: 'store-gateway',
    // Placeholder for the second opening. Both real branches open later this
    // year — 1 October and 1 November — so this state is not hypothetical.
    opensOn: '2026-11-01T09:00:00+02:00',
    name: 'bb.q Chicken Gateway',
    addressLine: 'Gateway Theatre of Shopping, 1 Palm Blvd',
    suburb: 'Umhlanga Ridge',
    city: 'Durban',
    province: 'KwaZulu-Natal',
    phone: '031 566 8800',
    latitude: -29.7259,
    longitude: 31.0684,
    openingHours: STANDARD_HOURS,
    supportsDelivery: true,
    supportsCollection: true,
    supportsDineIn: true,
    deliveryRadiusKm: 10,
    preparationMinutes: 18,
    isOpenNow: true,
  },
];
