import { config } from '@/constants/config';
import type {
  MembershipTier,
  LoyaltyAccount,
  PointsEntry,
  Promotion,
  Reward,
  TierDefinition,
  Voucher,
} from '@/types';

/**
 * bb.q Rewards tiers (brief §11).
 *
 * ── Why the earn rate is a number and not a sentence ───────────────────────
 * Every tier here used to advertise its rate as hand-typed copy — Silver said
 * "1.25 points per R1 spent", Gold "1.5", Black "2" — while `randToPoints`
 * paid a flat 1 to everybody from `businessRules.pointsPerRand`. A Silver
 * member read a promise on the rewards screen that the app had no code to
 * keep, and nothing anywhere could notice, because a string and a constant
 * cannot disagree with each other.
 *
 * `pointsPerRand` is now the rate, and `perksFor` writes the sentence from it.
 * The two cannot drift again: change the number and the copy follows; change
 * the copy and there is nothing to change, because it is not written down.
 *
 * **All four are 1 deliberately.** That is what the app pays today, so this
 * change makes the screen honest without inventing a programme. The multiplier
 * is a margin decision — it has to be set against the redemption rate, or the
 * programme pays out at a ratio nobody chose — and `audit:launch` still asks
 * for it. When bb.q decides, it is one number per tier and both the payout and
 * the advertised line move together.
 */
export const tiers: TierDefinition[] = [
  {
    tier: 'bronze',
    name: 'Bronze',
    threshold: 0,
    pointsPerRand: 1,
    perks: ['Birthday treat', 'Members-only offers'],
  },
  {
    tier: 'silver',
    name: 'Silver',
    threshold: 1500,
    pointsPerRand: 1.25,
    perks: ['Free delivery twice a month', 'Early access to new drops'],
  },
  {
    tier: 'gold',
    name: 'Gold',
    threshold: 4000,
    pointsPerRand: 1.5,
    perks: ['Free delivery every week', 'Priority kitchen queue'],
  },
  {
    tier: 'black',
    name: 'Black',
    threshold: 9000,
    pointsPerRand: 2,
    perks: ['Unlimited free delivery', 'Invitations to bb.q tasting events'],
  },
];

/**
 * How a tier describes its earn rate, written from the rate itself.
 *
 * "1 point per R1 spent" rather than "1 points", and `1.25` prints as typed
 * rather than as `1.2500000000000002` — the rate is a decimal and this is the
 * one place it becomes words.
 */
export function earnRateLine(pointsPerRand: number): string {
  const rate = Number(pointsPerRand.toFixed(2));
  return `${rate} ${rate === 1 ? 'point' : 'points'} per R1 spent`;
}

/** A tier's perks, with its true earn rate at the top. */
/**
 * What one tier earns per rand, by name.
 *
 * The rate lives on the ladder and the member record carries only a tier, so
 * anything that needs the rate has to come through here rather than keep its
 * own copy. Falls back to the flat business rule for a tier the ladder does
 * not describe — a guest, or a tier a backend invents that this build predates.
 */
export function earnRateFor(tier: MembershipTier): number {
  return tiers.find((definition) => definition.tier === tier)?.pointsPerRand ?? 1;
}

export function perksFor(tier: TierDefinition): string[] {
  return [earnRateLine(tier.pointsPerRand), ...tier.perks];
}

/**
 * How the programme as a whole earns, for copy that speaks about the ladder
 * rather than about one tier.
 *
 * Written from the ladder because the interesting half of the sentence is
 * conditional. The help section used to answer "How do bb.q Rewards points
 * work?" with *"You earn 1 point per R1 spent on food, and more as you move up
 * tiers"* — and no tier paid more. It read as true because it described the
 * programme anyone would assume was there, and only the four `pointsPerRand`
 * values say whether it is. So the clause about moving up appears when there
 * is a climb to describe and vanishes when there is not, rather than being a
 * promise somebody has to remember to withdraw.
 */
