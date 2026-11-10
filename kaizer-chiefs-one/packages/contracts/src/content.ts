import { z } from 'zod';
import { isoDateTime, provenanceSchema } from './provenance';

export const CONTENT_STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_KINDS = ['article', 'campaign', 'gallery', 'video_link'] as const;

export const contentItemSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(CONTENT_KINDS),
    eyebrow: z.string().max(40).nullable(),
    title: z.string().min(1).max(120),
    summary: z.string().max(280),
    /** Paragraphs. Rich text arrives from the CMS adapter as plain blocks. */
    body: z.array(z.string()),
    heroImageKey: z.string().nullable(),
    status: z.enum(CONTENT_STATUSES),
    publishAt: isoDateTime.nullable(),
    unpublishAt: isoDateTime.nullable(),
    provenance: provenanceSchema,
  })
  .refine(
    (c) => !c.publishAt || !c.unpublishAt || new Date(c.publishAt) < new Date(c.unpublishAt),
    { message: 'unpublishAt must be after publishAt', path: ['unpublishAt'] },
  );
export type ContentItem = z.infer<typeof contentItemSchema>;

/** Whether an item should be visible to supporters at `now`. */
export function isLiveContent(
  c: Pick<ContentItem, 'status' | 'publishAt' | 'unpublishAt'>,
  now: Date,
): boolean {
  if (c.status !== 'published' && c.status !== 'scheduled') return false;
  if (c.publishAt && new Date(c.publishAt) > now) return false;
  if (c.unpublishAt && new Date(c.unpublishAt) <= now) return false;
  return true;
}

export const HOME_MODULE_TYPES = [
  'hero',
  'next_fixture',
  'quick_links',
  'news_rail',
  'fan_moments',
  'promo',
] as const;
export type HomeModuleType = (typeof HOME_MODULE_TYPES)[number];

export const homeModuleSchema = z.object({
  id: z.string().min(1),
  type: z.enum(HOME_MODULE_TYPES),
  order: z.number().int(),
  title: z.string().nullable(),
  contentIds: z.array(z.string()),
  status: z.enum(CONTENT_STATUSES),
  publishAt: isoDateTime.nullable(),
  unpublishAt: isoDateTime.nullable(),
});
export type HomeModule = z.infer<typeof homeModuleSchema>;

export const homeFeedSchema = z.object({
  modules: z.array(homeModuleSchema),
  items: z.array(contentItemSchema),
  provenance: provenanceSchema,
});
export type HomeFeed = z.infer<typeof homeFeedSchema>;

/** Modules visible at `now`, in CMS order. */
export function visibleModules(modules: HomeModule[], now: Date): HomeModule[] {
  return modules.filter((m) => isLiveContent(m, now)).sort((a, b) => a.order - b.order);
}
