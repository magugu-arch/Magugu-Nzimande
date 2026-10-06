import type { Metadata } from 'next';
import type { Album, Story, Video } from '@/content';
import { mediaOgUrl, mediaUrl, type MediaId } from '@/content/media';
import type { EventRecord } from '@/lib/booking/types';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from './site';

/** Per-page metadata with canonical URL, Open Graph and X cards sharing one image. */
export function pageMetadata({
  title,
  description,
  path,
  image = 'IMG_6853',
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: MediaId;
  noindex?: boolean;
}): Metadata {
  const og = mediaOgUrl(image);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} — ${SITE_NAME}`, description, url: path, images: [{ url: og, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: `${title} — ${SITE_NAME}`, description, images: [og] },
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}

const artist = () => ({ '@type': 'Person', name: SITE_NAME, url: siteUrl('/') });

export function personJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': siteUrl('/#artist'),
    name: SITE_NAME,
    url: siteUrl('/'),
    image: siteUrl(mediaUrl('IMG_6884', 828, 'webp')),
    description: SITE_DESCRIPTION,
    jobTitle: 'Artist, producer, founder',
    nationality: { '@type': 'Country', name: 'South Africa' },
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': siteUrl('/#organization'),
    name: SITE_NAME,
    url: siteUrl('/'),
    founder: { '@id': siteUrl('/#artist') },
  };
}

export function albumJsonLd(album: Album) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: album.title,
    url: siteUrl(`/music/${album.slug}`),
    byArtist: artist(),
    ...(album.year ? { datePublished: String(album.year) } : {}),
    ...(album.artwork ? { image: album.artwork.src } : {}),
    numTracks: album.tracks.length || undefined,
    track: album.tracks.map((t, i) => ({
      '@type': 'MusicRecording',
      name: t.title,
      position: i + 1,
      byArtist: artist(),
      ...(t.isrc ? { isrcCode: t.isrc } : {}),
      ...(t.durationSeconds ? { duration: `PT${Math.floor(t.durationSeconds / 60)}M${t.durationSeconds % 60}S` } : {}),
    })),
  };
}

/** VideoObject needs a real upload date and source; placeholder videos get none. */
export function videoJsonLd(video: Video) {
  if (!video.source || !video.publishedAt) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description,
    uploadDate: video.publishedAt,
    thumbnailUrl: siteUrl(mediaOgUrl(video.poster)),
    url: siteUrl(`/videos/${video.slug}`),
    ...(video.source.type === 'youtube' ? { embedUrl: `https://www.youtube-nocookie.com/embed/${video.source.id}` } : { contentUrl: siteUrl(video.source.src) }),
    ...(video.durationSeconds ? { duration: `PT${Math.floor(video.durationSeconds / 60)}M${video.durationSeconds % 60}S` } : {}),
  };
}

export function eventJsonLd(e: EventRecord) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: e.title,
    startDate: e.startTime ? `${e.date}T${e.startTime}:00+02:00` : e.date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: e.venue, address: { '@type': 'PostalAddress', addressLocality: e.city, addressCountry: e.country } },
    performer: artist(),
    url: siteUrl(`/live/${e.id}`),
    ...(e.description ? { description: e.description } : {}),
    ...(e.ticketUrl ? { offers: { '@type': 'Offer', url: e.ticketUrl, availability: 'https://schema.org/InStock' } } : {}),
  };
}

export function articleJsonLd(story: Story) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: story.title,
    description: story.standfirst,
    image: siteUrl(mediaOgUrl(story.hero)),
    url: siteUrl(`/journal/${story.slug}`),
    publisher: { '@id': siteUrl('/#organization') },
    ...(story.publishedAt ? { datePublished: story.publishedAt } : {}),
  };
}