export function programmeEarnRateLine(ladder: TierDefinition[] = tiers): string {
  const ranked = [...ladder].sort((a, b) => a.threshold - b.threshold);
  const entry = ranked[0];
  if (!entry) return '';

  const best = ranked.reduce((a, b) => (b.pointsPerRand > a.pointsPerRand ? b : a));
  const base = `You earn ${earnRateLine(entry.pointsPerRand)} on food`;
  return best.pointsPerRand > entry.pointsPerRand
    ? `${base}, rising to ${earnRateLine(best.pointsPerRand)} at ${best.name}`
    : base;
}

/** A tier by its programme name, for copy that singles one out. */
export function tierNamed(name: string, ladder: TierDefinition[] = tiers): TierDefinition {
  const found = ladder.find((tier) => tier.name === name);
  if (!found) throw new Error(`No such tier: ${name}`);
  return found;
}

/** The tier a member is climbing toward, or undefined at the top of the ladder. */
export function nextTierOf(
  account: Pick<LoyaltyAccount, 'nextTier'>,
  ladder: TierDefinition[] = tiers,
): TierDefinition | undefined {
  return ladder.find((tier) => tier.tier === account.nextTier);
}

/**
 * "a, b and c" — a list read aloud rather than bulleted.
 *
 * South African usage, so no serial comma before "and".
 */
