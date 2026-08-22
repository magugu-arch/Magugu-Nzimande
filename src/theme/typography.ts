import { Platform, type TextStyle } from 'react-native';

/**
 * bb.q Chicken typography — guidelines §11, §12, §13, §14.
 *
 *   §11  Montserrat, primary. Headlines, subheadings, buttons and labels.
 *   §12  Arial, supporting. Body copy, captions, data, lists.
 *   §13  Playfair Display, editorial. Quotes and accents, sparingly.
 *
 * Montserrat and Playfair Display are bundled and loaded at startup (see
 * `app/_layout.tsx`). Arial is not bundled: §12 chooses it precisely because
 * it is already everywhere, and it ships on iOS. Android has no Arial and
 * silently substitutes Roboto, so that substitution is made explicit below
 * rather than left to the platform.
 *
 * On §14's point sizes: those are the print scale — a 90pt H1 is a poster, not
 * a phone. What carries over is the part that is scale-independent: which face
 * and weight each level takes, its casing, and the ratios between levels. The
 * pixel sizes here are the mobile equivalents.
 *
 * On casing: §14 sets H1–H3 in caps, and the campaign artwork bears that out —
 * "KOREA'S FINEST FRIED CHICKEN". The app mockups do not: screen titles read
 * "My Cart", "Popular Menu", "Chicken". Caps belong to marketing headlines and
 * section eyebrows, so `hero` and `overline` uppercase and nothing else does.
 * Setting a product name or a screen title in caps would contradict the
 * client's own app screens and cost legibility §32.4 asks us to protect.
 */

/** Montserrat weights, by the names §11.1 lists them under. */
export const montserrat = {
  light: 'Montserrat_300Light',
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
  black: 'Montserrat_900Black',
} as const;

/**
 * §13 asks for Playfair "sparingly and with intention", and the app has one
 * genuinely editorial moment. Only the italic §11.2 names for accents and
 * quotes is bundled; add the other weights when there is copy that needs them.
 */
export const playfair = {
  italic: 'PlayfairDisplay_400Regular_Italic',
} as const;

/** §12's Arial, or the platform's nearest equivalent where it does not exist. */
export const supporting = Platform.select({
  ios: { regular: 'Arial', bold: 'Arial-BoldMT', italic: 'Arial-ItalicMT' },
  default: { regular: 'sans-serif', bold: 'sans-serif', italic: 'sans-serif' },
}) as { regular: string; bold: string; italic: string };

export const fontFamily = { montserrat, playfair, supporting };

export const fontWeight = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/**
 * §14.3 — the gaps between hierarchy levels. Ranges in the guidelines; the
 * lower end of each is used, since a phone has less room than a poster.
 */
export const headingGap = {
  h1ToH2: 24,
  h2ToH3: 16,
  h3ToH4: 12,
  h4ToBody: 8,
} as const;

/** Named text roles. Every `<Text>` in the app resolves to one of these. */
export const typography = {
  /** §14 H1. Montserrat Black, all caps, tight tracking. Campaign headlines. */
  hero: {
    fontFamily: montserrat.black,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: fontWeight.black,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  /** Largest in-app heading: a product name, a points balance, a thank-you. */
  display: {
    fontFamily: montserrat.extrabold,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: fontWeight.extrabold,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: montserrat.bold,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: montserrat.bold,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  /** §14 H4. Montserrat SemiBold, sentence case — a title inside a section. */
  h3: {
    fontFamily: montserrat.semibold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.1,
  },

  // §12: body copy, captions, lists and data are Arial. §14.3 puts body line
  // height at 140–160%; every role below sits inside that band.
  bodyLarge: {
    fontFamily: supporting.regular,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeight.regular,
  },
  body: {
    fontFamily: supporting.regular,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.regular,
  },
  bodyMedium: {
    fontFamily: supporting.bold,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.bold,
  },
  caption: {
    fontFamily: supporting.regular,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: fontWeight.regular,
  },
  captionMedium: {
    fontFamily: supporting.bold,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: fontWeight.bold,
  },
  micro: {
    fontFamily: montserrat.semibold,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },

  /** §14 H3. Montserrat Bold, all caps, small — the section eyebrow. */
  overline: {
    fontFamily: montserrat.bold,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },

  /** §11.2 accent / quotes. The only place Playfair Display appears. */
  quote: {
    fontFamily: playfair.italic,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: fontWeight.regular,
    fontStyle: 'italic',
  },

  /** A price is a label, not body copy, so it stays on the primary face. */
  price: {
    fontFamily: montserrat.bold,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },

  // §11.2: button text and labels are Montserrat SemiBold. §22.4 sets the
  // sizes — 16 / 14 / 13. (§12.2 puts UI buttons on Arial Bold, but §11.2 and
  // the callouts on §13.3 and §13.4 all say Montserrat SemiBold: two to one.)
  buttonLg: {
    fontFamily: montserrat.semibold,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
  },
  buttonMd: {
    fontFamily: montserrat.semibold,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
  },
  buttonSm: {
    fontFamily: montserrat.semibold,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
