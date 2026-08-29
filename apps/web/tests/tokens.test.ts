import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BLACK_TINTS, BRAND, NEUTRAL_TINTS, RED_DEEP, RED_TINTS } from '@bbq/ui/tokens';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(
  path.resolve(__dirname, '../../../packages/ui/src/tokens.css'),
  'utf8',
);

/** Reads one custom property out of the CSS token file. */
function cssToken(name: string): string | null {
  const match = CSS.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  return match?.[1]?.toUpperCase() ?? null;
}

describe('token parity', () => {
  it('keeps the CSS and the TypeScript palette in step', () => {
    // Two token files exist because CSS cannot import JSON. This is the test
    // that stops them drifting apart.
    expect(cssToken('red')).toBe(BRAND.red.toUpperCase());
    expect(cssToken('black')).toBe(BRAND.black.toUpperCase());
    expect(cssToken('white')).toBe(BRAND.white.toUpperCase());
    expect(cssToken('yellow')).toBe(BRAND.yellow.toUpperCase());
    expect(cssToken('gold')).toBe(BRAND.gold.toUpperCase());
    expect(cssToken('red-deep')).toBe(RED_DEEP.toUpperCase());
  });

  it('keeps every tint on both ladders in step', () => {
    for (const step of ['80', '60', '40', '20', '10'] as const) {
      expect(cssToken(`red-${step}`)).toBe(RED_TINTS[step].toUpperCase());
      expect(cssToken(`black-${step}`)).toBe(BLACK_TINTS[step].toUpperCase());
      expect(cssToken(`neutral-${step}`)).toBe(NEUTRAL_TINTS[step].toUpperCase());
    }
  });
});

describe('approved palette', () => {
  it('uses the approved red, not the superseded one', () => {
    expect(BRAND.red.toUpperCase()).toBe('#E31937');
  });

  it('starts each ladder at its full-strength colour', () => {
    expect(RED_TINTS[100].toUpperCase()).toBe(BRAND.red.toUpperCase());
    expect(BLACK_TINTS[100].toUpperCase()).toBe(BRAND.black.toUpperCase());
  });

  it('runs every ladder at the approved 100 to 10 steps', () => {
    // Compared as a set: integer-like keys enumerate numerically, so the order
    // they come back in says nothing about the ladder.
    const steps = [10, 20, 40, 60, 80, 100];
    for (const ladder of [RED_TINTS, BLACK_TINTS, NEUTRAL_TINTS]) {
      expect(Object.keys(ladder).map(Number).sort((a, b) => a - b)).toEqual(steps);
    }
  });

  it('writes every value as a six-digit hex', () => {
    const values = [
      ...Object.values(BRAND),
      ...Object.values(RED_TINTS),
      ...Object.values(BLACK_TINTS),
      ...Object.values(NEUTRAL_TINTS),
      RED_DEEP,
    ];
    for (const value of values) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
