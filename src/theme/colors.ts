/**
 * bb.q Chicken colour tokens.
 *
 * Brand source of truth — guidelines v1.0 **§8, the Colour System page**:
 *
 *   §8.1  bb.q Red    #E31937   rgb(227 25 55)   cmyk 0/100/85/0   Pantone 185 C
 *         bb.q Black  #221E1F   rgb(34 30 31)    cmyk 0/0/0/100    Pantone Black C
 *         White       #FFFFFF   rgb(255 255 255) cmyk 0/0/0/0      Pantone White C
 *
 * The Pantone and CMYK values are recorded here because they have no other
 * home in this repository, and packaging, in-store print and any franchise
 * collateral will need them. Nothing in the app reads them.
 *
 * §8.1 confirms the two values this file already carried, so the earlier
 * reading of §23.4 stands — including bb.q Black as #221E1F against the
 * #221E1E printed on the app page and in the brief. Three guideline pages to
 * one now, and the two differ by a single unit of blue.
 *
 * §8.3 sets the usage hierarchy, and it is the one the app already follows:
 * red dominant for key brand moments, calls to action and highlights; black
 * for text, icons and strong contrast; white as the background that creates
 * "clarity, space and a premium feel". Note that §8.3 sets no *ratio* — the
 * 50/30/15/5 split noted from §10.2 is a print-weighted direction, and §8.3
 * asking for white backgrounds is a much better fit for this app's light
 * ground than §10.1's grudging "can be adjusted slightly". The photography
 * carries the red.
 *
 * §8.3's last rule is "DO NOT USE UNAPPROVED COLOURS — avoid using tints,
 * tones or colours outside the approved palette." Two deliberate departures,
 * both narrower than they look:
 *
 *   - The **status hues** below are not in §8. They cannot be: an error state
 *     rendered in bb.q Red is indistinguishable from a call to action, which
 *     is the exact failure §32.4 warns about. The brief's own token block
 *     names success, warning and danger colours, so this is authorised there
 *     rather than invented here. They stay accents and never compete with red.
 *   - The **neutral scale** is warm (R>G>B) where §8.2's neutral tints are
 *     even grey. These are UI inks — borders, muted labels, disabled text —
 *     tuned to clear §32.3's contrast floor, not brand tints. §8.2's ramp is
 *     exported below for anything that *is* a brand tint.
 *
 * A `cream` surface token (#FFF5E6, read off §23.4) used to live here. §8 has
 * no cream, the brief prints a different value for it (#F5F1EE), and nothing
 * in the app ever rendered it — so it has been removed rather than left as a
 * third conflicting answer waiting for someone to use.
 *
 * Never hard-code a hex value in a screen or component. Import from here so a
 * brand refresh is a single-file change.
 */

/**
 * §8.2's tint ramps — the brand colours at 100 / 80 / 60 / 40 / 20 / 10%.
 *
 * Computed as the brand colour composited over white at that percentage,
 * which is what a tint is and what the printed ramp shows.
 *
 * These are *not* sampled from the supplied guideline page, deliberately. That
 * page is not colour-faithful: its own §8.1 swatches, the ones labelled with
 * their hex values, render as #DE0615 against a printed #E31937 and #161515
 * against a printed #221E1F. Sampling the tints off the same render would
 * bake that shift into the app. Computing them from the authoritative §8.1
 * values reproduces the ramp exactly and is checkable by hand.
 */
