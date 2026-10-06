import 'server-only';
import { keyOf, mergeList, mergeSingleton } from '@/content/overlay';
import { seed } from '@/content/seed';
import { allMedia } from '@/content/media';
import { getStore } from '@/lib/store';
import type { EditorOptions } from '@/components/admin/ContentEditor';
import { assetPath } from './assets';
import type { ContentCollection, PublicAsset } from './types';

export const COLLECTION_LABEL: Record<ContentCollection, { one: string; many: string; publicPath: (slug: string) => string }> = {
  albums: { one: 'Release', many: 'Releases', publicPath: (s) => `/music/${s}` },
  videos: { one: 'Video', many: 'Videos', publicPath: (s) => `/videos/${s}` },
  stories: { one: 'Story', many: 'Journal', publicPath: (s) => `/journal/${s}` },
  pillars: { one: 'Pillar', many: 'Pillars', publicPath: () => '/architect' },
  pressKit: { one: 'Press kit', many: 'Press kit', publicPath: () => '/press' },
  settings: { one: 'Site settings', many: 'Site settings', publicPath: () => '/' },
};

/** Everything management can edit, archived entries included, with where each version came from. */
export async function adminContent() {
  const entries = await getStore().list('content_entries');
  return {
    albums: mergeList('albums', seed.albums, entries),
    videos: mergeList('videos', seed.videos, entries),
    stories: mergeList('stories', seed.stories, entries),
    pillars: mergeList('pillars', seed.pillars, entries),
    pressKit: mergeSingleton('pressKit', seed.pressKit, entries),
    settings: mergeSingleton('settings', seed.settings, entries),
  };
}

export type AdminContent = Awaited<ReturnType<typeof adminContent>>;

export function editorOptions(content: AdminContent, assets: PublicAsset[]): EditorOptions {
  const asOptions = (kind: PublicAsset['kind']) =>
    assets.filter((a) => a.kind === kind).map((a) => ({ key: assetPath(a), label: `${a.label} (${a.filename}${a.width ? `, ${a.width}×${a.height}` : ''})` }));
  return {
    media: allMedia().map((m) => ({ key: m.id, label: `${String(m.index).padStart(2, '0')} · ${m.title}` })),
    albums: content.albums.map((m) => ({ key: keyOf('albums', m.item), label: m.item.title + (m.archived ? ' (hidden)' : '') })),
    videos: content.videos.map((m) => ({ key: keyOf('videos', m.item), label: m.item.title + (m.archived ? ' (hidden)' : '') })),
    stories: content.stories.map((m) => ({ key: keyOf('stories', m.item), label: m.item.title + (m.archived ? ' (hidden)' : '') })),
    images: asOptions('image'),
    audio: asOptions('audio'),
    documents: asOptions('document'),
    captions: asOptions('captions'),
  };
}
