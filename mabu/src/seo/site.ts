/**
 * What the website tells search engines about itself.
 *
 * The public address is `EXPO_PUBLIC_SITE_URL` (set it for the real domain
 * before exporting); everything else is derived from it so canonical links,
 * sitemap entries and social cards always agree.
 */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://maburestaurant.com').replace(
  /\/$/,
  '',
);

/** Google Search Console's verification token, if the meta-tag method is used. */
export const GOOGLE_SITE_VERIFICATION = process.env.EXPO_PUBLIC_GOOGLE_SITE_VERIFICATION ?? '';

export const SITE_NAME = 'Mábu Restaurant';
export const SITE_TAGLINE = 'African Luxury. Refined by Fire.';
export const SITE_DESCRIPTION =
  'Mábu is a contemporary African luxury restaurant at Waterfall Wilds, Waterfall City, Midrand. Book a table, browse the menu and wine list, and join MÁBU Rewards.';
export const LOCALITY = 'Waterfall City, Midrand';

export const absolute = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** The social card. Generated into the export by scripts/seo.mjs. */
export const OG_IMAGE = absolute('/og.jpg');

/** Title as it appears in a search result: page, then the restaurant. */
export function pageTitle(title?: string): string {
  if (!title) return `${SITE_NAME} · Fine dining in ${LOCALITY}`;
  return `${title} · ${SITE_NAME}`;
}
