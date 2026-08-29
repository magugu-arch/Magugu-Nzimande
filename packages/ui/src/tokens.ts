/**
 * The only file in this repository permitted to carry a raw hex value.
 * Sourced from Brand Identity Guidelines v1.0 section 08. Anything showing
 * #E31A1C or PMS 485 C came from a superseded menu sheet and is wrong.
 *
 * scripts/check-brand-rules.mjs fails the build if a hex appears anywhere else.
 */

export const BRAND = {
  red: '#E31937',
  black: '#221E1F',
  white: '#FFFFFF',
  yellow: '#FFC20E',
  gold: '#DAAF37',
} as const;

/** Approved tint ladders run at 100 / 80 / 60 / 40 / 20 / 10. */
export const RED_TINTS = {
  100: '#E31937',
  80: '#E94660',
  60: '#EE7489',
  40: '#F4A3B1',
  20: '#F9D1D8',
  10: '#FCE8EB',
} as const;

export const BLACK_TINTS = {
  100: '#221E1F',
  80: '#4E4B4C',
  60: '#7A7879',
  40: '#A7A5A5',
  20: '#D3D2D2',
  10: '#E9E8E8',
} as const;

export const NEUTRAL_TINTS = {
  100: '#6E6660',
  80: '#8B8480',
  60: '#A8A3A0',
  40: '#C5C1BF',
  20: '#E7E2DC',
  10: '#F7F5F2',
} as const;

/**
 * A darkened red reserved for the pressed and hovered state of a red control.
 * It sits on the bb.q Red ramp rather than being a blend with another hue.
 */
export const RED_DEEP = '#B31129';

export const TYPEFACES = {
  display: 'Bebas Neue',
  body: 'Montserrat',
} as const;

export type BrandColour = keyof typeof BRAND;
