/**
 * Content access. Pages call these async getters and never import seed data
 * directly, so swapping the seed source for a headless CMS is a change to
 * `source` alone. Getters are async for exactly that reason.
 */
import {
  Album,
  Pillar,
  PressKit,
  SiteSettings,
  Story,
  Video,
  type Approval,
  type JournalCategory,
  type PillarKey,
} from './schema';
import { albums as albumSeed, videos as videoSeed } from './seed/catalogue';
import { pillars as pillarSeed, pressKit as pressSeed, siteSettings as settingsSeed } from './seed/institution';
import { stories as storySeed } from './seed/journal';

export type { Album, Pillar, PressKit, SiteSettings, Story, Video, JournalCategory, PillarKey, Approval };

export interface ContentSource {
  albums(): Promise<Album[]>;
  videos(): Promise<Video[]>;
  stories(): Promise<Story[]>;
  pillars(): Promise<Pillar[]>;
  pressKit(): Promise<PressKit>;
  settings(): Promise<SiteSettings>;
}

/** Seed content, validated once at load so a bad edit fails loudly. */
export const seedSource: ContentSource = (() => {
  const parsed = {
    albums: Album.array().parse(albumSeed),
    videos: Video.array().parse(videoSeed),
    stories: Story.array().parse(storySeed),
    pillars: Pillar.array().parse(pillarSeed),
    pressKit: PressKit.parse(pressSeed),
    settings: SiteSettings.parse(settingsSeed),
  };
  return {
    albums: async () => parsed.albums,
    videos: async () => parsed.videos,
    stories: async () => parsed.stories,
    pillars: async () => parsed.pillars,
    pressKit: async () => parsed.pressKit,
    settings: async () => parsed.settings,
  };
})();

const source: ContentSource = seedSource;

/** Production launch mode: only management-approved entries render. */
export function approvedOnly(): boolean {
  return process.env.CONTENT_PUBLISH_APPROVED_ONLY === 'true';
}

/** Whether to mark pending and placeholder content on the page. */
export function showContentFlags(): boolean {
  return !approvedOnly() && process.env.CONTENT_SHOW_FLAGS !== 'false';
}

function visible<T extends { approval: Approval }>(items: T[]): T[] {
  return approvedOnly() ? items.filter((i) => i.approval === 'approved') : items;
}

export async function getAlbums(): Promise<Album[]> {
  return visible(await source.albums());
}

export async function getAlbum(slug: string): Promise<Album | undefined> {
  return (await getAlbums()).find((a) => a.slug === slug);
}

export async function getVideos(): Promise<Video[]> {
  return visible(await source.videos());
}

export async function getVideo(slug: string): Promise<Video | undefined> {
  return (await getVideos()).find((v) => v.slug === slug);
}

export async function getStories(category?: JournalCategory): Promise<Story[]> {
  const all = visible(await source.stories());
  return category ? all.filter((s) => s.category === category) : all;
}

export async function getStory(slug: string): Promise<Story | undefined> {
  return (await getStories()).find((s) => s.slug === slug);
}

export async function getPillars(): Promise<Pillar[]> {
  return visible(await source.pillars());
}

export async function getPressKit(): Promise<PressKit | null> {
  const kit = await source.pressKit();
  return approvedOnly() && kit.approval !== 'approved' ? null : kit;
}

export async function getSettings(): Promise<SiteSettings> {
  const settings = await source.settings();
  if (approvedOnly() && settings.streamingApproval !== 'approved') {
    return { ...settings, streaming: {} };
  }
  return settings;
}

/** Resolve featured slugs in order, skipping any that are hidden or missing. */
export function pick<T extends { slug: string }>(items: T[], slugs: string[]): T[] {
  return slugs.map((s) => items.find((i) => i.slug === s)).filter((i): i is T => Boolean(i));
}

export const JOURNAL_CATEGORIES: { key: JournalCategory; label: string }[] = [
  { key: 'music', label: 'Music' },
  { key: 'culture', label: 'Culture' },
  { key: 'live', label: 'Live' },
  { key: 'people', label: 'People' },
  { key: 'studio', label: 'Studio' },
  { key: 'legacy', label: 'Legacy' },
];

export const VIDEO_KIND_LABEL: Record<Video['kind'], string> = {
  official: 'Official video',
  live: 'Live film',
  'behind-the-scenes': 'Behind the scenes',
  film: 'Film',
};
