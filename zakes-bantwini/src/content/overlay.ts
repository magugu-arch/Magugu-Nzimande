/**
 * Merging stored entries over the seed. Pure, so the content audit script and
 * the tests use exactly what the site does.
 */
import type { z } from 'zod';
import type { ContentCollection, ContentEntry } from '@/lib/cms/types';
import { SINGLETON } from '@/lib/cms/types';
import { Album, Pillar, PressKit, SiteSettings, Story, Video } from './schema';
import type { SeedContent } from './seed';

export const COLLECTION_SCHEMA = {
  albums: Album,
  videos: Video,
  stories: Story,
  pillars: Pillar,
  pressKit: PressKit,
  settings: SiteSettings,
} satisfies Record<ContentCollection, z.ZodType>;

type ListCollection = 'albums' | 'videos' | 'stories' | 'pillars';
type Item<C extends ListCollection> = SeedContent[C][number];

export const keyOf = (collection: ListCollection, item: { slug?: string; key?: string }): string =>
  (collection === 'pillars' ? item.key : item.slug) ?? '';

export type Merged<T> = { item: T; origin: 'seed' | 'edited' | 'new'; archived: boolean; updatedAt: string | null; updatedBy: string | null };

/**
 * Every entry in a list collection, archived ones included (the admin needs
 * them). New entries come first, newest first — a new release or story leads
 * — then the seed in its designed order, edited or not.
 *
 * A stored entry that no longer validates (the schema moved on) is skipped
 * with a warning rather than taking the page down; the seed version shows.
 */
export function mergeList<C extends ListCollection>(collection: C, seedItems: Item<C>[], entries: ContentEntry[]): Merged<Item<C>>[] {
  const schema = COLLECTION_SCHEMA[collection];
  const stored = new Map<string, { entry: ContentEntry; item: Item<C> }>();
  for (const entry of entries) {
    if (entry.collection !== collection) continue;
    const parsed = schema.safeParse(entry.data);
    if (!parsed.success || keyOf(collection, parsed.data as Item<C>) !== entry.slug) {
      console.warn(`[content] ignoring invalid stored ${collection}/${entry.slug}`);
      continue;
    }
    stored.set(entry.slug, { entry, item: parsed.data as Item<C> });
  }
  const meta = (entry: ContentEntry) => ({ archived: entry.archived, updatedAt: entry.updatedAt, updatedBy: entry.updatedBy });
  const seeded = seedItems.map((item): Merged<Item<C>> => {
    const s = stored.get(keyOf(collection, item));
    return s ? { item: s.item, origin: 'edited', ...meta(s.entry) } : { item, origin: 'seed', archived: false, updatedAt: null, updatedBy: null };
  });
  const seedKeys = new Set(seedItems.map((i) => keyOf(collection, i)));
  const added = [...stored.values()]
    .filter((s) => !seedKeys.has(s.entry.slug))
    .sort((a, b) => (a.entry.createdAt < b.entry.createdAt ? 1 : -1))
    .map((s): Merged<Item<C>> => ({ item: s.item, origin: 'new', ...meta(s.entry) }));
  return [...added, ...seeded];
}

/** A singleton (press kit, settings): the stored version if valid, else the seed. */
export function mergeSingleton<C extends 'pressKit' | 'settings'>(collection: C, seedValue: SeedContent[C], entries: ContentEntry[]): Merged<SeedContent[C]> {
  const entry = entries.find((e) => e.collection === collection && e.slug === SINGLETON);
  if (entry) {
    const parsed = COLLECTION_SCHEMA[collection].safeParse(entry.data);
    if (parsed.success) return { item: parsed.data as SeedContent[C], origin: 'edited', archived: false, updatedAt: entry.updatedAt, updatedBy: entry.updatedBy };
    console.warn(`[content] ignoring invalid stored ${collection}`);
  }
  return { item: seedValue, origin: 'seed', archived: false, updatedAt: null, updatedBy: null };
}

/** The content the public site renders: seed plus stored edits, archived entries removed. */
export function effectiveContent(seed: SeedContent, entries: ContentEntry[]): SeedContent {
  const live = <T>(list: Merged<T>[]) => list.filter((m) => !m.archived).map((m) => m.item);
  return {
    albums: live(mergeList('albums', seed.albums, entries)),
    videos: live(mergeList('videos', seed.videos, entries)),
    stories: live(mergeList('stories', seed.stories, entries)),
    pillars: live(mergeList('pillars', seed.pillars, entries)),
    pressKit: mergeSingleton('pressKit', seed.pressKit, entries).item,
    settings: mergeSingleton('settings', seed.settings, entries).item,
  };
}
