import { z } from 'zod';
import {
  campaignFor,
  placement,
  placementLabel,
  type Campaign,
  type Placement,
} from '@scarlets/domain';
import { officialLinks, type OfficialLinkId } from '@scarlets/adapters';
import { isoInstant, optionalText, requiredText } from './validation';

export const CAMPAIGN_LIMITS = { title: 80, body: 220 } as const;

const linkIds = Object.keys(officialLinks) as [OfficialLinkId, ...OfficialLinkId[]];

export const campaignFields = z
  .object({
    partnerId: z.string('Choose a partner slot.').min(1, 'Choose a partner slot.'),
    /** The label supporters see. Required: there is no unlabelled placement. */
    label: placementLabel,
    placement,
    titleEn: requiredText('an English title', CAMPAIGN_LIMITS.title),
    titleCy: optionalText('the Welsh title', CAMPAIGN_LIMITS.title),
    bodyEn: requiredText('English body text', CAMPAIGN_LIMITS.body),
    bodyCy: optionalText('the Welsh body text', CAMPAIGN_LIMITS.body),
    mediaId: z.string('Choose an image.').min(1, 'Choose an image.'),
    startsAt: isoInstant('Choose when the campaign starts.'),
    endsAt: isoInstant('Choose when the campaign ends.'),
    /** A campaign may link only to an official destination, or nowhere. */
    cta: z.enum(['none', ...linkIds], 'Choose an official link, or no link.').default('none'),
  })
  .refine((value) => new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(), {
    message: 'The campaign must end after it starts.',
    path: ['endsAt'],
  });
export type CampaignFields = z.infer<typeof campaignFields>;

interface Window {
  startsAt: string;
  endsAt: string;
}

/** Windows are half-open: one may start at the instant another ends. */
export function windowsOverlap(a: Window, b: Window): boolean {
  return (
    new Date(a.startsAt).getTime() < new Date(b.endsAt).getTime() &&
    new Date(b.startsAt).getTime() < new Date(a.endsAt).getTime()
  );
}

/**
 * One running campaign per placement. The first approved campaign that
 * shares the candidate's placement and overlaps its dates, or null.
 */
export function findPlacementConflict(
  candidate: Campaign,
  approved: readonly Campaign[],
): Campaign | null {
  return (
    approved.find(
      (other) =>
        other.id !== candidate.id &&
        other.placement === candidate.placement &&
        windowsOverlap(candidate, other),
    ) ?? null
  );
}

export type CampaignTiming = 'upcoming' | 'running' | 'ended';

export function campaignTiming(campaign: Window, now: Date): CampaignTiming {
  const t = now.getTime();
  if (t < new Date(campaign.startsAt).getTime()) return 'upcoming';
  if (t >= new Date(campaign.endsAt).getTime()) return 'ended';
  return 'running';
}

export const campaignTimingLabels: Record<CampaignTiming, string> = {
  upcoming: 'Not started',
  running: 'Running now',
  ended: 'Ended',
};

/** What each screen area shows right now, resolved the way the app resolves it. */
export function runningByPlacement(
  approved: readonly Campaign[],
  now: Date,
): Record<Placement, Campaign | null> {
  return Object.fromEntries(
    placement.options.map((where) => [where, campaignFor(where, approved, now)]),
  ) as Record<Placement, Campaign | null>;
}
