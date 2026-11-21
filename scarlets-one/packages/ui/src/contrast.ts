/** WCAG 2.x contrast maths, used by the token tests and the admin console. */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColour(input: string): Rgba {
  const value = input.trim();
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex;
    if (full.length !== 6 && full.length !== 8) throw new Error(`Unsupported colour: ${input}`);
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
    };
  }
  const match = /^rgba?\(([^)]+)\)$/.exec(value);
  if (!match) throw new Error(`Unsupported colour: ${input}`);
  const parts = (match[1] as string).split(',').map((p) => Number(p.trim()));
  const [r, g, b, a = 1] = parts;
  if ([r, g, b, a].some((n) => n === undefined || Number.isNaN(n))) {
    throw new Error(`Unsupported colour: ${input}`);
  }
  return { r: r as number, g: g as number, b: b as number, a };
}

/** Flatten a translucent colour onto an opaque background. */
export function composite(foreground: string, background: string): Rgba {
  const fg = parseColour(foreground);
  const bg = parseColour(background);
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(colour: Rgba): number {
  return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
}

/** Contrast ratio of text on a background, 1 to 21. Translucent text is flattened first. */
export function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(composite(foreground, background));
  const bg = relativeLuminance(parseColour(background));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

export const AA_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;
export const AA_NON_TEXT = 3;
