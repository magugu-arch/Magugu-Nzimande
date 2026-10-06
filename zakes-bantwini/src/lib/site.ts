import type { MediaId } from '@/content/media';

export const SITE_NAME = 'Zakes Bantwini';
export const SITE_TAGLINE = 'The Architect';
export const SITE_LINE = 'Music was the beginning. The vision builds the legacy.';
export const SITE_DESCRIPTION =
  'The official home of Zakes Bantwini — artist, producer, founder and cultural architect. Music, film, live dates, bookings and the story of what the music builds.';

/** Canonical origin. Set NEXT_PUBLIC_SITE_URL in every deployed environment. */
export function siteUrl(path = '/'): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export type NavItem = { href: string; label: string; media?: MediaId; note?: string };

/** Desktop bar: brief §10 GLOBAL NAVIGATION. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/music', label: 'Music' },
  { href: '/videos', label: 'Videos' },
  { href: '/live', label: 'Live' },
  { href: '/book', label: 'Book Zakes' },
  { href: '/story', label: 'Story' },
  { href: '/architect', label: 'Legacy' },
];

/** Full menu, with the image each link previews on desktop. */
export const MENU_NAV: NavItem[] = [
  { href: '/music', label: 'Music', media: 'IMG_6848', note: 'Catalogue and listening' },
  { href: '/videos', label: 'Videos', media: 'IMG_6880', note: 'Official, live and on set' },
  { href: '/live', label: 'Live', media: 'IMG_6865', note: 'Public dates' },
  { href: '/book', label: 'Book Zakes', media: 'IMG_6862', note: 'Private, corporate and festival' },
  { href: '/story', label: 'The Story', media: 'IMG_6855', note: 'Artist, producer, founder' },
  { href: '/architect', label: 'The Architect', media: 'IMG_6863', note: 'The institution' },
  { href: '/handover', label: 'The Handover', media: 'IMG_6886', note: 'The next chapter' },
  { href: '/journal', label: 'Journal', media: 'IMG_6874', note: 'Music, culture, legacy' },
  { href: '/press', label: 'Press / EPK', media: 'IMG_6882', note: 'Bios, photos, rider' },
  { href: '/collaborate', label: 'Collaborate', media: 'IMG_6876', note: 'Brands and projects' },
  { href: '/community', label: 'Community', media: 'IMG_6860', note: 'Join the movement' },
];
