import type { LoyaltyAccount, Promotion, Reward, TierDefinition, Voucher } from '@/types';
import type { ProviderId } from '@/integrations/delivery';

/**
 * Pappas Rewards, and the marketing surfaces that sit beside it.
 *
 * ── Recognition, not coupon clipping ─────────────────────────────────────
 *
 * §8 is the whole design brief for this file in one sentence: "Make loyalty
 * feel like recognition, not coupon clipping." §5 adds "show current
 * recognition / points / next benefit without shouting discount language",
 * and §15 forbids "discount-first messaging" outright.
 *
 * So the tiers below are named for places rather than metals. A "Bronze"
 * member is being told they are the lowest grade of customer; an "Olive"
 * member is being told they belong to something. The perks are hospitality —
 * a table held, a seat at a tasting, a dish sent out — rather than a ladder
 * of delivery discounts, which is the shape the previous scheme had and the
 * shape §15 rules out.
 *
 * ── Why every threshold and point cost is zero ───────────────────────────
 *
 * §15: "Do not invent menu prices, events, opening hours, **loyalty rules**
 * or customer promises."
 *
 * A tier threshold is a loyalty rule. A points cost is a loyalty rule. An
 * earn rate is a loyalty rule and a financial commitment. Nobody has supplied
 * any of them, so none is stated: every threshold and `pointsCost` is 0 and
 * every reward is `redeemable: false`, which renders as "Coming soon" rather
 * than as a number a member might plan around and then find changed.
 *
 * The structure is real and complete — this is a working programme with the
 * commercial numbers left blank, not a sketch. Filling it in is a data
 * change, and `npm run audit:placeholders` lists exactly which fields.
 *
 * ── Channel eligibility ──────────────────────────────────────────────────
 *
 * Every promotion carries `channels`, which the delivery extension §7
 * requires so "a direct-only promotion cannot accidentally be applied to
 * Uber Eats or Mr D". All of them are direct-only today, because a Pappas
 * campaign funded on a commissioned marketplace is a commercial decision
 * nobody has made.
 */

/**
 * Membership tiers.
 *
 * Named for the Mediterranean rather than for metals — §8's "recognition,
 * not coupon clipping" is a naming problem before it is a perks problem. The
 * ids stay on the existing `MembershipTier` union so nothing downstream
 * changes; only what a member reads is different.
 */
export const tiers: TierDefinition[] = [
  {
    tier: 'bronze',
    name: 'Olive',
    threshold: 0,
    perks: [
      'Your favourites remembered',
      'A note from us on your birthday',
      'First to hear about new dishes',
    ],
  },
  {
    tier: 'silver',
    name: 'Aegean',
    threshold: 0,
    perks: [
      'Priority when tables are tight',
      'Invitations to member evenings',
      'Early access to seasonal menus',
    ],
  },
  {
    tier: 'gold',
    name: 'Sunset',
    threshold: 0,
    perks: [
      'A table held for you at short notice',
      'A seat at Pappas tastings',
      'Something from the kitchen, on us',
    ],
  },
  {
    tier: 'black',
    name: 'Square',
    threshold: 0,
    perks: [
      'The window table, when it is free',
      'Private dining enquiries answered first',
      'An invitation to everything we do',
    ],
  },
];

/**
 * Member experiences.
 *
 * §8 asks the rewards home to show "status, progress, available rewards,
 * member experiences and history". These are the experiences — they read as
 * hospitality rather than as vouchers, which is the point.
 *
 * Every one is `redeemable: false` at `pointsCost: 0` until Pappas sets the
 * programme's economics. The app renders that as "Coming soon", not as a
 * free reward.
 */
export const rewards: Reward[] = [
  {
    id: 'reward-chefs-meze',
    name: 'Mezedakia from the kitchen',
    description: 'A plate of small plates, chosen by the kitchen and sent to your table.',
    pointsCost: 0,
    assetKey: 'mezedakia',
    category: 'food',
    redeemable: false,
    termsAndConditions: [
      'Available on a dine-in visit.',
      'Reward economics to be confirmed by Pappas.',
    ],
  },
  {
    id: 'reward-dessert',
    name: 'Dessert, on us',
    description: 'Finish with the baklava. We will take care of it.',
    pointsCost: 0,
    assetKey: 'desserts',
    category: 'food',
    redeemable: false,
    termsAndConditions: ['One per visit.', 'Reward economics to be confirmed by Pappas.'],
  },
  {
    id: 'reward-aperitif',
    name: 'An aperitif at the bar',
    description: 'Arrive early and start at the bar with a drink from us.',
    pointsCost: 0,
    assetKey: 'cocktails',
    category: 'food',
    redeemable: false,
    termsAndConditions: [
      'Available to members of legal drinking age.',
      'Reward economics to be confirmed by Pappas.',
    ],
  },
  {
    id: 'reward-window-table',
    name: 'The window table',
    description: 'When it is free, it is yours — the table looking out onto Nelson Mandela Square.',
    pointsCost: 0,
    assetKey: 'squareView',
    category: 'food',
    redeemable: false,
    termsAndConditions: [
      'Subject to availability on the evening.',
      'Reward economics to be confirmed by Pappas.',
    ],
  },
  {
    id: 'reward-birthday',
    name: 'Your birthday at Pappas',
    description: 'Tell us when it is, and we will make something of it.',
    pointsCost: 0,
    category: 'birthday',
    redeemable: false,
    termsAndConditions: [
      'Requires a date of birth on your profile.',
      'Reward economics to be confirmed by Pappas.',
    ],
  },
];

