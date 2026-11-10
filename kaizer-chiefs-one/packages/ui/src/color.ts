/**
 * Colour tokens.
 *
 * PROPOSED VALUES. These come from the One App brief (10 Nov 2026), not from
 * the club's CI manual. When the official palette arrives, change `brand`
 * below and nothing else: every surface, text and state colour is derived
 * from these five values or from neutral steps between them.
 */
export const brand = {
  /** Amakhosi Gold: primary accent, key actions, selected highlights. */
  gold: '#E0B43C',
  /** Deep Black: primary dark surfaces, navigation, hero backgrounds. */
  black: '#101010',
  /** Charcoal: secondary dark panels, cards and dividers. */
  charcoal: '#242424',
  /** Warm Ivory: readable light surfaces and text. */
  ivory: '#F5F0E4',
  /** Muted Gold: secondary accent, subdued borders and supporting details. */
  mutedGold: '#A9822B',
} as const;

/** Mix a hex colour with another by `amount` (0 = a, 1 = b). */
export function mix(a: string, b: string, amount: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const out = pa.map((v, i) => Math.round(v + ((pb[i] ?? 0) - v) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** `#RRGGBB` plus alpha (0..1) as an `rgba()` string. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) throw new Error(`Expected #RRGGBB, got ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Semantic colours. Screens use these names, never raw hex values.
 *
 * Dark is the primary theme (the brief's black-and-gold direction); `light`
 * uses ivory for long-form reading surfaces such as articles and legal text.
 */
export const color = {
  bg: brand.black,
  bgRaised: mix(brand.black, brand.charcoal, 0.45),
  surface: brand.charcoal,
  surfaceHigh: mix(brand.charcoal, brand.ivory, 0.08),
  surfaceInverse: brand.ivory,

  text: brand.ivory,
  textSecondary: mix(brand.ivory, brand.black, 0.25),
  textTertiary: mix(brand.ivory, brand.black, 0.36),
  textInverse: brand.black,
  textInverseSecondary: mix(brand.black, brand.ivory, 0.35),

  accent: brand.gold,
  accentPressed: mix(brand.gold, brand.black, 0.15),
  accentMuted: brand.mutedGold,
  onAccent: brand.black,

  line: alpha(brand.ivory, 0.12),
  lineStrong: alpha(brand.ivory, 0.24),
  lineAccent: alpha(brand.gold, 0.5),

  scrim: alpha('#000000', 0.6),
  chrome: alpha(brand.black, 0.78),

  /** Live match state. Used only when an authorised feed says a match is live. */
  live: '#F05252',
  success: '#4CC38A',
  warning: brand.gold,
  danger: '#F05252',
  info: '#8AB4F8',

  /**
   * DEMO/SAMPLE labels. Deliberately ivory-on-black rather than gold, so a
   * demo marker never reads as a brand feature or a call to action.
   */
  demoBg: brand.ivory,
  demoText: brand.black,
} as const;

export type ColorToken = keyof typeof color;
