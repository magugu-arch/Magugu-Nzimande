// PLACEHOLDER — confirm the real address with the client before launch.
export const CONTACT_EMAIL = 'hello@quest4best.co.za';

// Optional form service (e.g. Formspree, Web3Forms, Basin) that accepts a JSON
// POST. Unset, the request form opens the visitor's mail app pre-filled instead.
export const FORM_ENDPOINT: string | undefined = import.meta.env.VITE_FORM_ENDPOINT || undefined;

export const BRAND_LINE = 'Better questions. Better decisions. Better outcomes.';

export const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Perspective', href: '#perspective' },
  { label: 'Expertise', href: '#expertise' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
] as const;

export const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_230229_7c9bc431-46cf-489a-948d-e8144d8eb5d4.mp4';

// Every photo goes through Vite, so the normal build fingerprints it for
// long-term caching and the single-file build can embed it in the page.
const ASSETS = import.meta.glob<string>(
  ['./assets/*.{jpg,png,webp}', '!./assets/mlungisi-portrait.*', '!./assets/hero-business.jpg'],
  { eager: true, query: '?url', import: 'default' },
);

export const asset = (file: string): string => {
  const url = ASSETS[`./assets/${file}`];
  if (!url) throw new Error(`Missing asset: ${file}`);
  return url;
};
