import { type TextStyle } from 'react-native';

/**
 * Pappas typography.
 *
 * Source of truth: the CI brand sheet (asset 15), panel 04, and the build
 * brief §3, which agree on a three-face system and on what each face is for.
 *
 *   Cinzel      display / editorial — "hero headings, section titles and
 *               premium menu storytelling only"
 *   Montserrat  UI / body / navigation — "all interactive product UI, prices,
 *               descriptions, labels and buttons"
 *   Allura      accent / campaign script — "sparingly for a single emotional
 *               phrase or promotional accent; never for navigation, prices,
 *               form labels or critical information"
 *
 * All three are bundled and loaded at startup (see `app/_layout.tsx`).
 *
 * ── The three rules that keep this from going wrong ───────────────────────
 *
 * **Cinzel is capitals, whatever you type.** It is an inscriptional Roman
 * face — its lowercase is a set of small capitals, not a true minuscule. That
 * makes it magnificent for "MEZEDAKIA" across a category hero and unreadable
 * for a three-line dish description. So every Cinzel role below is a heading
 * with a short line, and none of them is body copy. This is also why Cinzel
 * needs positive letter-spacing where Montserrat needs negative: capitals set
 * tight close up, and the supplied posters set them generously open.
 *
 * **Allura appears once per screen at most, and never alone.** §3 is explicit
 * that it must never carry navigation, prices, form labels or critical
 * information, and §13's accessibility floor adds the reason: a looping
 * script at 22px is hard to read for anyone, and impossible at speed. The
 * `accent` role exists for the one line the supplied artwork itself uses that
 * way — "Small plates. Big moments." — and every place it appears, the same
 * information is also available in Montserrat nearby.
 *
 * **Montserrat carries everything a customer must act on.** Prices, buttons,
 * labels, descriptions, navigation. If a reader needs it to order, reserve or
 * pay, it is Montserrat.
 *
 * ── Sizes ─────────────────────────────────────────────────────────────────
 *
 * §17.3's scale (display 34, h1 28, h2 22, h3 18, body 16…) is a design-tool
 * scale and it is the right proportion, but the top of it is generous for a
 * 320pt phone: 34px of Cinzel capitals is about eleven characters a line.
 * The ratios are kept and the top two steps are brought down one notch, which
 * is the same adjustment §17.4's own `textStyles` makes when it sets
 * `sectionTitle` at 24 against the token block's 28.
 *
 * ── Weight, and why the text roles are Medium rather than Regular ─────────
 *
 * The first cut of this scale set every text role in Montserrat Regular,
 * which is the obvious reading of "Montserrat carries the UI" and was wrong
 * on a handset. Three things compound:
 *
 *   - **Montserrat is geometric.** Near-circular counters, near-uniform
 *     stroke, generous sidebearings. At a given nominal weight it puts less
 *     ink on the page than a humanist sans, so Regular here is visibly
 *     lighter than Regular in the faces most UI scales were tuned on.
 *   - **The ground is warm, not white.** `background` is stone at #F8F5EF.
 *     Every ratio on it is lower than the same pair on white, and thin
 *     strokes are what loses first.
 *   - **Phones are read at arm's length in daylight.** The web preview this
 *     was designed against flatters all of it.
 *
 * So the roles a customer actually reads — body, bodyLarge, caption — are
 * Medium. That is one step, not a shout: it restores the colour the page was
 * drawn to have without turning captions into headings, and it leaves the
 * semibold roles above them still clearly heavier.
 *
 * ── The small end ────────────────────────────────────────────────────────
 *
 * 11px was the floor for `overline` and `micro`, and 11px of letterspaced
 * capitals is decorative rather than readable at arm's length. Both move to
 * 12, and `caption` — which carries dish descriptions, addresses and helper
 * text — moves to 14.
 *
 * `overline`'s tracking comes down with it. Tracking that opens a display
 * line destroys word shape at text sizes: 1.6 on 11px is 15% of the em, wide
 * enough that a reader assembles the word letter by letter. 1.2 on 12px is
 * 10% — still unmistakably a spaced capital eyebrow, still a word.
 */

/** Montserrat weights — UI, body, navigation, prices. */
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
 * Cinzel weights — display and editorial only.
 *
 * Regular and SemiBold are bundled. The heavier cuts exist but are not used:
 * Cinzel Bold at heading sizes closes up its counters and starts to read as
 * a logo rather than as type, and the supplied Pappas artwork sets every
 * headline in the lighter cuts.
 */
export const cinzel = {
  regular: 'Cinzel_400Regular',
  semibold: 'Cinzel_600SemiBold',
} as const;

/** Allura — one weight, because the face has one. */
export const allura = {
  regular: 'Allura_400Regular',
} as const;

export const fontFamily = { montserrat, cinzel, allura };

export const fontWeight = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/** Vertical rhythm between heading levels. */
export const headingGap = {
  h1ToH2: 24,
  h2ToH3: 16,
  h3ToH4: 12,
  h4ToBody: 8,
} as const;

