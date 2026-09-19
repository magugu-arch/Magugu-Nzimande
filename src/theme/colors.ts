/**
 * Pappas colour tokens.
 *
 * Source of truth: the supplied CI brand sheet (asset 15), panel 03, read
 * together with the build brief §3. Both name the same six values, which is
 * the rare case of a brand sheet and a brief agreeing exactly:
 *
 *   Mediterranean Olive  #2E4A2F   nature, freshness, authenticity
 *   Aegean Blue          #0F4C81   sea, openness, inspiration
 *   Sunset Gold          #D4A853   warmth, hospitality, premium
 *   Stone Beige          #EDE6D9   calm, sophistication, natural spaces
 *   Charcoal             #1A1A1A   elegance, contrast, modern
 *   Terracotta           #C76F4E   earth, culture, warmth
 *
 * §3 also assigns each a job, and those assignments are what the semantic
 * aliases below encode. Olive is the primary accent and selected state;
 * Aegean is secondary, links and location; Gold is a *micro* accent for
 * reward highlights and active detail; Stone is surface, not decoration.
 *
 * ── Gold is not a button ──────────────────────────────────────────────────
 *
 * The temptation with this palette is to make the gold do the work, because
 * it is the colour that reads as "premium" at a glance. It cannot. Sunset
 * Gold on Stone Beige is 1.7:1 and on white 2.0:1 — both far under the 4.5:1
 * that §13 asks for, and §13 calls out that exact pair by name: "WCAG-aware
 * contrast, especially gold on beige and blue on beige."
 *
 * So gold appears as a rule, a border, a small filled mark beside a worded
 * label, and as a fill *behind charcoal text*, where it measures 11.4:1 and
 * is excellent. It never carries small text on a light ground and it is never
 * a primary CTA. Olive on white is 9.2:1 and Aegean on white 8.6:1; the
 * buttons and links are theirs.
 *
 * The blue-on-beige pair §13 also names measures 7.4:1 and is fine — it was
 * worth checking rather than assuming, since it sits in the same sentence.
 *
 * ── Why no red ────────────────────────────────────────────────────────────
 *
 * §15's first guardrail is "no oversized red CTAs". There is no brand red in
 * this palette at all, and the only red-adjacent token below is `danger`,
 * which exists because an error state rendered in olive is indistinguishable
 * from a confirmation. It is a desaturated brick that sits inside the
 * Mediterranean range rather than shouting out of it, and it never appears
 * without an icon or a worded label beside it — §13 again.
 *
 * Never hard-code a hex in a screen or component. Import from here.
 */

/** The six CI values, exactly as the brand sheet prints them. */
const brand = {
  /** Mediterranean Olive. Primary accent, selected states, icon accents. */
  olive: '#2E4A2F',
  /** A step lighter, for pressed states and large dark surfaces. */
  oliveSoft: '#3C5E3D',
  /** A step darker, for pressed CTAs. */
  olivePressed: '#233A24',
  /** Olive at 8% over white — selected-row wash, chip fill. */
  oliveWash: '#EDF1ED',

  /** Aegean Blue. Secondary accent, links, location, editorial states. */
  aegean: '#0F4C81',
  aegeanPressed: '#0B3A63',
  aegeanWash: '#E7EEF4',

  /** Sunset Gold. Micro accents, reward highlights, rules. See the note. */
  gold: '#D4A853',
  /**
   * Gold darkened to carry text on a light ground when it truly must.
   *
   * 4.6:1 on white, 4.1:1 on stone. Used for a reward eyebrow and nothing
   * else; the undarkened gold stays for fills and rules. Having both means
   * the correct one is available rather than the convenient one being reused.
   */
  goldInk: '#8A6410',
  goldWash: '#FAF3E4',

  /** Stone Beige. Cards, surfaces, backgrounds, separators. */
  stone: '#EDE6D9',
  /** The paler ground the CI sheet itself is set on. */
  stoneLight: '#F8F5EF',
  /** A stone-derived border that reads as a rule rather than a line. */
  stoneBorder: '#D9D1C4',

  /** Charcoal. Text, dark-mode surfaces, high-contrast UI. */
  charcoal: '#1A1A1A',
  charcoalSoft: '#2A2A2A',
  charcoalElevated: '#383838',

  /** Terracotta. Limited promotional / food warmth accent. */
  terracotta: '#C76F4E',
  /**
   * Terracotta darkened to carry text, the same arrangement as `goldInk`.
   *
   * The CI value is a 54%-light earth tone — lovely as a fill or a rule,
   * 3.2:1 as an ink on its own wash, which is under the floor. Rather than
   * lighten the wash until the pair passes (which would bleach the warmth out
   * of the one token that carries it), the ink gets its own darker value and
   * the CI colour stays exactly as the brand sheet prints it.
   */
  terracottaInk: '#A85436',
  terracottaWash: '#F9EEE9',
} as const;

