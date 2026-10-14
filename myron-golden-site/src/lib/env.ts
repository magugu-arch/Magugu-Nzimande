/**
 * Site-wide switches, read from public env vars so the same values reach the
 * server and the browser.
 *
 * SITE_MODE is the guard rail the brief asks for: in `preview` (the default)
 * the site carries a preview ribbon, demo fixtures and draft records are
 * visible, forms log instead of delivering, and every page is noindex. A
 * deployment only becomes `production` when someone sets it on purpose, and
 * in production demo records are filtered out at the data layer, not hidden
 * with CSS.
 */
export type SiteMode = 'preview' | 'production';

export const SITE_MODE: SiteMode =
  process.env.NEXT_PUBLIC_SITE_MODE === 'production' ? 'production' : 'preview';

export const IS_PREVIEW = SITE_MODE === 'preview';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

/** The real course/community platform. No URL means the login page says so. */
export const MEMBER_PORTAL_URL = process.env.NEXT_PUBLIC_MEMBER_PORTAL_URL || null;

/** GA4 measurement ID. Analytics stays off until it is set and consent is given. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || null;

export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
