import { addressIsLocated, courierRefusal } from '@/features/checkout/courierServiceability';
import type { Address, DeliveryQuote } from '@/types';

/**
 * Whether a courier will actually go there — the second serviceability
 * question, and the one the app could not previously ask.
 *
 * The first is already answered: each branch carries a `deliveryRadiusKm` and
 * `missingFulfilmentRequirement` refuses an address measured outside it. That
 * says how far bb.q will drive. It does not say whether anybody will drive it,
 * and only the courier network knows that — an order can clear the radius and
 * still find no driver, which is the `FAILED` case the provider mapping has to
 * handle after the money has been taken.
 *
 * `quote()` is on the provider interface because the brief specifies it (§5).
 * These pin what the app is allowed to do with the answer, which is the part
 * that can go wrong in the expensive direction: refusing orders it should
 * accept.
 */
const located: Address = {
  id: 'a1',
  label: 'Home',
  line1: '14 Acacia Road',
  suburb: 'Melrose Arch',
  city: 'Johannesburg',
  province: 'Gauteng',
  postalCode: '2196',
  latitude: -26.1327,
  longitude: 28.0673,
  isDefault: true,
};

const unlocated: Address = { ...located, id: 'a2' };
delete (unlocated as { latitude?: number }).latitude;
delete (unlocated as { longitude?: number }).longitude;

const quote = (over: Partial<DeliveryQuote>): DeliveryQuote => ({
  feeRand: 32,
  etaMinutes: 24,
  serviceable: true,
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  ...over,
});

describe('knowing whether an address has been located', () => {
  it('is true only when both coordinates are present', () => {
    expect(addressIsLocated(located)).toBe(true);
    expect(addressIsLocated(unlocated)).toBe(false);
    expect(addressIsLocated(null)).toBe(false);
  });

  it('is false when only one coordinate arrived', () => {
    // A half-located address is not located. Passing one coordinate to a
    // router is worse than passing none, because it looks like an answer.
    const halfway = { ...located, longitude: undefined } as unknown as Address;
    expect(addressIsLocated(halfway)).toBe(false);
  });
});

describe('what the app does with a courier’s answer', () => {
  it('lets a serviceable address through with nothing to say', () => {
    expect(courierRefusal(quote({ serviceable: true }), true)).toBeNull();
  });

  /**
   * The one case that blocks. No driver will come, so taking the money would
   * sell somebody food that cannot reach them.
   */
  it('refuses a located address the courier positively declines', () => {
    const refusal = courierRefusal(quote({ serviceable: false }), true);
    expect(refusal).toBeTruthy();
    // And offers the way out, rather than only the bad news.
    expect(refusal).toMatch(/collect/i);
  });

  /**
   * The case that must NOT block, and the reason this function exists rather
   * than the screen reading `quote.serviceable` directly.
   *
   * The mock provider — and any real one — refuses a dropoff it cannot route.
   * For this app that is the ordinary case: the add-address form has no
   * geocoder behind it, so most typed addresses carry no coordinates. Reading
   * that refusal as a courier's would turn a known, documented gap into a
   * blanket ban on delivery.
   *
   * It is the same rule `deliveryRange` already applies one layer up: an
   * address nobody has located is let through.
   */
  it('does not refuse an address the app itself never located', () => {
    expect(courierRefusal(quote({ serviceable: false }), false)).toBeNull();
  });

  it('never invents a refusal from a quote that carries a reason but is serviceable', () => {
    // `reason` is diagnostic. Only `serviceable` decides.
    expect(courierRefusal(quote({ serviceable: true, reason: 'surge pricing' }), true)).toBeNull();
  });
});
