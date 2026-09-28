import type { TextStyle } from 'react-native';

/**
 * The board's TYPOGRAPHY panel names three faces:
 *   Playfair Display — headings
 *   Montserrat       — body text (and the wide-tracked uppercase labels)
 *   Allura           — accents / signature, used sparingly
 */
export const fontFamily = {
  display: 'PlayfairDisplay_400Regular',
  displayItalic: 'PlayfairDisplay_400Regular_Italic',
  displayMedium: 'PlayfairDisplay_500Medium',
  body: 'Montserrat_400Regular',
  bodyLight: 'Montserrat_300Light',
  bodyMedium: 'Montserrat_500Medium',
  bodySemiBold: 'Montserrat_600SemiBold',
  script: 'Allura_400Regular',
} as const;

export const typography = {
  hero: { fontFamily: fontFamily.display, fontSize: 40, lineHeight: 46 },
  h1: { fontFamily: fontFamily.display, fontSize: 32, lineHeight: 38 },
  h2: { fontFamily: fontFamily.display, fontSize: 25, lineHeight: 31 },
  h3: { fontFamily: fontFamily.display, fontSize: 20, lineHeight: 26 },
  title: { fontFamily: fontFamily.bodyMedium, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 23 },
  bodySmall: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
  /** The board's letter-spaced capitals: "OUR ESSENCE", "RESTAURANT". */
  eyebrow: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  button: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  price: { fontFamily: fontFamily.bodyMedium, fontSize: 15, lineHeight: 20 },
  script: { fontFamily: fontFamily.script, fontSize: 30, lineHeight: 36 },
  quote: { fontFamily: fontFamily.displayItalic, fontSize: 19, lineHeight: 27 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
