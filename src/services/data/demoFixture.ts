import type { Address, Product, Reward, TierDefinition, Voucher } from '@/types';

/**
 * Illustrative prices, for demonstrating the app. Never Pappas's prices.
 *
 * ── Why this file exists ─────────────────────────────────────────────────
 *
 * §15 forbids inventing menu prices, so the catalogue ships every dish at
 * `priceStatus: 'awaiting-business-input'` with `available: false`. That is
 * the correct production state and it stays the default.
 *
 * It also means the entire commerce half of the app cannot be exercised. An
 * unavailable dish cannot enter a cart, so there is no cart, no totals, no
 * minimum-order rule, no delivery fee, no points earned, no order to place
 * and nothing to track. Six of the ten browser journeys — the ones that place
 * an order and follow it — had nothing to drive, and the checkout, loyalty
 * and tracking paths were reachable only by unit test.
 *
 * Refusing to invent a price for a *customer* is right. Refusing to invent
 * one for a *test* leaves half the app unverified, which is not a win for
 * anybody. So the invention lives here, behind a flag, clearly labelled, and
 * never in the catalogue.
 *
 * ── The guarantees ───────────────────────────────────────────────────────
 *
 * - **Off by default.** `EXPO_PUBLIC_DEMO_PRICES` must be set explicitly.
 * - **Barred from production.** `audit:launch --production` fails the build
 *   if it is on, the same way it does for the mock API.
 * - **Visible when on.** The app shows a persistent banner, because a
 *   screenshot of a demo build is otherwise indistinguishable from a
 *   screenshot of a real one, and this figure would be quoted back at Pappas.
 * - **Deliberately round.** R95, R140, R210 — no R189.90. These are meant to
 *   read as placeholders to anyone who glances at them, not as a menu
 *   somebody costed.
 *
 * None of these numbers came from Pappas, and none should ever be shown to a
 * customer. `audit:placeholders` continues to report all 45 dishes as
 * awaiting a price whether this is on or not, because they are.
 */

/**
 * A price band per category, in rand.
 *
 * Per category rather than per dish on purpose: a table of 45 hand-picked
 * numbers looks like a real menu, invites line-by-line argument about whether
 * the lamb is priced right, and would take a reviewer several minutes to work
 * out is fictional. Ten round bands cannot be mistaken for anything else.
 */
const BAND: Record<string, number> = {
  mezedakia: 95,
  salads: 140,
  souvlaki: 165,
  seafood: 260,
  'fish-market': 295,
  'signature-mains': 235,
  'steak-on-the-rock': 320,
  desserts: 85,
  breakfast: 120,
  drinks: 60,
};

const FALLBACK_PRICE = 150;

/** Whether the demo fixture is switched on for this build. */
export function demoPricesEnabled(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

/**
 * The catalogue with illustrative prices applied.
 *
 * Returns a new array; the source catalogue is never mutated, so a test that
 * imports `products` directly still sees the unpriced truth.
 */
export function withDemoPrices(products: Product[]): Product[] {
  return products.map((product) => {
    if (product.priceStatus !== 'awaiting-business-input') return product;
    return {
      ...product,
      basePrice: BAND[product.categoryId] ?? FALLBACK_PRICE,
      priceStatus: 'confirmed' as const,
      available: true,
    };
  });
}

/**
 * Tier thresholds, so the loyalty ladder has rungs.
 *
 * The shipped programme has every tier at 0 because nobody has set them, which
 * makes the progress bar meaningless and the tier ladder untestable.
 */
export function withDemoTiers(tiers: TierDefinition[]): TierDefinition[] {
  const thresholds = [0, 1500, 4000, 9000];
  return tiers.map((tier, index) => ({ ...tier, threshold: thresholds[index] ?? tier.threshold }));
}

/**
 * Reward costs, so a reward can be afforded, redeemed and refused.
 *
 * `pointsCost: 0` is what made a reward compute as affordable at a zero
 * balance and redeem for R0 — the defect the unpriced catalogue surfaced.
 * These give the redemption path something real to refuse.
 */
export function withDemoRewards(rewards: Reward[]): Reward[] {
  const costs = [600, 900, 1200, 2000, 0];
  return rewards.map((reward, index) => {
    const pointsCost = costs[index] ?? 1000;
    return {
      ...reward,
      pointsCost,
      // The birthday reward stays at zero cost and stays non-redeemable: it is
      // earned by a date, not a balance, and that distinction is real.
      redeemable: pointsCost > 0,
    };
  });
}

/**
 * Trading hours, so "are we open?" has something to answer with.
 *
 * Pappas has not supplied them, and §15 forbids inventing opening hours, so
 * `storeData` ships `openingHours: []`. `utils/tradingHours` then falls back
 * to the kitchen's own flag — deliberately, because a data gap must not read
 * as a shut door — and the app accepts an order at any hour of the day.
 *
 * That is the right production behaviour and it leaves the whole
 * out-of-hours path untestable: there is no timetable to be outside of. The
 * smoke journey sets the clock to 03:30 and expects checkout to refuse, and
 * it could not, because nothing in the app believed the restaurant was ever
 * shut.
 *
 * Midday to ten, seven days — round, obviously illustrative, and enough for
 * the scheduling and trading-hours rules to bite.
 */
export function demoOpeningHours(): { day: number; opensAt: string; closesAt: string }[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    opensAt: '12:00',
    closesAt: '22:00',
  }));
}