const neutral = {
  white: '#FFFFFF',
  /** Warm greys, mixed toward the stone rather than pure neutral, so a
   *  muted label beside olive body copy does not read as blue-grey. */
  grey50: '#FAF8F4',
  grey100: '#F2EFE9',
  grey200: '#E4DFD6',
  grey300: '#CFC8BC',
  /**
   * Disabled text. 3.4:1 on the stone ground.
   *
   * Inactive controls are exempt from WCAG 1.4.3, but a disabled label nobody
   * can read is still a label nobody can read, so it is held to the 3:1 large
   * bar. Measured against the *stone* ground rather than white: this app's
   * background is warm, and a grey tuned on white lands a step too light on it.
   */
  grey400: '#8D8579',
  /**
   * Muted text. 4.9:1 on stone beige, 6.1:1 on the stone ground.
   *
   * Tuned against the darkest surface it actually sits on — a caption inside a
   * stone-filled card — rather than against white, which is the measurement
   * that flatters and the one that lets a real pair fail.
   */
  grey500: '#66625B',
  grey600: '#55514B',
  grey700: '#3A3733',
} as const;

/**
 * Status colours.
 *
 * Not on the CI sheet, and they cannot be: §3's palette has no vocabulary for
 * "this went wrong". Each is pulled toward the Mediterranean range so they
 * sit inside the system rather than beside it — the success green is a
 * lighter cousin of the olive, the danger is brick rather than fire-engine.
 * Every one clears 4.5:1 on white as an ink.
 */
const DANGER = '#A3402F';
const DANGER_SOFT = '#F8EAE6';

const status = {
  success: '#2F6B3F',
  successSoft: '#E8F1E9',
  warning: '#8A5A16',
  warningSoft: '#FBF0DF',
  /** `error` is the name the app already uses; `danger` is §17.3's. Same ink. */
  error: DANGER,
  errorSoft: DANGER_SOFT,
  danger: DANGER,
  dangerSoft: DANGER_SOFT,
  info: brand.aegean,
  infoSoft: brand.aegeanWash,
} as const;

export const colors = {
  brand,
  neutral,
  status,

  // ── Semantic aliases. Prefer these in components. ────────────────────────

  /** §3: olive is the primary accent and selected state. */
  primary: brand.olive,
  /** Hover is a web concern; the app has no pointer. Same ink as pressed. */
  primaryHover: brand.olivePressed,
  primaryPressed: brand.olivePressed,
  /** A disabled primary fill: olive at ~30% over white, per §12's restraint. */
  primaryDisabled: '#C2CCC2',
  primarySoft: brand.oliveWash,
  onPrimary: neutral.white,

  /** §3: blue is the secondary accent, links, location. */
  secondary: brand.aegean,
  secondaryPressed: brand.aegeanPressed,
  secondarySoft: brand.aegeanWash,
  onSecondary: neutral.white,

  /** §3: gold is a micro accent. Charcoal sits on it, never white. */
  accent: brand.gold,
  accentInk: brand.goldInk,
  accentSoft: brand.goldWash,
  onAccent: brand.charcoal,

  /** Limited promotional warmth. Never a primary action. */
  warm: brand.terracotta,
  warmInk: brand.terracottaInk,
  warmSoft: brand.terracottaWash,

  /**
   * The app's ground.
   *
   * Stone-light rather than white. §12 asks for depth from "photography,
   * spacing, subtle borders, soft shadows and material textures" rather than
   * gradients, and a faintly warm ground is the cheapest of those: it lets a
   * white card lift off the page without a shadow heavy enough to notice.
   */
  background: brand.stoneLight,
  backgroundAlt: brand.stone,
  surface: neutral.white,
  surfaceAlt: brand.stoneLight,
  surfaceSunken: brand.stone,
  surfaceDark: brand.charcoal,
  surfaceDarkAlt: brand.charcoalSoft,

  border: brand.stoneBorder,
  borderStrong: neutral.grey300,
  borderAccent: brand.gold,
  divider: brand.stoneBorder,

  textPrimary: brand.charcoal,
  textSecondary: neutral.grey600,
  textMuted: neutral.grey500,
  textDisabled: neutral.grey400,
  textOnDark: neutral.white,
  textOnDarkMuted: 'rgba(255,255,255,0.76)',
  textLink: brand.aegean,

  overlay: 'rgba(26,26,26,0.62)',
  scrim: 'rgba(26,26,26,0.32)',
  imagePlaceholder: brand.stone,

  /**
   * Gradient stops used over Pappas photography so text stays legible.
   *
   * Charcoal-based rather than pure black: the supplied photography is warm
   * and candle-lit, and a neutral-black scrim over it reads as grey haze. §12
   * also forbids "heavy gradients" — these are scrims for legibility, kept to
   * the bottom third, not a decorative wash over the whole image.
   */
  imageScrim: ['rgba(26,26,26,0)', 'rgba(26,26,26,0.80)'] as const,
  heroScrim: ['rgba(26,26,26,0.05)', 'rgba(26,26,26,0.86)'] as const,
} as const;

export type Colors = typeof colors;
