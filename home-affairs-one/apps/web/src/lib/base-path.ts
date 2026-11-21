/** Sub-path the site is served from, e.g. `/Magugu-Nzimande/home-affairs-one`. Empty at the root. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Prefixes a root-relative URL for raw `src`/`href` attributes that Next does not rewrite. */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}
