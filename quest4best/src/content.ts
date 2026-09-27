// PLACEHOLDER — confirm the real address with the client before launch.
export const CONTACT_EMAIL = 'hello@quest4best.co.za';

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

// Resolves a file in public/assets against the deploy base, so the site works
// at a domain root and under a sub-path (GitHub Pages) alike.
export const asset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;
