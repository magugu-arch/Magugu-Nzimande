import { z } from 'zod';
import type { Fixture } from './fixtures';
import { localizedText } from './i18n';
import { venueDayKey } from './time';

export const guideSectionId = z.enum([
  'tickets',
  'wallet',
  'travel',
  'map',
  'access',
  'food',
  'village',
  'crew',
  'hospitality',
]);
export type GuideSectionId = z.infer<typeof guideSectionId>;

/**
 * Venue facts can hurt someone if they are wrong (a step-free route that is
 * not). Every block says whether stadium operations has signed it off.
 */
export const approval = z.enum(['venue_approved', 'awaiting_approval']);
export type Approval = z.infer<typeof approval>;

export const guideAction = z.object({
  label: localizedText,
  url: z.string(),
  kind: z.enum(['official_link', 'phone', 'email']),
});
export type GuideAction = z.infer<typeof guideAction>;

export const guideBlock = z.object({
  id: z.string(),
  icon: z.string(),
  title: localizedText,
  body: localizedText,
  approval,
  action: guideAction.optional(),
});
export type GuideBlock = z.infer<typeof guideBlock>;

export const guideSection = z.object({
  id: guideSectionId,
  icon: z.string(),
  title: localizedText,
  summary: localizedText,
  mediaId: z.string(),
  blocks: z.array(guideBlock),
});
export type GuideSection = z.infer<typeof guideSection>;

export const venuePointKind = z.enum([
  'entrance',
  'step_free',
  'toilet',
  'accessible_toilet',
  'food',
  'shop',
  'support',
  'hospitality',
  'meeting',
]);
export type VenuePointKind = z.infer<typeof venuePointKind>;

export const venuePoint = z.object({
  id: z.string(),
  kind: venuePointKind,
  label: localizedText,
  note: localizedText.optional(),
  /** Position on the schematic, 0 to 1 from the top-left. */
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type VenuePoint = z.infer<typeof venuePoint>;

export const matchdayStage = z.enum(['before', 'arrival', 'inside', 'after']);
export type MatchdayStage = z.infer<typeof matchdayStage>;

export const checklistItem = z.object({
  id: z.string(),
  stage: matchdayStage,
  title: localizedText,
  detail: localizedText,
  section: guideSectionId.optional(),
});
export type ChecklistItem = z.infer<typeof checklistItem>;

export const matchdayGuide = z.object({
  fixtureId: z.string(),
  sections: z.array(guideSection),
  points: z.array(venuePoint),
  checklist: z.array(checklistItem),
  /** True only when the venue has approved the map for navigation. */
  mapApproved: z.boolean(),
});
export type MatchdayGuide = z.infer<typeof matchdayGuide>;

/**
 * The stage of the day a supporter is most likely in, from the clock alone.
 * It only chooses what to show first: the supporter can pick any stage.
 */
export function stageFor(target: Fixture | null, now: Date): MatchdayStage {
  if (!target) return 'before';
  if (target.status === 'live' || target.status === 'half_time') return 'inside';
  if (target.status === 'full_time') return 'after';
  const kickoff = new Date(target.kickoffUtc).getTime();
  const untilKickoff = kickoff - now.getTime();
  if (untilKickoff <= 0) return 'inside';
  const sameDay =
    venueDayKey(now, target.venue.timeZone) ===
    venueDayKey(new Date(kickoff), target.venue.timeZone);
  if (sameDay && untilKickoff <= 3 * 3_600_000) return 'arrival';
  return 'before';
}
