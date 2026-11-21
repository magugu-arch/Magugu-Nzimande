import { readFileSync } from 'node:fs';
import path from 'node:path';
import { contrastRatio } from '@hao/accessibility';
import { describe, expect, it } from 'vitest';
import { brandColorVar, brandColors } from './tokens';

const css = readFileSync(path.join(import.meta.dirname, 'tokens.css'), 'utf8');
const cssVar = (name: string) =>
  css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();

describe('design tokens', () => {
  it('keeps tokens.ts in step with tokens.css for every brand colour', () => {
    for (const [name, hex] of Object.entries(brandColors)) {
      expect(cssVar(brandColorVar[name as keyof typeof brandColors])).toBe(hex);
    }
  });

  it('uses the palette proposed in the brief', () => {
    expect(brandColors).toMatchObject({
      midnightNavy: '#102a43',
      actionBlue: '#1261a0',
      teal: '#0f766e',
      successGreen: '#1a7f5a',
      warmGold: '#d5a52a',
      surface: '#f2f6f9',
      errorRed: '#c83b3b',
    });
  });

  // WCAG 2.2 AA: 4.5:1 for body text.
  const AA = 4.5;
  const pairs: Array<[string, string, string]> = [
    ['body text on page', '--ink-900', '--page'],
    ['muted text on white', '--ink-600', '--surface'],
    ['muted text on sunken surface', '--ink-600', '--surface-sunken'],
    ['link on white', '--blue-600', '--surface'],
    ['error text on error tint', '--red-700', '--red-50'],
    ['success tag text', '--green-700', '--green-50'],
    ['attention tag text', '--gold-700', '--gold-100'],
    ['info tag text', '--blue-700', '--blue-50'],
    ['teal tag text', '--teal-700', '--teal-50'],
  ];
  it.each(pairs)('%s meets AA contrast', (_label, foreground, background) => {
    const fg = cssVar(foreground);
    const bg = cssVar(background);
    expect(fg && bg).toBeTruthy();
    expect(contrastRatio(fg as string, bg as string)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps white text readable on every solid button colour', () => {
    for (const token of ['--blue-600', '--blue-700', '--navy-900', '--red-600', '--green-600']) {
      expect(contrastRatio('#ffffff', cssVar(token) as string)).toBeGreaterThanOrEqual(AA);
    }
  });

  it('never uses warm gold as a text colour on white (decoration only)', () => {
    expect(contrastRatio(brandColors.warmGold, '#ffffff')).toBeLessThan(3);
  });
});
