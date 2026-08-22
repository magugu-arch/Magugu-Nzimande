/**
 * bb.q Chicken colour tokens.
 *
 * Brand source of truth (see brief §6):
 *   Primary Red   — bb.q Red   #E31937
 *   Secondary     — bb.q Black #221E1E
 *
 * Never hard-code a hex value in a screen or component. Import from here so a
 * brand refresh is a single-file change.
 */

const brand = {
  /** bb.q Red — primary CTA, active nav, price, badges. */
  red: '#E31937',
  redPressed: '#B8122C',
  redSoft: '#FDE8EB',
  redTint: '#FBD3D9',
  /** bb.q Black — headings, primary surfaces on dark screens. */
  black: '#221E1E',
  blackSoft: '#332E2E',
  blackElevated: '#3D3737',
} as const;

const neutral = {
  white: '#FFFFFF',
  grey50: '#FAFAFA',
  grey100: '#F4F4F5',
  grey200: '#E7E5E5',
  grey300: '#D4D1D1',
  grey400: '#A8A3A3',
  grey500: '#7A7474',
  grey600: '#575050',
  grey700: '#3D3737',
} as const;

const status = {
  success: '#1E9E5A',
  successSoft: '#E5F5EC',
  warning: '#E08700',
  warningSoft: '#FDF2E0',
  error: '#D32F2F',
  errorSoft: '#FCEAEA',
  info: '#1E6FD9',
  infoSoft: '#E8F0FD',
} as const;

export const colors = {
  brand,
  neutral,
  status,

  // Semantic aliases — prefer these in components.
  primary: brand.red,
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

  overlay: 'rgba(34,30,30,0.62)',
  scrim: 'rgba(34,30,30,0.35)',
  imagePlaceholder: neutral.grey200,

  /** Gradient stops used over food photography so text stays legible. */
  imageScrim: ['rgba(34,30,30,0)', 'rgba(34,30,30,0.78)'] as const,
  heroScrim: ['rgba(34,30,30,0.10)', 'rgba(34,30,30,0.88)'] as const,
} as const;

export type Colors = typeof colors;