/** Named text roles. Every `<Text>` in the app resolves to one of these. */
export const typography = {
  /**
   * The one-line editorial headline over a hero image.
   *
   * Cinzel, open tracking, no uppercase transform — the face is already
   * capitals, and forcing `textTransform` on top of that breaks its small
   * capitals into something uneven.
   */
  hero: {
    fontFamily: cinzel.semibold,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.6,
  },
  /** Largest in-app heading: a dish name on its detail screen, a thank-you. */
  display: {
    fontFamily: cinzel.semibold,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.4,
  },
  /** A screen title. */
  h1: {
    fontFamily: cinzel.semibold,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.4,
  },
  /**
   * A section title — "Happening at Pappas", "Explore Pappas".
   *
   * §6 asks for "editorial separators and oversized section headings rather
   * than dense grid repetition", which is what this role is for.
   */
  /**
   * SemiBold, not Regular. Cinzel Regular is an elegant inscriptional cut
   * and at 20px on a warm ground it reads as a caption in a serif rather
   * than as the section heading §6 asks to be "oversized". The heavier cut
   * is what makes the heading hold the section together.
   */
  h2: {
    fontFamily: cinzel.semibold,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
  },
  /**
   * A title inside a section — a card heading, a list group.
   *
   * The first role to leave Cinzel. Below about 18px the inscriptional
   * capitals stop being legible at a glance and start being decorative, and a
   * card heading has to be scannable.
   */
  h3: {
    fontFamily: montserrat.semibold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.1,
  },

  bodyLarge: {
    fontFamily: montserrat.medium,
    fontSize: 16,
    lineHeight: 25,
    fontWeight: fontWeight.medium,
  },
  body: {
    fontFamily: montserrat.medium,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: fontWeight.medium,
  },
  bodyMedium: {
    fontFamily: montserrat.semibold,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: fontWeight.semibold,
  },
  caption: {
    fontFamily: montserrat.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeight.medium,
  },
  captionMedium: {
    fontFamily: montserrat.semibold,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeight.semibold,
  },
  micro: {
    fontFamily: montserrat.semibold,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
  },

  /**
   * The section eyebrow — "PAPPAS SIGNATURE", "DATE NIGHT".
   *
   * Montserrat rather than Cinzel, deliberately, even though both are
   * capitals here. An eyebrow sits directly above a Cinzel section title, and
   * two capital faces stacked read as one confused heading; the weight and
   * width contrast is what separates them. The supplied posters do exactly
   * this — Cinzel "MEZEDAKIA" over a letterspaced sans "A TASTE OF THE
   * MEDITERRANEAN".
   */
  overline: {
    fontFamily: montserrat.bold,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  /**
   * The Allura accent. One phrase, never load-bearing.
   *
   * Line height is generous because the face has long descenders and a high
   * ascender loop; at 1.2× it collides with itself.
   */
  accent: {
    fontFamily: allura.regular,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: fontWeight.regular,
  },

  /**
   * An editorial pull quote — the venue story, the brand line.
   *
   * Cinzel regular rather than Allura: a quote is read, not glanced at.
   */
  quote: {
    fontFamily: cinzel.regular,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: fontWeight.regular,
    letterSpacing: 0.3,
  },

  /** §3: prices are Montserrat. Never Cinzel, never Allura. */
  price: {
    fontFamily: montserrat.semibold,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.1,
  },

  buttonLg: {
    fontFamily: montserrat.semibold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },
  buttonMd: {
    fontFamily: montserrat.semibold,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },
  buttonSm: {
    fontFamily: montserrat.semibold,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.3,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/**
 * How far each role may follow the OS text-size setting.
 *
 * React Native scales every `Text` by the device font scale unless told
 * otherwise. iOS reaches about 3.1× at the largest accessibility size,
 * Android 2.0 — enough to burst any box with a fixed height.
 *
 * The split is between text people read and text that labels a control:
 *
 * - **Content** — headings, body, captions, prices — is uncapped. It is the
 *   reason someone turned the setting up, and it sits in boxes that grow.
 *   §13 asks for exactly this: "responsive typography and Dynamic Type /
 *   system scaling where the platform supports it".
 * - **Chrome** — button labels, tab labels, badges, eyebrows — is capped at
 *   2×, matching WCAG 1.4.4's 200%. These live in fixed geometry and mostly
 *   cannot wrap, so past that they truncate rather than inform.
 *
 * `accent` is capped too, which is the one addition Pappas makes to this
 * list. Allura at 3× is 72px of looping script; it does not wrap gracefully,
 * it is decorative rather than informative by §3's own instruction, and
 * letting it grow unbounded pushes the content someone actually turned the
 * setting up to read off the bottom of the screen.
 */
export const CHROME_FONT_SCALE_CAP = 2;

const CAPPED_VARIANTS: ReadonlySet<TypographyVariant> = new Set([
  'buttonLg',
  'buttonMd',
  'buttonSm',
  'overline',
  'micro',
  'accent',
]);

/**
 * `undefined` means "no limit" to React Native, which is what content wants.
 */
export function fontScaleCapFor(variant: TypographyVariant): number | undefined {
  return CAPPED_VARIANTS.has(variant) ? CHROME_FONT_SCALE_CAP : undefined;
}
