/**
 * bb.q Chicken colour tokens.
 *
 * Brand source of truth — guidelines v1.0 §23.4 (UI colour usage):
 *   bb.q Red    #E31937
 *   bb.q Black  #221E1E
 *   White       #FFFFFF
 *   Cream       #FFF5E6
 *   Light Grey  #F2F2F2
 *
 * One known discrepancy in the guidelines themselves: §23.4 prints bb.q Black
 * as #221E1F while the app page and the brief both give #221E1E. They differ
 * by one unit in blue and are indistinguishable on screen; #221E1E is used
 * here because two of the three sources agree on it. Worth settling before
 * anything goes to print.
 *
 * Never hard-code a hex value in a screen or component. Import from here so a
 * brand refresh is a single-file change.
 */

const brand = {
  /** bb.q Red — primary CTA, active nav, price, badges. */
  red: '#E31937',
  /** §22.3 hover: the same red stepped down in lightness, not a new hue. */
  redHover: '#B8122C',
  redPressed: '#8C0E21',
  /** §22.3 disabled primary fill: bb.q Red at roughly 30% over white. */
  redDisabled: '#F7BFC7',
  redSoft: '#FDE8EB',
  redTint: '#FBD3D9',
  /** bb.q Black — headings, primary surfaces on dark screens. */
  black: '#221E1E',
  blackSoft: '#332E2E',
  blackElevated: '#3D3737',
} as const;

const neutral = {
  white: '#FFFFFF',
  /** §23.4 Cream — warm alternate surface behind food photography. */
  cream: '#FFF5E6',
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
  /** §23.4 Cream — the warm surface the guidelines pair with food imagery. */
  surfaceWarm: neutral.cream,
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

  overlay: 'rgba(34,30,30,0.62)',
  scrim: 'rgba(34,30,30,0.35)',
  imagePlaceholder: neutral.grey200,

  /** Gradient stops used over food photography so text stays legible. */
  imageScrim: ['rgba(34,30,30,0)', 'rgba(34,30,30,0.78)'] as const,
  heroScrim: ['rgba(34,30,30,0.10)', 'rgba(34,30,30,0.88)'] as const,
} as const;

export type Colors = typeof colors;
