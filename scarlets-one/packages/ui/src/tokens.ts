/**
 * Scarlets One design tokens.
 *
 * WORKING PALETTE ONLY. These six hex values come from the product brief and
 * are proposed concept tokens, not the club's brand specification. The
 * official brand guide, colour specifications, type licences and crest rules
 * override every value in this file.
 */
export const palette = {
  scarlet: '#C8102E',
  wine: '#3B101B',
  nearBlack: '#191619',
  ivory: '#F6F2EC',
  gold: '#B9975B',
  grey: '#5E5A5C',
  white: '#FFFFFF',
} as const;

/**
 * Semantic colours. Components name a role, never a hex, so the same screen
 * reads correctly in both schemes and every pair below can be contrast-tested
 * (see contrast.test.ts).
 */
export interface Theme {
  scheme: 'light' | 'dark';
  /** Page background. */
  bg: string;
  /** Raised card on the page background. */
  surface: string;
  /** Recessed fill: wells, tracks, unselected chips. */
  surfaceMuted: string;
  /** Always-dark premium surface (match mode, Passport card) in both schemes. */
  inverse: string;
  inverseRaised: string;
  onInverse: string;
  onInverseMuted: string;
  text: string;
  textSecondary: string;
  /** Scarlet as a FILL. Pair with onAccent. */
  accent: string;
  accentPressed: string;
  onAccent: string;
  /** Scarlet as TEXT or icon on bg/surface. Lighter in dark so it stays AA. */
  accentText: string;
  /** Scarlet as text on the inverse surface. */
  accentOnInverse: string;
  /** Restrained gold: member accents. Text-safe on bg/surface. */
  goldText: string;
  /** Gold on the inverse surface. */
  goldOnInverse: string;
  hairline: string;
  hairlineOnInverse: string;
  success: string;
  warning: string;
  /** Translucent chrome over content (tab bar, sticky headers). */
  material: string;
  /** Same chrome when the reader asks for reduced transparency. */
  materialSolid: string;
  scrim: string;
  shadow: string;
}

export const lightTheme: Theme = {
  scheme: 'light',
  bg: palette.ivory,
  surface: palette.white,
  surfaceMuted: '#ECE6DC',
  inverse: palette.wine,
  inverseRaised: '#531826',
  onInverse: palette.ivory,
  onInverseMuted: '#D9C9CC',
  text: palette.nearBlack,
  textSecondary: palette.grey,
  accent: palette.scarlet,
  accentPressed: '#A30D25',
  onAccent: palette.white,
  accentText: palette.scarlet,
  accentOnInverse: '#FF8492',
  goldText: '#7A5E2C',
  goldOnInverse: palette.gold,
  hairline: 'rgba(25,22,25,0.10)',
  hairlineOnInverse: 'rgba(246,242,236,0.16)',
  success: '#1F7A4D',
  warning: '#8A5A00',
  material: 'rgba(246,242,236,0.72)',
  materialSolid: palette.ivory,
  scrim: 'rgba(25,22,25,0.48)',
  shadow: '#191619',
};

export const darkTheme: Theme = {
  scheme: 'dark',
  bg: '#141114',
  surface: '#231E22',
  surfaceMuted: '#2E282C',
  inverse: palette.wine,
  inverseRaised: '#531826',
  onInverse: palette.ivory,
  onInverseMuted: '#D9C9CC',
  text: palette.ivory,
  textSecondary: '#B8B1B3',
  // A shade lighter than the brief's scarlet: on a dark card the working value
  // falls just under 3:1, the minimum for a control to be told from its surface.
  accent: '#D81A3A',
  accentPressed: '#B5122E',
  onAccent: palette.white,
  accentText: '#FF7586',
  accentOnInverse: '#FF8492',
  goldText: '#CBAB72',
  goldOnInverse: palette.gold,
  hairline: 'rgba(246,242,236,0.12)',
  hairlineOnInverse: 'rgba(246,242,236,0.16)',
  success: '#5BCB93',
  warning: '#E5B053',
  material: 'rgba(20,17,20,0.70)',
  materialSolid: '#141114',
  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
};

export const themes = { light: lightTheme, dark: darkTheme } as const;

/** 4-point spacing scale. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 44,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/** Minimum touch target (WCAG 2.2 target size; Apple HIG 44 pt). */
export const hitTarget = 44;

/**
 * Type scale on the platform system face.
 *
 * Tracking is size-specific: display sizes tighten, small labels open up, body
 * stays at zero. Leading runs the other way: tight on headings, looser on
 * body. Values are points; `tracking` is letterSpacing in points.
 */
export interface TypeStyle {
  size: number;
  leading: number;
  tracking: number;
  weight: '400' | '500' | '600' | '700' | '800';
  uppercase?: boolean;
}

export const type = {
  score: { size: 48, leading: 50, tracking: -1.4, weight: '800' },
  display: { size: 34, leading: 37, tracking: -0.9, weight: '800' },
  title1: { size: 28, leading: 32, tracking: -0.6, weight: '700' },
  title2: { size: 22, leading: 27, tracking: -0.35, weight: '700' },
  title3: { size: 19, leading: 24, tracking: -0.2, weight: '600' },
  headline: { size: 17, leading: 22, tracking: -0.1, weight: '600' },
  body: { size: 16, leading: 24, tracking: 0, weight: '400' },
  callout: { size: 15, leading: 21, tracking: 0, weight: '400' },
  footnote: { size: 13, leading: 18, tracking: 0.05, weight: '500' },
  caption: { size: 12, leading: 16, tracking: 0.15, weight: '500' },
  eyebrow: { size: 11, leading: 14, tracking: 1.1, weight: '700', uppercase: true },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof type;
