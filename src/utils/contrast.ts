/**
 * WCAG contrast maths, for the thresholds brand guidelines §32.3 sets:
 *
 *   AA   normal text (under 18pt / 24px)   4.5:1
 *   AAA  large text  (18pt+ / 24px+)       3:1
 *
 * Kept as a utility rather than a lint rule because it is checked two ways:
 * a test asserts every pair the theme ships clears its threshold, and screens
 * that colour text over artwork can pick a legible ink at runtime.
 */

/** Threshold for text under 24px. */
export const AA_NORMAL = 4.5;
/** Threshold for text at 24px and above, and for non-text UI. */
export const AA_LARGE = 3;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Parse `#RGB` or `#RRGGBB`. Throws rather than guessing on anything else. */
export function parseHex(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }

  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Relative luminance, WCAG 2.1 definition. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two opaque colours, 1:1 to 21:1. */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsAA(foreground: string, background: string, large = false): boolean {
  return contrastRatio(foreground, background) >= (large ? AA_LARGE : AA_NORMAL);
}

/**
 * Pick whichever ink reads better on a background.
 *
 * For text over food photography, where the underlying colour is only known
 * once a scrim has been composited.
 */
export function readableInk(background: string, inks: readonly [string, string]): string {
  const [first, second] = inks;
  return contrastRatio(first, background) >= contrastRatio(second, background) ? first : second;
}
