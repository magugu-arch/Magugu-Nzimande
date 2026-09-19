/**
 * Channel eligibility for promotions and rewards — extension §7 and §8.
 *
 * Two rules from the brief, both commercial rather than technical, and both
 * the kind that costs real money when they are wrong:
 *
 *   §7: "Every promotion must include channel eligibility so a direct-only
 *   promotion cannot accidentally be applied to Uber Eats or Mr D."
 *
 *   §7: "PAPPAS loyalty points/rewards should apply to direct orders unless a
 *   third-party agreement and technical integration explicitly permit
 *   attribution on external orders."
 *
 * The shape of the first rule is the important part. Eligibility is a
 * *required* field on a campaign, not an optional one with a permissive
 * default. A promotion author who forgets to think about channels must get
 * the safe answer — direct only — rather than accidentally funding a discount
 * on a channel that already takes a commission. TypeScript enforces it here
 * by making `channels` non-optional on `PappasCampaign`.
 *
 * The second rule is expressed the same way: `attributesLoyalty` defaults to
 * false for external channels and can only become true by a deliberate
 * per-channel statement, which is exactly what "unless an agreement
 * explicitly permits" means in code.
 */

import type { DeepLinkTarget } from './deepLinks';
import type { ProviderId } from './types';

/** Extension §11's marketing contract, plus the mandatory channel field. */
export interface PappasCampaign {
  id: string;
  title: string;
  eyebrow?: string;
  body: string;
  imageKey?: string;
  ctaLabel: string;
  target: DeepLinkTarget;
  audience?: 'all' | 'members' | 'lapsed' | 'birthday' | 'frequent';
  startsAt?: string;
  endsAt?: string;
  frequencyCapHours?: number;
  /**
   * Which channels this promotion may be redeemed on.
   *
   * Required, deliberately. See the file header: an optional field with a
   * permissive default is how a direct-only offer ends up funded on a
   * commissioned channel.
   */
  channels: readonly ProviderId[];
}

/** Whether a promotion may be applied on a channel. */
export function isPromotionEligible(
  campaign: Pick<PappasCampaign, 'channels'>,
  provider: ProviderId,
): boolean {
  return campaign.channels.includes(provider);
}

/**
 * Whether a campaign is live at a given instant.
 *
 * Absent bounds mean unbounded in that direction: a campaign with no
 * `endsAt` runs until someone ends it. An unparseable date is treated as not
 * live, because a promotion whose window nobody can read should not be
 * silently permanent.
 */
export function isCampaignLive(
  campaign: Pick<PappasCampaign, 'startsAt' | 'endsAt'>,
  now: number = Date.now(),
): boolean {
  if (campaign.startsAt !== undefined) {
    const start = Date.parse(campaign.startsAt);
    if (!Number.isFinite(start) || now < start) return false;
  }
  if (campaign.endsAt !== undefined) {
    const end = Date.parse(campaign.endsAt);
    if (!Number.isFinite(end) || now > end) return false;
  }
  return true;
}

/**
 * Which channels currently attribute Pappas loyalty.
 *
 * Only the direct channel, and this is the correct answer today rather than a
 * placeholder. Loyalty attribution on a marketplace order requires the
 * marketplace to tell Pappas who the customer was, which is a commercial
 * term in a merchant agreement, not a setting. Neither agreement exists.
 *
 * When one does, the change is to add the channel to this set and to say so
 * in `docs/DELIVERY_INTEGRATION.md`. Until then, `earnsLoyalty` returning
 * false for an external order is what stops the rewards screen promising
 * points that will never arrive.
 */
const LOYALTY_ATTRIBUTING: ReadonlySet<ProviderId> = new Set<ProviderId>(['pappas-direct']);

export function earnsLoyalty(provider: ProviderId): boolean {
  return LOYALTY_ATTRIBUTING.has(provider);
}

/**
 * The sentence shown under the rewards total when a channel does not earn.
 *
 * Kept beside the rule so the two cannot drift, and worded as a statement of
 * fact rather than an apology or an upsell — §15's guardrail against
 * discount-first messaging applies to the absence of a discount too.
 */
export function loyaltyNoteFor(provider: ProviderId): string | null {
  if (earnsLoyalty(provider)) return null;
  return 'Pappas Rewards are earned on orders placed directly with Pappas.';
}
