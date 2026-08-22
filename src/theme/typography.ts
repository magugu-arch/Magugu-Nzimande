import { Platform, type TextStyle } from 'react-native';

/**
 * bb.q Chicken typography (brief §6).
 *
 * Headings   — Helvetica Neue Bold / platform equivalent
 * Supporting — Helvetica Neue Regular / platform equivalent
 *
 * Helvetica Neue ships with iOS. On Android the closest metric-compatible
 * system face is Roboto, so we map to it rather than bundling a licensed
 * webfont. Swap `fontFamily` here if a licensed brand face is provisioned.
 */

const family = Platform.select({
  ios: {
    regular: 'HelveticaNeue',
    medium: 'HelveticaNeue-Medium',
    bold: 'HelveticaNeue-Bold',
  },
  default: {
    regular: 'sans-serif',
    medium: 'sans-serif-medium',
    bold: 'sans-serif',
  },
}) as { regular: string; medium: string; bold: string };

export const fontFamily = family;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/** Named text roles. Every `<Text>` in the app resolves to one of these. */
export const typography = {
  display: {
    fontFamily: family.bold,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.6,
  },
  h1: {
    fontFamily: family.bold,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  h2: {
    fontFamily: family.bold,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: family.bold,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontFamily: family.regular,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeight.regular,
  },
  body: {
    fontFamily: family.regular,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.regular,
  },
  bodyMedium: {
    fontFamily: family.medium,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
  },
  caption: {
    fontFamily: family.regular,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeight.regular,
  },
  captionMedium: {
    fontFamily: family.medium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeight.semibold,
  },
  micro: {
    fontFamily: family.medium,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },
  /** All-caps eyebrow used above section headings and on badges. */
  overline: {
    fontFamily: family.bold,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  price: {
    fontFamily: family.bold,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