/**
 * A member's account.
 *
 * Zeroed rather than seeded with a plausible balance. A demo account holding
 * 2,340 points implies an earn rate, which §15 forbids inventing, and it is
 * also the exact seed that hides the state every new member actually starts
 * in — the one the previous app's `new-customer` seed profile existed to
 * expose.
 */
export const loyaltyAccount: LoyaltyAccount = {
  memberId: 'pappas-member',
  pointsBalance: 0,
  tier: 'bronze',
  tierName: 'Olive',
  pointsToNextTier: 0,
  nextTier: 'silver',
  tierProgress: 0,
  lifetimePoints: 0,
  history: [],
};

/**
 * Vouchers in the wallet.
 *
 * Empty. A voucher is a discount with a code, an expiry and a minimum spend —
 * three invented commercial terms in one object. None exists until Pappas
 * issues one.
 */
export const vouchers: Voucher[] = [];

/**
 * A campaign, extended with the channel scoping the delivery extension needs.
 *
 * `Promotion` is the app's existing shape and is kept; `channels` is added
 * because §7 of the delivery extension requires every promotion to carry it.
 * Making it non-optional here means a new campaign cannot be written without
 * somebody deciding which channels may fund it.
 */
export interface PappasPromotion extends Promotion {
  channels: readonly ProviderId[];
  /** §8's audience segmentation, for the notification engine. */
  audience: 'all' | 'members' | 'lapsed' | 'birthday' | 'frequent';
  /** §8: "Build frequency caps … into the product." Hours between sends. */
  frequencyCapHours: number;
}

/**
 * The campaign carousel — §5's "marketing machine".
 *
 * Three campaigns, and every one of them is either named in the brief or
 * describes something the supplied photography shows. Date Night is §17.11's
 * own worked example, headline and body included, so it is quoted rather than
 * written. The other two point at the venue and the bar, which assets 16 and
 * 14 establish.
 *
 * What is deliberately absent: a percentage, a "2 for 1", a countdown, a
 * "limited time only". §15's guardrail against discount-first messaging, and
 * §8's instruction to avoid "shouting discount language". None of these
 * campaigns offers money off, because none has been authorised to.
 *
 * `validUntil` is set a year out rather than invented as a promotional
 * window — these are editorial invitations rather than dated offers, and a
 * fabricated end date is a fabricated customer promise.
 */
const YEAR_FROM_BUILD = '2027-09-19T00:00:00.000Z';
const BUILD_DATE = '2026-09-19T00:00:00.000Z';

export const promotions: PappasPromotion[] = [
  {
    id: 'date-night',
    headline: 'Your Tuesday, elevated.',
    description: 'Discover the Pappas Date Night experience.',
    assetKey: 'squareView',
    ctaLabel: 'Reserve now',
    ctaHref: '/reserve',
    validFrom: BUILD_DATE,
    validUntil: YEAR_FROM_BUILD,
    terms: ['Details of the Date Night experience to be confirmed by Pappas.'],
    usePromotionalComposition: true,
    channels: ['pappas-direct'],
    audience: 'members',
    // §17.11's own example value: one send a week at most.
    frequencyCapHours: 168,
  },
  {
    id: 'the-bar-at-dusk',
    headline: 'The bar, at dusk.',
    description: 'Cocktails, Mediterranean botanicals and the light going gold over the square.',
    assetKey: 'barDetail',
    ctaLabel: 'See the drinks',
    ctaHref: '/menu/drinks',
    validFrom: BUILD_DATE,
    validUntil: YEAR_FROM_BUILD,
    terms: [],
    usePromotionalComposition: true,
    channels: ['pappas-direct'],
    audience: 'all',
    frequencyCapHours: 336,
  },
  {
    id: 'the-fish-market',
    headline: 'Whatever came in this morning.',
    description:
      'Line fish, kingklip, sea bass and dorado — grilled whole, the way the coast does it.',
    assetKey: 'fishMarket',
    ctaLabel: 'See the catch',
    ctaHref: '/menu/fish-market',
    validFrom: BUILD_DATE,
    validUntil: YEAR_FROM_BUILD,
    terms: ['The day’s catch varies. Ask your host what is in.'],
    usePromotionalComposition: false,
    channels: ['pappas-direct'],
    audience: 'all',
    frequencyCapHours: 336,
  },
];
