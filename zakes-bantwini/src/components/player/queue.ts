import type { Album, SiteSettings } from '@/content';
import type { QueueItem } from './PlayerProvider';

/**
 * A release as a player queue: one item per approved track, or — until the
 * tracklist and audio are supplied — a single item that points to where the
 * music can be heard.
 */
export function albumQueue(album: Album, settings: SiteSettings): QueueItem[] {
  const links = { ...settings.streaming, ...album.links };
  const href = `/music/${album.slug}`;
  if (album.tracks.length === 0) {
    return [{ id: album.slug, title: album.title, subtitle: 'Zakes Bantwini', href, links, mood: album.mood }];
  }
  return album.tracks.map((t, i) => ({
    id: `${album.slug}:${i}`,
    title: t.title,
    subtitle: album.title,
    href,
    audioUrl: t.audioUrl,
    links,
    mood: album.mood,
  }));
}
