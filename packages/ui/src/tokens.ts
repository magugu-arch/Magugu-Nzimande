import tokens from './tokens.json';

/**
 * The approved palette, typed. Every value comes from tokens.json so that no
 * hex is written twice — the asset scripts in infra read the same file, and
 * tokens.css mirrors it as CSS custom properties with a test holding the two
 * together.
 *
 * The superseded red and PMS number that older digital menu sheets carry are
 * named in tokens.json, next to the values that replace them.
 * scripts/check-brand-rules.mjs fails the build on a hex written anywhere but
 * the two token files.
 */

export const BRAND = tokens.brand;

/** Approved tint ladders run at 100 / 80 / 60 / 40 / 20 / 10. */
export const RED_TINTS = tokens.redTints;
export const BLACK_TINTS = tokens.blackTints;
export const NEUTRAL_TINTS = tokens.neutralTints;

/**
 * A darkened red reserved for the pressed and hovered state of a red control.
 * It sits on the bb.q Red ramp rather than being a blend with another hue.
 */
export const RED_DEEP = tokens.redDeep;

export const TYPEFACES = {
  display: 'Bebas Neue',
  body: 'Montserrat',
} as const;

export type BrandColour = keyof typeof BRAND;
