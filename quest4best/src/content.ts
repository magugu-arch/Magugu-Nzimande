// PLACEHOLDER — confirm the real address with the client before launch.
export const CONTACT_EMAIL = 'hello@quest4best.co.za';

// Optional form service (e.g. Formspree, Web3Forms, Basin) that accepts a JSON
// POST. Unset, the request form opens the visitor's mail app pre-filled instead.
// Only an https:// endpoint is accepted, so form data is never sent in the clear.
const endpoint = String(import.meta.env.VITE_FORM_ENDPOINT ?? '');
export const FORM_ENDPOINT: string | undefined = /^https:\/\//.test(endpoint)
  ? endpoint
  : undefined;

export const BRAND_LINE = 'Better questions. Better decisions. Better outcomes.';

export const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Perspective', href: '#perspective' },
  { label: 'Expertise', href: '#expertise' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
] as const;

// Every photo goes through Vite, so the normal build fingerprints it for
// long-term caching and the single-file build can embed it in the page.
const ASSETS = import.meta.glob<string>(
  ['./assets/*.{jpg,png,webp}', '!./assets/mlungisi-portrait.*'],
  { eager: true, query: '?url', import: 'default' },
);

export const asset = (file: string): string => {
  const url = ASSETS[`./assets/${file}`];
  if (!url) throw new Error(`Missing asset: ${file}`);
  return url;
};
