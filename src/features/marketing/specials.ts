import type { AppNotification, AppPreferences, NotificationPreferences } from '@/types';
import type { PappasPromotion } from '@/services/data/rewardsData';

/**
 * Who gets told about a special, and when.
 *
 * ── The gap this closes ──────────────────────────────────────────────────
 *
 * `PappasPromotion` has carried `audience` and `frequencyCapHours` since the
 * campaign model was written — §8 asks for audience segmentation and for
 * frequency caps to be "built into the product" — and nothing read either
 * field. Every campaign declared who it was for and how often it could be
 * sent, and the app showed all of them to everybody, always.
 *
 * That is the same class of defect as a declared analytics event with no call
 * site: the data says the feature exists and the behaviour says it does not,
 * and nothing fails while the two disagree.
 *
 * ── The four gates ───────────────────────────────────────────────────────
 *
 * A special reaches a customer only if it passes all four, in this order.
 * The order matters: consent is checked before anything else, so a customer
 * who has opted out is never even evaluated against a campaign.
 *
 *   1. **Consent.** Marketing consent withdrawn, or promotions switched off,
 *      and nothing marketing-shaped is shown at all. POPIA, and §13.
 *   2. **Window.** `validFrom` and `validUntil`, against the clock. An offer
 *      shown after it ends is a promise the restaurant has to honour or
 *      explain.
 *   3. **Audience.** A birthday campaign to somebody whose birthday it is
 *      not reads as a mistake, because it is one.
 *   4. **Frequency cap.** How long since this customer was last sent
 *      *anything*. A restaurant that messages twice in an evening gets its
 *      notifications turned off, and then cannot reach anybody at all.
 *
 * Every gate is a pure function of its inputs — no clock read inside, no
 * store access — so the whole engine is testable without a renderer, and the
 * caller decides what "now" means.
 */

/** What the engine knows about the person it is deciding for. */
export interface MarketingAudience {
  /** Has ever placed an order. */
  hasOrdered: boolean;
  /** Orders in the last ninety days, for the `frequent` segment. */
  recentOrderCount: number;
  /** Days since their last order, or null if they have never ordered. */
  daysSinceLastOrder: number | null;
  /** True on the day itself, which is the only day a birthday offer is not odd. */
  isBirthday: boolean;
}

/** When this customer was last sent a marketing message, in epoch millis. */
export type LastSentAt = number | null;

/**
 * Consent, read from the two places it lives.
 *
 * `marketingConsent` is the POPIA-level permission and `promotions` is the
 * per-channel preference. Either one off means no marketing. They are
 * separate because withdrawing consent and muting a category are different
 * acts, and a customer who does the second has not done the first.
 */
export function hasMarketingConsent(
  preferences: Pick<AppPreferences, 'marketingConsent'>,
  notifications: Pick<NotificationPreferences, 'promotions'>,
): boolean {
  return preferences.marketingConsent && notifications.promotions;
}

/** Whether the clock is inside the campaign's own window. */
export function isLive(
  special: Pick<PappasPromotion, 'validFrom' | 'validUntil'>,
  now: Date,
): boolean {
  const from = Date.parse(special.validFrom);
  const until = Date.parse(special.validUntil);
  if (!Number.isFinite(from) || !Number.isFinite(until)) return false;
  const at = now.getTime();
  return at >= from && at <= until;
}

/**
 * Whether this campaign is aimed at this person.
 *
 * `lapsed` is deliberately "ordered once and then stopped", not "has never
 * ordered". Somebody who has never ordered has not lapsed, they have not
 * started, and a "we miss you" message to them is the kind of thing that
 * makes an app feel like it is talking to somebody else.
 */
export function matchesAudience(
  special: Pick<PappasPromotion, 'audience'>,
  audience: MarketingAudience,
): boolean {
  switch (special.audience) {
    case 'all':
      return true;
    case 'members':
      return audience.hasOrdered;
    case 'frequent':
      return audience.recentOrderCount >= 3;
    case 'lapsed':
      return (
        audience.hasOrdered &&
        audience.daysSinceLastOrder !== null &&
        audience.daysSinceLastOrder >= 60
      );
    case 'birthday':
      return audience.isBirthday;
    default:
      return false;
  }
}

/**
 * Whether enough time has passed since the last marketing message.
 *
 * Measured against the last send of *anything*, not of this campaign.
 * Per-campaign caps let three campaigns each stay politely under their own
 * limit and arrive together, which is exactly the evening that gets push
 * notifications switched off for good.
 */
export function withinFrequencyCap(
  special: Pick<PappasPromotion, 'frequencyCapHours'>,
  lastSentAt: LastSentAt,
  now: Date,
): boolean {
  if (lastSentAt === null) return true;
  const hoursSince = (now.getTime() - lastSentAt) / 3_600_000;
  return hoursSince >= special.frequencyCapHours;
}

export interface EligibilityInput {
  specials: readonly PappasPromotion[];
  audience: MarketingAudience;
  preferences: Pick<AppPreferences, 'marketingConsent'>;
  notifications: Pick<NotificationPreferences, 'promotions'>;
  lastSentAt: LastSentAt;
  now: Date;
}

/**
 * Every special this customer should be told about, in order.
 *
 * Returns an array rather than one, because the *surfaces* differ in how many
 * they can carry: the notification inbox takes several, a home banner takes
 * one. Picking which is the caller's job; deciding which are allowed at all
 * is this function's.
 */
export function eligibleSpecials(input: EligibilityInput): PappasPromotion[] {
  if (!hasMarketingConsent(input.preferences, input.notifications)) return [];

  return input.specials.filter(
    (special) =>
      isLive(special, input.now) &&
      matchesAudience(special, input.audience) &&
      withinFrequencyCap(special, input.lastSentAt, input.now),
  );
}

/**
 * The one to put on a single surface.
 *
 * The narrowest audience wins. A birthday message and a general one are both
 * eligible on somebody's birthday, and showing them the general one is a
 * worse outcome than showing nobody anything — it spends the one moment that
 * was actually personal on something that was not.
 */
const AUDIENCE_RANK: Record<PappasPromotion['audience'], number> = {
  birthday: 0,
  lapsed: 1,
  frequent: 2,
  members: 3,
  all: 4,
};

export function headlineSpecial(input: EligibilityInput): PappasPromotion | null {
  const eligible = eligibleSpecials(input);
  if (eligible.length === 0) return null;

  return [...eligible].sort((a, b) => AUDIENCE_RANK[a.audience] - AUDIENCE_RANK[b.audience])[0]!;
}

/**
 * A special, as it appears in the notification inbox.
 *
 * The id is derived from the campaign rather than generated, so the same
 * campaign cannot arrive twice under two ids — the inbox de-duplicates on it,
 * and a campaign re-evaluated on every app open would otherwise stack up.
 */
export function notificationFor(special: PappasPromotion, receivedAt: Date): AppNotification {
  return {
    id: `special-${special.id}`,
    title: special.headline,
    body: special.description,
    receivedAt: receivedAt.toISOString(),
    read: false,
    category: 'promotion',
    href: special.ctaHref,
  };
}

/**
 * Fold eligible specials into the inbox, without duplicating what is there.
 *
 * Newest first, matching the inbox's own order.
 */
export function mergeSpecialsIntoInbox(
  existing: readonly AppNotification[],
  specials: readonly PappasPromotion[],
  receivedAt: Date,
): AppNotification[] {
  const seen = new Set(existing.map((entry) => entry.id));
  const added = specials
    .map((special) => notificationFor(special, receivedAt))
    .filter((entry) => !seen.has(entry.id));

  return [...added, ...existing];
}