function tintOverWhite(hex: string, percent: number): string {
  const to = (i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mix = (channel: number) => Math.round(channel * percent + 255 * (1 - percent));
  return `#${[0, 1, 2].map((i) => mix(to(i)).toString(16).padStart(2, '0').toUpperCase()).join('')}`;
}

const RED_BASE = '#E31937';
const BLACK_BASE = '#221E1F';

/** §8.2. Index by percentage, e.g. `tints.red[20]`. */
export const tints = {
  red: {
    100: RED_BASE,
    80: tintOverWhite(RED_BASE, 0.8),
    60: tintOverWhite(RED_BASE, 0.6),
    40: tintOverWhite(RED_BASE, 0.4),
    20: tintOverWhite(RED_BASE, 0.2),
    10: tintOverWhite(RED_BASE, 0.1),
  },
  black: {
    100: BLACK_BASE,
    80: tintOverWhite(BLACK_BASE, 0.8),
    60: tintOverWhite(BLACK_BASE, 0.6),
    40: tintOverWhite(BLACK_BASE, 0.4),
    20: tintOverWhite(BLACK_BASE, 0.2),
    10: tintOverWhite(BLACK_BASE, 0.1),
  },
} as const;

/**
 * The button-state reds were checked against §22.3's own artwork rather than
 * left as assertions.
 *
 * The page render shifts colour (see `tints` above), so the four primary-state
 * fills were sampled and then calibrated against the one whose value is known:
 * DEFAULT is #E31937 by §8.1, and renders as rgb(209 24 25). Reading the other
 * three through that correction gives hover ≈ #AF132A, pressed ≈ #850F20, and
 * a disabled fill that solves to bb.q Red at 29–30% over white — against the
 * #B8122C, #8C0E21 and #F7BFC7 below. Every one lands within about nine units
 * per channel, which is inside the render's own error. Left as they are.
 */
const brand = {
  /** bb.q Red — primary CTA, active nav, price, badges. §8.1. */
  red: '#E31937',
  /** §22.3 hover: the same red stepped down in lightness, not a new hue. */
  redHover: '#B8122C',
  redPressed: '#8C0E21',
  /** §22.3 disabled primary fill: bb.q Red at roughly 30% over white. */
  redDisabled: '#F7BFC7',
  redSoft: '#FDE8EB',
  redTint: '#FBD3D9',
  /** bb.q Black — headings, primary surfaces on dark screens. */
  black: '#221E1F',
  blackSoft: '#332E2E',
  blackElevated: '#3D3737',
} as const;

const neutral = {
  white: '#FFFFFF',
  grey50: '#FAFAFA',
  /** §23.4 Light Grey. */
  grey100: '#F2F2F2',
  grey200: '#E7E5E5',
  grey300: '#D4D1D1',
  grey400: '#948F8F',
  grey500: '#7A7474',
  grey600: '#575050',
  grey700: '#3D3737',
} as const;

/**
 * Status colours, darkened to clear §32.3.
 *
 * Every one of these is used as an ink — 13px caption text, a field border, a
 * small icon — over white or over its own tint. At the brighter values they
 * started at, four of the eight pairs fell under 4.5:1 and the amber pair
 * under 3:1, which the contrast test now catches. The hues are unchanged.
 *
 * §32.4 also asks that colour never carries meaning alone, so each of these
 * appears alongside an icon or a worded label, never on its own.
 */
const status = {
  success: '#12703E',
  successSoft: '#E5F5EC',
  warning: '#8C5300',
  warningSoft: '#FDF2E0',
  error: '#B3261E',
  errorSoft: '#FCEAEA',
  info: '#1A5CB4',
  infoSoft: '#E8F0FD',
} as const;

export const colors = {
  brand,
  neutral,
  status,

  // Semantic aliases — prefer these in components.
  primary: brand.red,
  primaryHover: brand.redHover,
  primaryPressed: brand.redPressed,
  primarySoft: brand.redSoft,
  onPrimary: neutral.white,

  background: neutral.white,
  backgroundAlt: neutral.grey50,
  surface: neutral.white,
  surfaceAlt: neutral.grey100,
  surfaceDark: brand.black,
  surfaceDarkAlt: brand.blackSoft,

  border: neutral.grey200,
  borderStrong: neutral.grey300,
  divider: neutral.grey200,

  textPrimary: brand.black,
  textSecondary: neutral.grey600,
  textMuted: neutral.grey500,
  textDisabled: neutral.grey400,
  textOnDark: neutral.white,
  textOnDarkMuted: 'rgba(255,255,255,0.72)',

  overlay: 'rgba(34,30,31,0.62)',
  scrim: 'rgba(34,30,31,0.35)',
  imagePlaceholder: neutral.grey200,

  /** Gradient stops used over food photography so text stays legible. */
  imageScrim: ['rgba(34,30,31,0)', 'rgba(34,30,31,0.78)'] as const,
  heroScrim: ['rgba(34,30,31,0.10)', 'rgba(34,30,31,0.88)'] as const,
} as const;

export type Colors = typeof colors;
