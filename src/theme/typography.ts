import { type TextStyle } from 'react-native';

/**
 * bb.q Chicken typography — guidelines §11, §13, §14.
 *
 *   §11  Montserrat, primary. The whole hierarchy: headlines, subheadings,
 *        body copy, captions, buttons and labels.
 *   §13  Playfair Display, editorial. Quotes and accents, sparingly.
 *
 * Both faces are bundled and loaded at startup (see `app/_layout.tsx`).
 *
 * ── Why no Arial ───────────────────────────────────────────────────────────
 * This file used to set body copy, captions and lists in Arial, on the reading
 * that §12 assigns the supporting face that work. The supplied §11 page
 * settles it the other way, and it is the more authoritative of the two:
 *
 *   - §11.1 names the type system, and it has exactly two members — Montserrat
 *     primary, Playfair Display secondary. Arial is not in it.
 *   - §11.2's TYPE USAGE table covers the *whole* hierarchy, body copy and
 *     captions included, and puts every row on Montserrat except accents and
 *     quotes. It is not a headline-only table.
 *   - §11's DO NOT is explicit: "Use other typefaces that are not part of the
 *     bb.q system."
 *
 * That is the same way the §11-versus-§12 conflict over button text was already
 * resolved on this branch, so the codebase is now consistent about which page
 * wins rather than splitting the difference. §12 has not been supplied to this
 * project, so it is being superseded unseen — if the brand team confirms it
 * governs body copy after all, this is a one-file revert.
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

export const fontFamily = { montserrat, playfair };

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

  // §11.2: body copy is Montserrat Regular, captions and small text Montserrat
  // "Light / Regular". §14.3 puts body line height at 140–160%; every role
  // below sits inside that band.
  //
  // Two readings of §11.2 worth recording, because neither is spelled out:
  //
  //   - Captions take the Regular half of "Light / Regular". At 13px, Light
  //     (300) is too fragile to hold the contrast §32.3 asks for on small text
  //     — the weight, not just the colour, is what makes it fail. Light stays
  //     available in the scale for larger, quieter text.
  //   - The emphasised runs (`bodyMedium`, `captionMedium`) take SemiBold.
  //     §11.2 has no row for emphasis inside body copy, so this is the nearest
  //     listed weight that keeps the contrast the old Arial Bold gave; Medium
  //     (500) all but disappears against Montserrat Regular at these sizes.
  bodyLarge: {
    fontFamily: montserrat.regular,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeight.regular,
  },
  body: {
    fontFamily: montserrat.regular,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.regular,
  },
  bodyMedium: {
    fontFamily: montserrat.semibold,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
  },
  caption: {
    fontFamily: montserrat.regular,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: fontWeight.regular,
  },
  captionMedium: {
    fontFamily: montserrat.semibold,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: fontWeight.semibold,
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

/**
 * How far each role may follow the OS text-size setting.
 *
 * React Native scales every `Text` by the device font scale unless told
 * otherwise, and nothing in this app told it otherwise. iOS reaches about 3.1×
 * at the largest accessibility size, Android 2.0 — enough to burst any box with
 * a fixed height.
 *
 * The split is between text people read and text that labels a control:
 *
 * - **Content** — headings, body, captions, prices — is uncapped. It is the
 *   reason someone turned the setting up, and it sits in boxes that grow.
 * - **Chrome** — button labels, tab labels, badges, eyebrows — is capped at
 *   2×, matching WCAG 1.4.4's 200%. These live in fixed geometry and mostly
 *   cannot wrap, so past that they truncate rather than inform.
 *
 * 2× is not comfortable for a button label on its own: `npm run assets:typefit`
 * measures the real Montserrat advance widths at 320pt and finds the tightest
 * CTA ("TRACK THIS ORDER") has only 1.07× of horizontal headroom on one line.
 * That is why Button pairs this cap with a second line and a minimum rather
 * than a fixed height — the cap bounds the growth, the wrapping absorbs it.
 */
export const CHROME_FONT_SCALE_CAP = 2;

const CAPPED_VARIANTS: ReadonlySet<TypographyVariant> = new Set([
  'buttonLg',
  'buttonMd',
  'buttonSm',
  'overline',
  'micro',
]);

/**
 * `undefined` means "no limit" to React Native, which is what content wants.
 */
export function fontScaleCapFor(variant: TypographyVariant): number | undefined {
  return CAPPED_VARIANTS.has(variant) ? CHROME_FONT_SCALE_CAP : undefined;
}
