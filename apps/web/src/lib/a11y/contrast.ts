/**
 * Contrast, by the WCAG 2.2 definition.
 *
 * Written out rather than eyeballed because "that looks readable to me" is a
 * judgement made by someone with the design open on a good screen in a lit
 * room, and the customer is outside a store at midday holding a cracked phone.
 * The brand palette is fixed by the guidelines, so the useful thing a machine
 * can do is say which of its pairings may carry text and which may not.
 */

export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((character) => character + character)
          .join('')
      : value;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Not a colour: ${hex}`);
  return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16)) as Rgb;
}

/**
 * Relative luminance, WCAG 2.2 §Relative luminance.
 *
 * The channel transfer is not a gamma of 2.2 and not a simple average: it is
 * the sRGB inverse companding, and the coefficients are weighted for how much
 * each primary contributes to perceived brightness. Approximating either is how
 * a palette passes a home-made checker and fails a real one.
 */
export function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Between 1 (identical) and 21 (black on white). Order does not matter. */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(parseHex(foreground));
  const b = luminance(parseHex(background));
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The thresholds, named so a call site reads as the rule it is applying.
 *
 * `largeText` is 18.66px bold or 24px regular and above — a threshold that is
 * easy to claim and hard to hold, so anything using it should say which type
 * role it means.
 */
export const AA = {
  text: 4.5,
  largeText: 3,
  /** Borders, focus rings, icons that carry meaning on their own. */
  interface: 3,
} as const;

export function meetsAA(
  foreground: string,
  background: string,
  level: keyof typeof AA = 'text',
): boolean {
  return contrastRatio(foreground, background) >= AA[level];
}

/** Rounded the way a report should round it: down, so nothing is flattered. */
export const ratioOf = (foreground: string, background: string): number =>
  Math.floor(contrastRatio(foreground, background) * 100) / 100;
