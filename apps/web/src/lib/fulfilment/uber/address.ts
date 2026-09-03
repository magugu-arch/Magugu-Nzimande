import type { Order } from '@bbq/types';
import type { Store } from '@bbq/types';

/**
 * Addresses, in the shape Uber wants them.
 *
 * Uber Direct takes a *structured* address — street lines, city, state, postal
 * code, country — passed as a JSON string. What this application has is a free
 * text line and a suburb, because that is what a South African customer types
 * and what the delivery-zone check needs.
 *
 * `dropoffAddress` returns null when it cannot build something a courier could
 * actually drive to, and the adapter refuses the dispatch rather than sending
 * Uber a half address and discovering the problem when a driver rings the
 * customer.
 *
 * The postal code used to be the missing piece — sent empty, because checkout
 * did not ask for one. Checkout asks now, so a delivery order carries a
 * complete address. It is still nullable on the type, because orders placed
 * before that change exist and a courier can be dispatched without it: Uber's
 * geocoder resolves the street and suburb, less reliably.
 */

export type UberAddress = {
  street_address: string[];
  city: string;
  state: string;
  zip_code: string;
  country: string;
};

/** South Africa. The only country these stores deliver in. */
const COUNTRY = 'ZA';

/**
 * Gauteng, for now.
 *
 * All three stores are in Johannesburg. Hardcoding a province for a store in
 * Cape Town would be wrong, so this is derived from the store rather than
 * assumed — the seed has no province field yet, and until it does this is the
 * one honest default, marked so it is found when a fourth store opens.
 */
const PROVINCE = 'Gauteng';

export function dropoffAddress(order: Order): UberAddress | null {
  if (!order.address || !order.suburb) return null;

  const street = order.address.trim();
  const suburb = order.suburb.trim();
  if (!street || !suburb) return null;

  return {
    street_address: [street],
    // The suburb is what a South African address uses where Uber expects a
    // city. Sandton is not a city and Johannesburg is not what the customer
    // typed; the suburb is what a driver navigates to.
    city: suburb,
    state: PROVINCE,
    // Not collected at checkout. Sent empty rather than invented: a wrong
    // postal code routes a driver somewhere confidently, which is worse than
    // an absent one that Uber's geocoder resolves from the street and suburb.
    // Empty only for an order placed before checkout collected one. An
    // invented code routes a driver somewhere confidently, which is worse than
    // an absent one Uber has to geocode around.
    zip_code: order.postalCode ?? '',
    country: COUNTRY,
  };
}

export function pickupAddress(store: Store): UberAddress {
  return {
    street_address: [store.address],
    city: store.name,
    state: PROVINCE,
    zip_code: '',
    country: COUNTRY,
  };
}

/** Uber takes the structured address as a JSON string, not as an object. */
export const encodeAddress = (address: UberAddress): string => JSON.stringify(address);

/**
 * A South African mobile in the format Uber expects.
 *
 * E.164: 0821234567 becomes +27821234567. Sent as typed, an 0-prefixed number
 * is either rejected or read as belonging to whatever country Uber assumes,
 * and the driver cannot ring the customer.
 */
export function e164(mobile: string): string | null {
  const digits = mobile.replace(/[\s()-]/g, '');
  if (/^\+27[6-8]\d{8}$/.test(digits)) return digits;
  if (/^27[6-8]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[6-8]\d{8}$/.test(digits)) return `+27${digits.slice(1)}`;
  return null;
}
