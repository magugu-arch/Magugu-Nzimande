import { z } from 'zod';
import { localizedText, translationStatus } from './i18n';

export const contentCategory = z.enum([
  'first_team',
  'women',
  'academy',
  'community',
  'history',
  'club',
  'matchday',
]);
export type ContentCategory = z.infer<typeof contentCategory>;

export const contentKind = z.enum(['news', 'feature', 'report', 'video', 'audio']);
export type ContentKind = z.infer<typeof contentKind>;

export const contentStatus = z.enum(['draft', 'scheduled', 'published', 'archived']);
export type ContentStatus = z.infer<typeof contentStatus>;

export const contentItem = z.object({
  id: z.string(),
  kind: contentKind,
  category: contentCategory,
  title: localizedText,
  summary: localizedText,
  /** One entry per paragraph. */
  body: z.array(localizedText),
  mediaId: z.string(),
  caption: localizedText.optional(),
  credit: z.string(),
  publishAt: z.string(),
  expireAt: z.string().nullable(),
  status: contentStatus,
  translation: translationStatus,
  pinned: z.boolean(),
  fixtureId: z.string().optional(),
  /** Video and audio are official deep links only: nothing is hosted or streamed here. */
  link: z.object({ url: z.string(), label: localizedText }).optional(),
  durationLabel: z.string().optional(),
  captions: z.boolean().optional(),
  demo: z.boolean(),
});
export type ContentItem = z.infer<typeof contentItem>;

/** Visible to supporters right now: published, past its publish time, not expired. */
export function isLiveContent(item: ContentItem, now: Date): boolean {
  if (item.status !== 'published') return false;
  if (new Date(item.publishAt).getTime() > now.getTime()) return false;
  if (item.expireAt && new Date(item.expireAt).getTime() <= now.getTime()) return false;
  return true;
}

/** Pinned first, then newest. */
export function sortContent(items: readonly ContentItem[]): ContentItem[] {
  return [...items].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.publishAt.localeCompare(a.publishAt),
  );
}

/** Sections of Our Club. Each is an editorial hub over one content category. */
export const clubSectionId = z.enum([
  'first-team',
  'women',
  'academy',
  'community',
  'history',
  'leadership',
]);
export type ClubSectionId = z.infer<typeof clubSectionId>;

export const clubSection = z.object({
  id: clubSectionId,
  title: localizedText,
  intro: localizedText,
  mediaId: z.string(),
  category: contentCategory,
  /** Short labelled facts. Each stays "awaiting approval" until the club signs it off. */
  panels: z.array(
    z.object({
      id: z.string(),
      title: localizedText,
      body: localizedText,
      mediaId: z.string().optional(),
      approval: z.enum(['club_approved', 'awaiting_approval']),
    }),
  ),
});
export type ClubSection = z.infer<typeof clubSection>;

export const faq = z.object({
  id: z.string(),
  topic: z.enum(['tickets', 'account', 'matchday', 'accessibility', 'privacy', 'app']),
  question: localizedText,
  answer: localizedText,
});
export type Faq = z.infer<typeof faq>;
