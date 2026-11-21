import { z } from 'zod';
import { localizedText } from './i18n';

/** The visible label every commercial tile carries. There is no unlabelled placement. */
export const placementLabel = z.enum([
  'partner_feature',
  'partner_offer',
  'sponsored',
  'official_shop',
]);
export type PlacementLabel = z.infer<typeof placementLabel>;

export const placement = z.enum([
  'home',
  'match_centre',
  'matchday',
  'passport',
  'fan_zone',
  'partner_world',
]);
export type Placement = z.infer<typeof placement>;

export const partner = z.object({
  id: z.string(),
  name: z.string(),
  category: localizedText,
  description: localizedText,
  /** False for the placeholder slots that stand in until the club names real partners. */
  approved: z.boolean(),
  cta: z.object({ label: localizedText, url: z.string() }).nullable(),
});
export type Partner = z.infer<typeof partner>;

export const campaign = z.object({
  id: z.string(),
  partnerId: z.string(),
  label: placementLabel,
  placement,
  title: localizedText,
  body: localizedText,
  mediaId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  cta: z.object({ label: localizedText, url: z.string() }).nullable(),
  /** Eligibility and redemption terms come from the partner. Null hides redemption. */
  terms: localizedText.nullable(),
  priority: z.number().int(),
  demo: z.boolean(),
});
export type Campaign = z.infer<typeof campaign>;

export function isCampaignRunning(c: Campaign, now: Date): boolean {
  const t = now.getTime();
  return t >= new Date(c.startsAt).getTime() && t < new Date(c.endsAt).getTime();
}

/**
 * One partner module per screen area, never more. When several campaigns
 * target the same placement the highest priority wins and the rest wait.
 */
export function campaignFor(
  where: Placement,
  campaigns: readonly Campaign[],
  now: Date,
): Campaign | null {
  const running = campaigns
    .filter((c) => c.placement === where && isCampaignRunning(c, now))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return running[0] ?? null;
}

export const hospitalityPackage = z.object({
  id: z.string(),
  title: localizedText,
  summary: localizedText,
  mediaId: z.string(),
  includes: z.array(localizedText),
  /** Prices and availability stay with the hospitality system. */
  enquiryUrl: z.string(),
  approval: z.enum(['club_approved', 'awaiting_approval']),
});
export type HospitalityPackage = z.infer<typeof hospitalityPackage>;
