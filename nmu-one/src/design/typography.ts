import { type TextStyle } from 'react-native';

/**
 * Nunito Sans for all digital UI (brief §17, C.I. sheet "Typography").
 *
 *   Headings      Nunito Sans Bold / ExtraBold
 *   Sub-headings  Nunito Sans SemiBold
 *   Body          Nunito Sans Regular
 *
 * Each weight is its own loaded family, so no style sets `fontWeight` — on
 * Android a weight on a single-weight custom family makes the platform
 * synthesise or substitute a face. The family name *is* the weight.
 *
 * The editorial roles (`display`, `title1`) carry the C.I. sheet's large,
 * tight-tracked headlines ("THE NMU COMMUNITY") at phone scale.
 */
export const nunito = {
  regular: 'NunitoSans_400Regular',
  semibold: 'NunitoSans_600SemiBold',
  bold: 'NunitoSans_700Bold',
  extrabold: 'NunitoSans_800ExtraBold',
} as const;

export const typography = {
  /** Editorial statement — onboarding, world headers. */
  display: { fontFamily: nunito.extrabold, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  /** Screen titles. */
  title1: { fontFamily: nunito.extrabold, fontSize: 28, lineHeight: 33, letterSpacing: -0.5 },
  title2: { fontFamily: nunito.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  title3: { fontFamily: nunito.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  bodyLarge: { fontFamily: nunito.regular, fontSize: 17, lineHeight: 26 },
  body: { fontFamily: nunito.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: nunito.bold, fontSize: 15, lineHeight: 22 },
  /** List-row titles and sub-headings. */
  label: { fontFamily: nunito.semibold, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: nunito.regular, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: nunito.bold, fontSize: 13, lineHeight: 18 },
  /** Section eyebrows, in the C.I. sheet's letter-spaced capitals. */
  overline: {
    fontFamily: nunito.extrabold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  /** Balances, ETAs, countdowns: figures that must not jitter as they change. */
  metric: {
    fontFamily: nunito.extrabold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  metricSmall: {
    fontFamily: nunito.extrabold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  button: { fontFamily: nunito.bold, fontSize: 16, lineHeight: 20 },
  buttonSmall: { fontFamily: nunito.bold, fontSize: 14, lineHeight: 18 },
  tab: { fontFamily: nunito.bold, fontSize: 11, lineHeight: 13 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/**
 * How far each role follows the OS text-size setting (brief §20 "scalable
 * text"). Content is uncapped — it sits in boxes that grow. Chrome that lives
 * in fixed geometry (buttons, tabs, eyebrows) is capped at 2×, WCAG 1.4.4's
 * 200%, and wraps rather than truncating below that.
 */
export const CHROME_FONT_SCALE_CAP = 2;

const CHROME: ReadonlySet<TypographyVariant> = new Set([
  'button',
  'buttonSmall',
  'tab',
  'overline',
]);

export function fontScaleCapFor(variant: TypographyVariant): number | undefined {
  return CHROME.has(variant) ? CHROME_FONT_SCALE_CAP : undefined;
}
