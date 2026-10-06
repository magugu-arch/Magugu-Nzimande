/**
 * Content access. Pages call these async getters and never import seed data
 * directly. The source is the seed (src/content/seed) with management's edits
 * from the admin (the content_entries table) laid over it entry by entry.
 * Without a configured store — a build machine with no database — the seed
 * alone renders.
 */
import 'server-only';
import { cache } from 'react';
import type { Album, Pillar, PressKit, SiteSettings, Story, Video, Approval, JournalCategory, PillarKey } from './schema';
import { effectiveContent } from './overlay';
import { seed, type SeedContent } from './seed';
import type { ContentEntry } from '@/lib/cms/types';
import { getStore, StoreNotConfigured } from '@/lib/store';

export type { Album, Pillar, PressKit, SiteSettings, Story, Video, JournalCategory, PillarKey, Approval };

/** Stored entries, read once per request. */
export const loadContentEntries = cache(async (): Promise<ContentEntry[]> => {
  try {
    return await getStore().list('content_entries');
  } catch (error) {
    if (error instanceof StoreNotConfigured) return [];
    // A database outage should not take the public pages down with it; the
    // designed seed renders and the error is logged for whoever is on call.
    console.error('[content] could not read stored content; rendering the seed', error);
    return [];
  }
});

const content = cache(async (): Promise<SeedContent> => effectiveContent(seed, await loadContentEntries()));

const source = {
  albums: async () => (await content()).albums,
  videos: async () => (await content()).videos,
  stories: async () => (await content()).stories,
  pillars: async () => (await content()).pillars,
  pressKit: async () => (await content()).pressKit,
  settings: async () => (await content()).settings,
};

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