export function listSentence(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Where a member stands, read off the ladder.
 *
 * Lives here rather than in `rewardsService` because the seeded account needs
 * it too, and that was the whole defect: the seed wrote out `tier: 'silver'`,
 * `pointsToNextTier: 2160` and a `tierProgress` fraction over thresholds typed
 * a second time, while the service computed the same five fields from `tiers`.
 * They disagreed. At the seeded lifetime total of 4 620 the ladder says Gold
 * with 4 380 to go, so a member who opened the app on Silver was promoted a
 * whole tier by their first order — not for crossing a threshold, but because
 * the first recompute overwrote a standing that had never been consistent.
 *
 * One implementation, used by both, and the seed now chooses only the two
 * figures that are genuinely its own.
 */
export function standingFor(
  lifetimePoints: number,
  ladder: TierDefinition[] = tiers,
): Pick<
  LoyaltyAccount,
  'tier' | 'tierName' | 'nextTier' | 'pointsToNextTier' | 'tierProgress' | 'lifetimePoints'
> {
  const ranked = [...ladder].sort((a, b) => a.threshold - b.threshold);
  const currentIndex = Math.max(
    0,
    ranked.filter((candidate) => lifetimePoints >= candidate.threshold).length - 1,
  );
  const current = ranked[currentIndex]!;
  const next = ranked[currentIndex + 1];

  return {
    lifetimePoints,
    tier: current.tier,
    tierName: current.name,
    ...(next ? { nextTier: next.tier } : {}),
    pointsToNextTier: next ? Math.max(0, next.threshold - lifetimePoints) : 0,
    tierProgress: next
      ? Math.min(
          1,
          Math.max(
            0,
            (lifetimePoints - current.threshold) / (next.threshold - current.threshold || 1),
          ),
        )
      : 1,
  };
}

export const rewards: Reward[] = [
  {
    id: 'reward-fries',
    name: 'Free French Fries',
    description: 'A regular portion of our thick-cut fries, on the house.',
    pointsCost: 400,
    assetKey: 'frenchFries',
    category: 'food',
    redeemable: true,
    termsAndConditions: [
      'Redeemable on any order over R100.',
      'One reward per order.',
      'Cannot be combined with another voucher.',
    ],
  },
  {
    id: 'reward-cheesling-fries',
    name: 'Free Cheesling Fries',
    description: 'Upgrade to the fries everyone actually fights over.',
    pointsCost: 650,
    assetKey: 'cheeslingFries',
    category: 'food',
    redeemable: true,
    termsAndConditions: ['Redeemable on any order over R150.', 'One reward per order.'],
  },
  {
    id: 'reward-delivery',
    name: 'Free Delivery',
    description: 'We cover the delivery fee on your next order.',
    pointsCost: 300,
    category: 'delivery',
    redeemable: true,
    termsAndConditions: ['Delivery orders only.', 'Valid within standard delivery zones.'],
  },
  {
    id: 'reward-wings',
    name: 'Free 6 Golden Original Wings',
    description: 'Six wings added to your order, no charge.',
    pointsCost: 1200,
    assetKey: 'goldenOriginalWings',
    category: 'food',
    redeemable: true,
    termsAndConditions: ['Redeemable on any order over R250.', 'One reward per order.'],
  },
  /**
   * A reward with a date on it, which none of them had.
   *
   * `rewardExpired` is read in three places — the reward screen, the
   * redeemable filter and the per-reward `redeemable` flag — and every one of
   * the seven seeded rewards had `expiresAt` undefined, so all three read
   * "never expires" and the enforcement had nothing to enforce. The caption
   * that prints the date had never rendered either.
   *
   * Ten days out, so it is live and shows its date. The lapsed case is the
   * next entry.
   */
  {
    id: 'reward-r50',
    name: 'R50 off your order',
    description: 'Straight R50 off anything on the menu.',
    pointsCost: 1000,
    category: 'discount',
    expiresAt: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    redeemable: true,
    termsAndConditions: [
      'Minimum spend R200.',
      'Excludes delivery and service fees.',
      'Available for a limited time.',
    ],
  },
  /**
   * One that ran out, which is the state a member writes in about.
   *
   * Seeded `redeemable: true` deliberately. The point of the fixture is that
   * the date overrules the flag: `redeemableRewards` and the reward screen
   * both derive redeemability from `rewardExpired` rather than trusting what
   * the record claims, and this is the only case where the two disagree. A
   * fixture that agreed with itself would prove nothing.
   */
  {
    id: 'reward-heritage',
    name: 'R100 off, Heritage Day',
    description: 'Our Heritage Day thank-you. This one has closed.',
    pointsCost: 1800,
    category: 'discount',
    expiresAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    redeemable: true,
    termsAndConditions: ['Minimum spend R350.', 'Heritage Day promotion, September only.'],
  },
  {
    id: 'reward-half-and-half',
    name: 'Free Half & Half Chicken',
    description: 'A medium Half & Half, entirely on us. The big one.',
    pointsCost: 3500,
    assetKey: 'halfAndHalf',
    category: 'food',
    redeemable: false,
    termsAndConditions: [
      'Redeemable on any order over R300.',
      'Medium size only; upgrade at own cost.',
    ],
  },
  {
    id: 'reward-birthday',
    name: 'Birthday Boneless Box',
    description: 'Our gift to you during your birthday month.',
    pointsCost: 0,
    assetKey: 'boneless',
    category: 'birthday',
    redeemable: false,
    termsAndConditions: [
      'Unlocks in your birthday month.',
      'Add your date of birth to your profile to qualify.',
    ],
  },
];

export const vouchers: Voucher[] = [
  {
    id: 'voucher-welcome',
    code: 'WELCOME50',
    title: 'R50 off your first order',
    description: 'Welcome to bb.q. Here is R50 towards your first box.',
    discountType: 'fixed',
    discountValue: 50,
    minimumSpend: 200,
    expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    used: false,
    expired: false,
  },
  {
    id: 'voucher-freedel',
    code: 'FREEDEL',
    title: 'Free delivery',
    description: 'Delivery on us, any order over R150.',
    discountType: 'freeDelivery',
    discountValue: 0,
    minimumSpend: 150,
    expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    used: false,
    expired: false,
  },
  /**
   * The fourth discount mechanic, which nothing had ever used.
   *
   * `discountType` has four members and the wallet has a case for each — the
   * `freeItem` one prints "Free item". Three vouchers were `fixed`, one
   * `freeDelivery`, one `percentage`, and `freeItem` had never been seeded, so
   * the only arithmetic behind that label had never run against anything.
   *
   * What it does is take a rand amount off, exactly like `fixed`:
   * `voucherDiscount` returns `Math.min(discountValue, subtotal)` for both. So
   * the wallet promises an item and the basket removes a number that has
   * nothing to do with any item, and nothing anywhere says *which* item is
   * free — `Voucher` had no field that could.
   */
  {
    id: 'voucher-freefries',
    code: 'FRIESONUS',
    title: 'Free French Fries',
    description: 'A regular French Fries on us with any chicken box.',
    discountType: 'freeItem',
    freeProductId: 'french-fries',
    discountValue: 0,
    minimumSpend: 150,
    expiresAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
    used: false,
    expired: false,
    assetKey: 'frenchFries',
  },
  {
    id: 'voucher-spicy15',
    code: 'SPICY15',
    title: '15% off Hot Spicy',
    description: 'Fifteen percent off when the heat is on.',
    discountType: 'percentage',
    discountValue: 15,
    minimumSpend: 150,
    expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    used: false,
    expired: false,
    assetKey: 'hotSpicy',
  },
  {
    id: 'voucher-used',
    code: 'SOYFAN',
    title: 'R30 off Soy Garlic',
    description: 'Already used on your last order.',
    discountType: 'fixed',
    discountValue: 30,
    minimumSpend: 120,
    expiresAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    used: true,
    expired: true,
    assetKey: 'soyGarlic',
  },
  /**
   * The one that ran out before anybody spent it.
   *
   * Every seeded voucher was either live or *both* used and expired, so the
   * screen's three-way caption — "Already used" / "Expired 12 Aug" /
   * "Expires 12 Aug" — only ever took two of its branches. `used` is tested
   * first, so the red expired line had never rendered in the app: the only
   * voucher past its date was also spent, and said so.
   *
   * That is also the state a customer actually writes in about. "Used" is a
   * receipt; this is the one they meant to get to and did not, and it is the
   * only case where the date on the card is the whole explanation.
   */
  {
    id: 'voucher-lapsed',
    code: 'CHEESE40',
    title: 'R40 off Cheesling Fries',
    description: 'Sent during the launch week. It ran out before you got to it.',
    discountType: 'fixed',
    discountValue: 40,
    minimumSpend: 150,
    expiresAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    used: false,
    expired: true,
    assetKey: 'cheeslingFries',
  },
];

/**
 * The ledger, with the order rows written from the orders.
 *
 * Two of these describe an order and both of them lied about it. The entry for
 * BBQ-4821 credited 231 points while the order's own receipt says 287; BBQ-4610
 * was credited 318 against a receipt of 304. Nobody had put the two screens
 * side by side — the receipt is in Orders and the ledger is in Rewards — and
 * the numbers were typed independently, so there was nothing to notice with.
 *
 * The reference was typed twice as well: once inside the sentence and once in
 * `orderReference`, which no screen read. A fact must be derived, never
 * restated beside itself.
 *
 * So the order rows are built from the ledger of orders: the reference, the
 * first line's name and the points all come off the order, and the sentence is
 * assembled rather than written. `orderPointsEntry` is given the order by
 * `orderService`, which owns them — this file has no business importing that
 * one, and a circular import is the least of the reasons.
 */
export function orderPointsEntry(
  id: string,
  order: { reference: string; lines: { name: string }[]; totals: { pointsEarned: number } },
  occurredAt: Date,
): PointsEntry {
  const first = order.lines[0]?.name;
  return {
    id,
    description: first ? `Order ${order.reference} · ${first}` : `Order ${order.reference}`,
    points: order.totals.pointsEarned,
    occurredAt: occurredAt.toISOString(),
    orderReference: order.reference,
  };
}

/**
 * The rows that are not about an order, which have nothing to derive from.
 *
 * A redemption and a tier bonus are events in the programme rather than
 * records of a basket, so they are written here and stay written here.
 */
const seededHistory: PointsEntry[] = [
  {
    id: 'points-2',
    description: 'Redeemed · Free French Fries',
    points: -400,
    occurredAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
  },
  {
    id: 'points-4',
    description: 'Tier bonus · Silver unlocked',
    points: 250,
    occurredAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
  },
];

/** What is left to spend. The one figure about this member that is a choice. */
const SEEDED_BALANCE = 1840;

/**
 * Everything ever earned: what is left, plus everything already spent.
 *
 * Derived rather than typed, and that is the fix. It used to read `4620`, a
 * number picked without reference to the thresholds it has to sit between —
 * and 4 620 is past Gold's 4 000, so the ladder made this member Gold while
 * the seed underneath called them Silver. Spending points must not cost
 * anybody a tier, so redemptions are added back.
 */
const SEEDED_LIFETIME =
  SEEDED_BALANCE +
  seededHistory
    .filter((entry) => entry.points < 0)
    .reduce((spent, entry) => spent + Math.abs(entry.points), 0);

/**
 * A member who has reached the top of the ladder.
 *
 * Black asks for 9 000 lifetime points and the seeded member has about 2 240,
 * so the top rung could only be reached by placing thirty-odd orders in one
 * session. Everything the app says to somebody who has arrived — "You're at
 * our top tier", and the notification reading "Black is the top of bb.q
 * Rewards. Everything is unlocked." — was written, styled, and rendered for
 * nobody.
 *
 * Derived from the ladder rather than typed, so a threshold that moves takes
 * this with it: the top tier's own requirement plus a margin, which is what
 * having arrived actually looks like. `standingFor` then answers `nextTier`
 * undefined, `pointsToNextTier` nought and `tierProgress` one, and every
 * branch that reads those has something to read.
 */
const TOP_TIER_LIFETIME = Math.max(...tiers.map((tier) => tier.threshold)) + 1_250;

export const loyaltyAccount: LoyaltyAccount = {
  memberId: 'BBQ-SA-004182',
  pointsBalance: SEEDED_BALANCE,
  // tier, tierName, nextTier, pointsToNextTier and tierProgress are all read
  // off the ladder. None of them is an independent fact about this member.
  ...standingFor(config.seedProfile === 'top-tier' ? TOP_TIER_LIFETIME : SEEDED_LIFETIME),
  history: seededHistory,
};

/**
 * Home and offers promotions. Fully data-driven (brief §11): artwork, copy,
 * CTA target, validity and terms all come from here, never from a screen.
 */
export const promotions: Promotion[] = [
  {
    id: 'promo-honey-garlic',
    headline: 'Honey Garlic, glazed to order',
    description: 'Sticky, garlicky and finished by hand. Our most-ordered box, two weeks only.',
    assetKey: 'honeyGarlic',
    ctaLabel: 'Order now',
    ctaHref: '/product/honey-garlic',
    validFrom: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    validUntil: new Date(Date.now() + 11 * 86_400_000).toISOString(),
    terms: ['While stocks last.', 'Available at participating stores.'],
    usePromotionalComposition: true,
  },
  {
    id: 'promo-first-order',
    headline: 'R50 off your first order',
    description: 'New to bb.q? Use code WELCOME50 at checkout on orders over R200.',
    assetKey: 'goldenOriginal',
    ctaLabel: 'Claim R50',
    ctaHref: '/(tabs)/menu',
    promoCode: 'WELCOME50',
    validFrom: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    validUntil: new Date(Date.now() + 45 * 86_400_000).toISOString(),
    terms: [
      'Valid on your first order only.',
      'Minimum spend R200.',
      'Cannot be combined with other offers.',
    ],
    usePromotionalComposition: true,
  },
  {
    id: 'promo-half-and-half',
    headline: 'Half & Half. Both, obviously.',
    description:
      'Golden Original on one side, Hot Spicy on the other. One box, no arguments at the table.',
    assetKey: 'halfAndHalf',
    ctaLabel: 'Build your box',
    ctaHref: '/product/half-and-half',
    validFrom: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    validUntil: new Date(Date.now() + 40 * 86_400_000).toISOString(),
    terms: ['Available in medium and large.', 'Flavour choice subject to availability.'],
    usePromotionalComposition: true,
  },
  {
    id: 'promo-spicy-tuesday',
    headline: 'Spicy Tuesday',
    description: '15% off every Hot Spicy box, every Tuesday. Bring a drink.',
    assetKey: 'hotSpicy',
    ctaLabel: 'See the heat',
    ctaHref: '/product/hot-spicy',
    promoCode: 'SPICY15',
    validFrom: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    validUntil: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    terms: ['Tuesdays only.', 'Discount applies to Hot Spicy items only.'],
    usePromotionalComposition: true,
  },
  {
    id: 'promo-korean-rice-bowl',
    headline: 'The Korean Rice Bowl has landed',
    description:
      'Glazed chicken over steamed rice with kimchi, cucumber, carrot and a fried egg. One bowl, everything in it.',
    assetKey: 'koreanRiceBowl',
    ctaLabel: 'Try the bowl',
    ctaHref: '/product/korean-rice-bowl',
    validFrom: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    validUntil: new Date(Date.now() + 50 * 86_400_000).toISOString(),
    terms: ['Available at participating stores.'],
    usePromotionalComposition: true,
  },
  {
    id: 'promo-cheesling-fries',
    headline: 'Cheesling Fries, loaded',
    description:
      'Our fries under cheese sauce, spring onion and chilli. Add them to any box for R55.',
    assetKey: 'cheeslingFries',
    ctaLabel: 'Add to my order',
    ctaHref: '/product/cheesling-fries',
    validFrom: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    validUntil: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    terms: ['Add-on price applies with any chicken box.', 'While stocks last.'],
    usePromotionalComposition: true,
  },
  {
    id: 'promo-ddeok-bokki',
    headline: 'Ddeok-Bokki, two ways',
    description:
      'The fiery original, or the rosé version softened with cream. Chewy rice cakes either way.',
    assetKey: 'ddeokBokki',
    ctaLabel: 'Pick your sauce',
    ctaHref: '/product/ddeok-bokki',
    validFrom: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    validUntil: new Date(Date.now() + 45 * 86_400_000).toISOString(),
    terms: ['Available at participating stores.'],
    usePromotionalComposition: true,
  },
  {
    id: 'promo-free-delivery',
    headline: 'Free delivery over R350',
    description: 'Fill the box, skip the fee. Automatically applied at checkout.',
    assetKey: 'soyGarlic',
    ctaLabel: 'Start an order',
    ctaHref: '/(tabs)/menu',
    validFrom: new Date(Date.now() - 60 * 86_400_000).toISOString(),
    validUntil: new Date(Date.now() + 120 * 86_400_000).toISOString(),
    terms: ['Applies to delivery orders within standard zones.'],
    usePromotionalComposition: false,
  },
  /**
   * The two below are outside their window on purpose, and they are the only
   * reason `fetchPromotions`' validity filter has ever removed anything.
   *
   * Every promotion seeded before them was live, so the filter ran eight times
   * a session and never once changed its answer, and `fetchPromotion`'s
   * "That offer has ended" throw had never fired in the life of this app. A
   * branch nothing reaches is a branch nobody has read.
   *
   * Both states are ordinary in a running promotions calendar: marketing sets
   * an end date, and a campaign is loaded days before it opens. What makes
   * them worth seeding is that a customer can still arrive at either — a push
   * notification sent last week, a link forwarded in a family group, a
   * screenshot. The list will not show them. The detail screen has to.
   */
  {
    id: 'promo-heritage-braai',
    headline: 'Heritage Day braai box',
    description: 'The sharing box we ran over Heritage Day. Back again next year.',
    assetKey: 'halfAndHalf',
    ctaLabel: 'See what else is on',
    ctaHref: '/offers',
    validFrom: new Date(Date.now() - 40 * 86_400_000).toISOString(),
    validUntil: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    terms: ['This offer has closed.', 'Ran at participating stores.'],
    usePromotionalComposition: true,
  },
  {
    id: 'promo-sweet-potato-launch',
    headline: 'Sweet Potato Fries are coming',
    description: 'Landing on the menu shortly. We will let you know the day they do.',
    assetKey: 'sweetPotatoFries',
    ctaLabel: 'Browse the menu',
    ctaHref: '/(tabs)/menu',
    validFrom: new Date(Date.now() + 12 * 86_400_000).toISOString(),
    validUntil: new Date(Date.now() + 55 * 86_400_000).toISOString(),
    terms: ['Availability varies by store.'],
    usePromotionalComposition: true,
  },
];
