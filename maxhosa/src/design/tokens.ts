/**
 * Design tokens — PROVISIONAL, for concept approval.
 *
 * Warm ivory paper, ink, one restrained ochre, and the jewel colours that
 * already live in the knit. Nothing here is MAXHOSA AFRICA's approved CI;
 * when the brand guidelines arrive, they replace these values and nothing
 * else in the app has to change, because no screen uses a hex value directly.
 *
 * Every text/background pair used in the UI meets WCAG 2.2 AA (4.5:1) in
 * both schemes; `__tests__/tokens.test.ts` measures them.
 */

export type Palette = {
  paper: string;
  card: string;
  sunk: string;
  scrim: string;
  ink: string;
  ink2: string;
  ink3: string;
  onInk: string;
  ochre: string;
  ochreSoft: string;
  green: string;
  greenSoft: string;
  rust: string;
  rustSoft: string;
  cobalt: string;
  cobaltSoft: string;
  hairline: string;
  hairlineStrong: string;
  /** Tint laid over a blur for floating chrome (tab bar, nav bar, action bar). */
  material: string;
  focus: string;
};

export const light: Palette = {
  paper: '#F6F1E8',
  card: '#FFFCF7',
  sunk: '#ECE4D7',
  scrim: 'rgba(22,19,15,0.38)',
  ink: '#16130F',
  ink2: '#4B443B',
  ink3: '#6B6257',
  onInk: '#FFFCF7',
  ochre: '#85590F',
  ochreSoft: '#EFE0C2',
  green: '#1E5A3F',
  greenSoft: '#DCEBE1',
  rust: '#A3401F',
  rustSoft: '#F6DFD5',
  cobalt: '#1D4F9C',
  cobaltSoft: '#DDE6F5',
  hairline: 'rgba(22,19,15,0.12)',
  hairlineStrong: 'rgba(22,19,15,0.22)',
  material: 'rgba(246,241,232,0.72)',
  focus: '#1D4F9C',
};

export const dark: Palette = {
  paper: '#100E0B',
  card: '#1B1814',
  sunk: '#26221C',
  scrim: 'rgba(0,0,0,0.55)',
  ink: '#F4EDE2',
  ink2: '#CDC3B4',
  ink3: '#A2978A',
  onInk: '#16130F',
  ochre: '#D9A853',
  ochreSoft: '#3A2C14',
  green: '#7CC19E',
  greenSoft: '#183326',
  rust: '#EE8B69',
  rustSoft: '#3C1D13',
  cobalt: '#94B6F0',
  cobaltSoft: '#172540',
  hairline: 'rgba(244,237,226,0.12)',
  hairlineStrong: 'rgba(244,237,226,0.24)',
  material: 'rgba(16,14,11,0.7)',
  focus: '#94B6F0',
};

/** A 4-point grid. Gutter is the page margin on phones. */
export const space = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  gutter: 18,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = { s: 10, m: 16, l: 24, pill: 999 } as const;

/** Apple's minimum comfortable target. */
export const MIN_TOUCH = 44;

/**
 * Type, sized and tracked per role rather than with one letter-spacing for
 * everything: display sizes tighten, small caps open up, body stays near 0.
 * Display uses Playfair Display (OFL) as a stand-in for the brand's editorial
 * face; UI text uses the platform font (SF Pro / Roboto), which already ships
 * optical sizing and Dynamic Type behaviour.
 */
export const DISPLAY_FONT = 'PlayfairDisplay_500Medium';

export const type = {
  display: { fontFamily: DISPLAY_FONT, fontSize: 34, lineHeight: 37, letterSpacing: -0.6 },
  title: { fontFamily: DISPLAY_FONT, fontSize: 28, lineHeight: 32, letterSpacing: -0.4 },
  heading: { fontFamily: DISPLAY_FONT, fontSize: 22, lineHeight: 26, letterSpacing: -0.2 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 23, letterSpacing: 0 },
  callout: { fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  subhead: { fontSize: 14, lineHeight: 19, letterSpacing: 0 },
  footnote: { fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
} as const;

export type TypeRole = keyof typeof type;
