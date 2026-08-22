/**
 * bb.q Chicken colour tokens.
 *
 * Brand source of truth — guidelines v1.0 §23.4 (UI colour usage):
 *   bb.q Red    #E31937
 *   bb.q Black  #221E1F
 *   White       #FFFFFF
 *   Cream       #FFF5E6
 *   Light Grey  #F2F2F2
 *
 * bb.q Black is #221E1F: §10.2 prints it that way in all four ratio columns
 * and §23.4 agrees, against #221E1E on the app page and in the brief. Two
 * guideline pages to one, so the guidelines win. The two differ by a single
 * unit of blue and are indistinguishable on screen.
 *
 * §10.2 sets a colour ratio for digital of 50% red, 30% black, 15% white and
 * 5% neutral tint. That is a direction for a designer's eye, not something
 * code can assert, and it is not what the app currently looks like: these
 * screens are mostly white with red as the accent. Deliberately so — the
 * client's own app mockups are light-ground, §10.1 says the ratios "can be
 * adjusted slightly to suit specific applications", and a food-ordering app
 * that is half red leaves the photography nowhere to sit. What the app does
 * honour is §10.3's hierarchy: red leads, black supports, white does the
 * spacing work, and the status hues stay accents that never compete with red.
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
  black: '#221E1F',
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

  overlay: 'rgba(34,30,31,0.62)',
  scrim: 'rgba(34,30,31,0.35)',
  imagePlaceholder: neutral.grey200,

  /** Gradient stops used over food photography so text stays legible. */
  imageScrim: ['rgba(34,30,31,0)', 'rgba(34,30,31,0.78)'] as const,
  heroScrim: ['rgba(34,30,31,0.10)', 'rgba(34,30,31,0.88)'] as const,
} as const;

export type Colors = typeof colors;
