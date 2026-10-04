/**
 * NMU ONE design tokens — brief §17 and the supplied C.I. sheet.
 *
 * Every colour, space, radius, shadow and duration in the app resolves to a
 * token here. Screens never hard-code a hex value or a magic number.
 *
 * Contrast (WCAG 2.2 AA, measured — see __tests__/contrast.test.ts):
 *   navy on canvas 15.3:1 · textSecondary on canvas 5.6:1 · yellow on navy 11.3:1
 *   navy on yellow 11.3:1 · white on navy2 13.7:1
 * Primary Yellow on white is 1.5:1, so yellow is a *fill* behind navy text and
 * an accent rule — never a text colour on a light surface.
 */

export const palette = {
  /** C.I. Primary Navy — #141C2B · CMYK 100 80 40 60 */
  navy: '#141C2B',
  /** C.I. Secondary Navy — #132E51 · CMYK 100 70 25 25 */
  navy2: '#132E51',
  /** C.I. Primary Yellow — #FFCC00 · CMYK 0 18 100 0 */
  yellow: '#FFCC00',
  /** C.I. Secondary Yellow — #F9B22A · CMYK 0 35 100 0 */
  yellow2: '#F9B22A',
  /** Editorial / neutral canvas, brief §17. */
  canvas: '#F3F3EE',
  white: '#FFFFFF',
} as const;

export const colors = {
  ...palette,

  background: palette.canvas,
  surface: palette.white,
  surfaceSunken: '#EAE9E2',
  surfaceNavy: palette.navy,
  surfaceNavy2: palette.navy2,

  textPrimary: palette.navy,
  textSecondary: '#5A6072',
  textOnDark: palette.white,
  textOnDarkMuted: '#B8C0CF',
  textOnYellow: palette.navy,

  border: '#E2E1D9',
  borderStrong: '#C9C8BE',
  borderOnDark: 'rgba(255,255,255,0.14)',
  focus: palette.navy2,

  success: '#1E7B4F',
  successSoft: '#E6F2EC',
  warning: '#8A5A00',
  warningSoft: '#FFF4D1',
  danger: '#B3261E',
  dangerSoft: '#FBE9E7',
  info: palette.navy2,
  infoSoft: '#E7EDF5',

  scrim: 'rgba(20,28,43,0.55)',
  overlayTop: 'rgba(20,28,43,0.0)',
  overlayBottom: 'rgba(20,28,43,0.86)',
} as const;

export type ColorToken = keyof typeof colors;

/** 4-point scale. `gutter` is the screen edge margin. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  gutter: 20,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Restrained shadows (brief §17): one level for cards, one for floating chrome. */
export const elevation = {
  card: {
    shadowColor: palette.navy,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  float: {
    shadowColor: palette.navy,
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

/** Brief §19: 120–240ms for common transitions; immediate tap feedback. */
export const motion = {
  tap: 90,
  fast: 120,
  base: 200,
  slow: 240,
} as const;

/** Brief §20: minimum 48px touch targets. */
export const MIN_TOUCH_TARGET = 48;
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const TAB_BAR_HEIGHT = 60;
/** Widest the phone layout grows on web and tablets before it centres. */
export const MAX_CONTENT_WIDTH = 560;