/** The store list with illustrative trading hours applied. */
export function withDemoHours<T extends { openingHours: unknown[] }>(stores: T[]): T[] {
  return stores.map((store) =>
    store.openingHours.length > 0 ? store : { ...store, openingHours: demoOpeningHours() },
  );
}

/**
 * A voucher, so the promo-code path has a code to take.
 *
 * `rewardsData` ships `vouchers: []` — Pappas has issued none, and §15
 * forbids inventing a customer promise, which a discount code is. That
 * leaves the whole promo path untestable: nothing to apply, nothing to
 * reject on a minimum spend, and nothing to lapse in the basket.
 *
 * That last one matters more than it looks. The cart re-decides a voucher
 * against the basket on every change, and expiry was the term left out of
 * that recheck — it charged R214.65 against R246.00 owed, six days after the
 * code had died. The smoke journey exists to hold that fixed, and it needs a
 * code that expires while it watches.
 *
 * `SPICY15` is the code that journey applies. It is deliberately a leftover
 * name from the app this was built from: nothing in the Pappas app displays
 * it, and a Greek-sounding code would be the one that got pasted into a
 * marketing email by mistake.
 */
export function demoVouchers(): Voucher[] {
  const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'demo-voucher-spicy15',
      code: 'SPICY15',
      title: '15% off your order',
      description: 'Illustrative demo voucher. Not a Pappas offer.',
      discountType: 'percentage',
      discountValue: 15,
      minimumSpend: 0,
      expiresAt: inThreeDays,
      used: false,
      expired: false,
    },
  ];
}

/**
 * An address well outside the delivery radius, so the radius rule can be seen
 * to bite.
 *
 * The delivery-range journey used to prove this from the other side: it
 * picked the V&A Waterfront branch, 1 260 km from a Johannesburg address, and
 * checked that the order was refused. Pappas is one restaurant on Nelson
 * Mandela Square, so there is no far-away branch to pick, and both seeded
 * addresses are in Sandton — every combination is comfortably inside the
 * 10 km radius and the rule had nothing left to refuse.
 *
 * A far-away *address* restores the test. These are the real coordinates of
 * the V&A Waterfront in Cape Town, which is 1 260 km from the Square: far
 * enough that no plausible radius includes it, and a place a reader
 * immediately recognises as the wrong end of the country.
 */
export function demoFarAddress(): Address {
  return {
    id: 'address-far',
    label: 'Cape Town',
    line1: 'V&A Waterfront',
    line2: '',
    suburb: 'Victoria & Alfred Waterfront',
    city: 'Cape Town',
    province: 'Western Cape',
    postalCode: '8001',
    latitude: -33.9036,
    longitude: 18.4203,
    instructions: '',
    isDefault: false,
  };
}

/** The address book with the out-of-range address appended. */
export function withDemoAddresses(addresses: Address[]): Address[] {
  if (addresses.length === 0) return addresses;
  return [...addresses, demoFarAddress()];
}
