/**
 * Typography tokens.
 *
 * Direction from the brief: a bold condensed athletic sans for display
 * (Barlow Condensed), a strong sans for headlines and UI (Inter), and
 * tabular numerals for scores, dates and stats. The editorial eyebrows take
 * a monospace (DM Mono), after the design inspiration's tracked mono labels.
 * All three families are SIL Open Font License; swap them here when the
 * club's CI names its typefaces.
 *
 * Tracking and leading are size-specific, never one value for all sizes:
 * large type is set tight, small type opens up slightly.
 */

/** Native (expo-font) family names, one per weight, as loaded by the app. */
export const fontFamily = {
  display: 'BarlowCondensed_700Bold',
  displayItalic: 'BarlowCondensed_700Bold_Italic',
  displaySemibold: 'BarlowCondensed_600SemiBold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

export type FontFamilyToken = keyof typeof fontFamily;

/** CSS stacks for the web admin, which loads the same families. */
export const fontStack = {
  display: "'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif",
  sans: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export interface TextStyleToken {
  family: FontFamilyToken;
  size: number;
  /** Line height as a multiple of size. */
  leading: number;
  /** Letter spacing in em. Converted to px per platform. */
  tracking: number;
  uppercase?: boolean;
  /** Use tabular figures (scores, dates, stats, balances). */
  tabular?: boolean;
}

export const textStyle = {
  /** Campaign hero lines. "Every Khosi / matters." */
  hero: { family: 'display', size: 60, leading: 0.92, tracking: -0.005, uppercase: true },
  heroItalic: { family: 'displayItalic', size: 60, leading: 0.92, tracking: -0.005 },
  display: { family: 'display', size: 40, leading: 0.95, tracking: 0, uppercase: true },
  displayItalic: { family: 'displayItalic', size: 40, leading: 0.95, tracking: 0 },
  /** Scores and big numbers. Always tabular. */
  score: { family: 'display', size: 48, leading: 1, tracking: 0.01, tabular: true },
  title1: { family: 'bold', size: 28, leading: 1.15, tracking: -0.02 },
  title2: { family: 'bold', size: 22, leading: 1.2, tracking: -0.015 },
  title3: { family: 'semibold', size: 19, leading: 1.25, tracking: -0.01 },
  headline: { family: 'semibold', size: 17, leading: 1.3, tracking: -0.008 },
  body: { family: 'regular', size: 16, leading: 1.55, tracking: 0 },
  bodyStrong: { family: 'semibold', size: 16, leading: 1.5, tracking: 0 },
  callout: { family: 'regular', size: 15, leading: 1.45, tracking: 0 },
  footnote: { family: 'regular', size: 13, leading: 1.4, tracking: 0.005 },
  caption: { family: 'medium', size: 12, leading: 1.35, tracking: 0.01 },
  /** Tracked mono eyebrow above headlines. "—— AMAKHOSI · ONE APP" */
  eyebrow: { family: 'monoMedium', size: 12, leading: 1.4, tracking: 0.16, uppercase: true },
  /** Small mono data label: provenance, timestamps, DEMO tags. */
  micro: { family: 'monoMedium', size: 10, leading: 1.3, tracking: 0.12, uppercase: true },
  /** Button and tab labels. Bold, tracked uppercase, like the reference CTA. */
  label: { family: 'bold', size: 14, leading: 1.2, tracking: 0.1, uppercase: true },
  labelSmall: { family: 'semibold', size: 11, leading: 1.2, tracking: 0.08, uppercase: true },
  /** Fixture dates, kick-off times, stat rows. */
  data: { family: 'displaySemibold', size: 18, leading: 1.1, tracking: 0.02, tabular: true },
} as const satisfies Record<string, TextStyleToken>;

export type TextStyleName = keyof typeof textStyle;

/** Letter spacing in px for a given style (React Native takes px, not em). */
export function trackingPx(style: TextStyleToken, size = style.size): number {
  return Math.round(style.tracking * size * 100) / 100;
}

/** Line height in px for a given style. */
export function leadingPx(style: TextStyleToken, size = style.size): number {
  return Math.round(style.leading * size);
}
