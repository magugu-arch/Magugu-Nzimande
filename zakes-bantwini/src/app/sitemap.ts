import type { MetadataRoute } from 'next';
import { getAlbums, getStories, getVideos } from '@/content';
import { siteUrl } from '@/lib/site';

const STATIC = ['/', '/music', '/videos', '/live', '/book', '/book/request', '/story', '/architect', '/handover', '/journal', '/press', '/collaborate', '/community', '/privacy'];

/** Public pages only — client portals, quotes and admin are deliberately absent. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [albums, videos, stories] = await Promise.all([getAlbums(), getVideos(), getStories()]);
  return [
    ...STATIC.map((path) => ({ url: siteUrl(path), changeFrequency: 'weekly' as const, priority: path === '/' ? 1 : path === '/book' ? 0.9 : 0.7 })),
    ...albums.map((a) => ({ url: siteUrl(`/music/${a.slug}`), changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...videos.map((v) => ({ url: siteUrl(`/videos/${v.slug}`), changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...stories.map((s) => ({ url: siteUrl(`/journal/${s.slug}`), changeFrequency: 'monthly' as const, priority: 0.5, ...(s.publishedAt ? { lastModified: s.publishedAt } : {}) })),
  ];
}
