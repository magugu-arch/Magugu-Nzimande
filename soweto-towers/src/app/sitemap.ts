import type { MetadataRoute } from 'next';
import { activities } from '@/content/catalog';
import { image } from '@/content/images';
import { articles } from '@/content/journal';
import { absoluteUrl } from '@/content/site';
import { allEventSlugs, upcomingEvents } from '@/lib/data/events';

type Entry = MetadataRoute.Sitemap[number];

const page = (path: string, priority: number, changeFrequency: Entry['changeFrequency'], images: string[] = []): Entry => ({
  url: absoluteUrl(path),
  changeFrequency,
  priority,
  ...(images.length ? { images: images.map((src) => absoluteUrl(src)) } : {}),
});

/**
 * sitemap.xml with image entries, so Google Images can index the tower photos
 * against the right pages. Tickets, vouchers, checkout and the staff console
 * are private and left out (they are also noindex).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, upcoming] = await Promise.all([allEventSlugs(), upcomingEvents(50)]);
  const live = new Set(upcoming.map((e) => e.slug));

  return [
    page('/', 1, 'daily', [image('towers-mural-hero').src, image('bungee-between-towers').src, image('towers-sunset-panorama').src]),
    page('/book', 0.9, 'daily', [image('bungee-pov-edge').src]),
    page('/adventures', 0.9, 'weekly', [image('towers-sunset-panorama').src]),
    ...activities.map((a) => page(`/adventures/${a.id}`, a.id === 'bungee-jump' ? 0.9 : 0.8, 'weekly', [image(a.image).src])),
    page('/gift', 0.8, 'monthly', [image('gift-a-jump').src]),
    page('/events', 0.8, 'daily', [image('towers-twilight-reflection').src]),
    ...slugs.map((s) => page(`/events/${s}`, live.has(s) ? 0.7 : 0.3, live.has(s) ? 'weekly' : 'yearly')),
    page('/groups', 0.8, 'monthly', [image('team-day').src, image('celebration-crowd').src]),
    page('/restaurant', 0.7, 'monthly', [image('shisanyama-platter').src]),
    page('/visit', 0.8, 'weekly', [image('soweto-street-tour').src]),
    page('/safety', 0.7, 'monthly', [image('harness-check').src]),
    page('/faq', 0.7, 'monthly'),
    page('/about', 0.6, 'monthly', [image('soweto-dusk-panorama').src]),
    page('/partners', 0.6, 'monthly'),
    page('/contact', 0.6, 'monthly'),
    page('/find-my-jump', 0.5, 'monthly', [image('scream-clip-phone').src]),
    page('/journal', 0.6, 'weekly'),
    ...articles.map((a) => ({ ...page(`/journal/${a.slug}`, 0.6, 'monthly', [image(a.image).src]), lastModified: a.published })),
    page('/legal/terms', 0.2, 'yearly'),
    page('/legal/privacy', 0.2, 'yearly'),
    page('/legal/indemnity', 0.3, 'yearly'),
  ];
}
