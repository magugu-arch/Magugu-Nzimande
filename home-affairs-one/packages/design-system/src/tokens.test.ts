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

  // WCAG 2.2 AA: 4.5:1 for body text. The theme is dark: ivory and tinted type on ink.
  const AA = 4.5;
  const pairs: Array<[string, string, string]> = [
    ['body text on page', '--ink-900', '--page'],
    ['body text on a card', '--ink-900', '--surface'],
    ['muted text on a card', '--ink-600', '--surface'],
    ['muted text on sunken surface', '--ink-600', '--surface-sunken'],
    ['muted text on raised surface', '--ink-600', '--navy-50'],
    ['muted text on a brand band', '--ink-600', '--navy-900'],
    ['link on a card', '--text-accent', '--surface'],
    ['error text on error tint', '--text-danger', '--red-50'],
    ['success tag text', '--text-success', '--green-50'],
    ['attention tag text', '--text-accent', '--gold-100'],
    ['info tag text', '--text-info', '--blue-50'],
    ['teal tag text', '--text-teal', '--teal-50'],
    ['label on the gold button', '--on-accent', '--gold-500'],
    ['label on the hovered gold button', '--on-accent', '--gold-400'],
    ['label on the ivory button', '--on-accent', '--ink-900'],
  ];
  it.each(pairs)('%s meets AA contrast', (_label, foreground, background) => {
    const fg = cssVar(foreground);
    const bg = cssVar(background);
    expect(fg && bg).toBeTruthy();
    expect(contrastRatio(fg as string, bg as string)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps white text readable on every solid fill', () => {
    for (const token of ['--blue-600', '--blue-700', '--navy-900', '--red-600', '--green-600']) {
      expect(contrastRatio('#ffffff', cssVar(token) as string)).toBeGreaterThanOrEqual(AA);
    }
  });

  it('uses warm gold as an accent on ink, where it is readable — never on paper', () => {
    expect(contrastRatio(brandColors.warmGold, cssVar('--page') as string)).toBeGreaterThanOrEqual(
      AA,
    );
    expect(contrastRatio(brandColors.warmGold, '#ffffff')).toBeLessThan(3);
  });

  // WCAG 1.4.11: the edge of a form control needs 3:1 against what it sits on.
  it('draws form-control borders at 3:1 or better', () => {
    for (const surface of ['--surface', '--surface-sunken', '--page']) {
      expect(
        contrastRatio(cssVar('--line-strong') as string, cssVar(surface) as string),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('is square: every radius token is zero', () => {
    for (const token of ['sm', 'md', 'lg', 'pill', 'arch']) {
      expect(css).toMatch(new RegExp(`--radius-${token}:\\s*0;`));
    }
  });
});
