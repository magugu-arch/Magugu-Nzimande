/**
 * The content model, CMS-agnostic. Each collection is a Zod schema; the seed
 * files are validated against these in tests and by `npm run content:audit`,
 * and `npm run content:schema` exports them as JSON Schema for whichever CMS
 * management chooses.
 *
 * Every editorial entry carries `approval`:
 *   approved     — signed off by management; publishes everywhere
 *   pending      — written to the brief, awaiting sign-off
 *   placeholder  — a designed slot that must be replaced with supplied material
 *
 * With CONTENT_PUBLISH_APPROVED_ONLY=true only approved entries render, and
 * every list falls back to its designed empty state.
 */
import { z } from 'zod';
import { allMedia, type MediaId } from './media';

const mediaIds = allMedia().map((m) => m.id) as [MediaId, ...MediaId[]];
export const MediaRef = z.enum(mediaIds);

export const Approval = z.enum(['approved', 'pending', 'placeholder']);
export type Approval = z.infer<typeof Approval>;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words separated by hyphens');
const url = z.url();
const isoDate = z.iso.date();

export const StreamingLinks = z.object({
  spotify: url.optional(),
  appleMusic: url.optional(),
  youtube: url.optional(),
  deezer: url.optional(),
});
export type StreamingLinks = z.infer<typeof StreamingLinks>;

export const Track = z.object({
  title: z.string().min(1),
  durationSeconds: z.number().int().positive().optional(),
  /** Approved preview or full-length audio the site may stream. */
  audioUrl: url.optional(),
  isrc: z.string().optional(),
  featuring: z.array(z.string()).default([]),
});
export type Track = z.infer<typeof Track>;

export const Album = z.object({
  slug,
  title: z.string().min(1),
  kind: z.enum(['album', 'ep', 'single', 'compilation', 'live']),
  year: z.number().int().min(1990).max(2100).nullable(),
  /** Management-approved cover art. Until it exists the sleeve is set in type. */
  artwork: z.object({ src: z.string(), alt: z.string().min(1), width: z.number(), height: z.number() }).nullable(),
  /** Supplied image that sets the world around the record. */
  mood: MediaRef,
  description: z.string(),
  credits: z.array(z.object({ role: z.string(), name: z.string() })).default([]),
  tracks: z.array(Track).default([]),
  links: StreamingLinks.default({}),
  relatedVideos: z.array(slug).default([]),
  relatedStories: z.array(slug).default([]),
  approval: Approval,
  editorNote: z.string().optional(),
});
export type Album = z.infer<typeof Album>;

export const Caption = z.object({ src: z.string(), label: z.string(), lang: z.string().min(2) });

export const VideoSource = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file'),
    src: z.string(),
    mime: z.string().default('video/mp4'),
    captions: z.array(Caption).default([]),
  }),
  z.object({ type: z.literal('youtube'), id: z.string().regex(/^[\w-]{11}$/) }),
]);
export type VideoSource = z.infer<typeof VideoSource>;

export const Video = z.object({
  slug,
  title: z.string().min(1),
  kind: z.enum(['official', 'live', 'behind-the-scenes', 'film']),
  poster: MediaRef,
  source: VideoSource.nullable(),
  durationSeconds: z.number().int().positive().optional(),
  publishedAt: isoDate.nullable(),
  description: z.string(),
  relatedAlbum: slug.optional(),
  approval: Approval,
});
export type Video = z.infer<typeof Video>;

export const JournalCategory = z.enum(['music', 'culture', 'live', 'people', 'studio', 'legacy']);
export type JournalCategory = z.infer<typeof JournalCategory>;

export const StoryBlock = z.discriminatedUnion('type', [
  z.object({ type: z.literal('p'), text: z.string() }),
  z.object({ type: z.literal('h2'), text: z.string() }),
  z.object({ type: z.literal('statement'), text: z.string() }),
  z.object({ type: z.literal('image'), media: MediaRef, caption: z.string().optional() }),
]);
export type StoryBlock = z.infer<typeof StoryBlock>;

export const Story = z.object({
  slug,
  title: z.string().min(1),
  category: JournalCategory,
  standfirst: z.string(),
  hero: MediaRef,
  body: z.array(StoryBlock).min(1),
  publishedAt: isoDate.nullable(),
  approval: Approval,
});
export type Story = z.infer<typeof Story>;

export const PillarKey = z.enum(['festival', 'label', 'catalogue', 'academy', 'community']);
export type PillarKey = z.infer<typeof PillarKey>;

export const Pillar = z.object({
  key: PillarKey,
  title: z.string(),
  kicker: z.string(),
  summary: z.string(),
  body: z.array(z.string()).min(1),
  media: MediaRef,
  secondaryMedia: MediaRef.optional(),
  approval: Approval,
});
export type Pillar = z.infer<typeof Pillar>;

export const PressKit = z.object({
  shortBio: z.string(),
  longBio: z.array(z.string()).min(1),
  awards: z.array(z.object({ year: z.number().int(), title: z.string(), detail: z.string().optional() })),
  quotes: z.array(z.object({ quote: z.string(), source: z.string(), url: url.optional() })),
  performance: z.object({
    formats: z.array(z.object({ name: z.string(), detail: z.string() })),
    notes: z.string(),
  }),
  photos: z.array(MediaRef).min(1),
  /** Approved technical rider PDF. Until supplied, the press page offers it on request. */
  riderUrl: z.string().nullable(),
  approval: Approval,
});
export type PressKit = z.infer<typeof PressKit>;

export const SiteSettings = z.object({
  streaming: StreamingLinks,
  streamingApproval: Approval,
  social: z.array(z.object({ label: z.string(), url })),
  /** Public inboxes. Null until management confirms the addresses. */
  bookingEmail: z.email().nullable(),
  pressEmail: z.email().nullable(),
  featured: z.object({
    albums: z.array(slug),
    videos: z.array(slug),
    stories: z.array(slug),
  }),
});
export type SiteSettings = z.infer<typeof SiteSettings>;
