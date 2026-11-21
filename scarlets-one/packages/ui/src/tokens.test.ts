import { describe, expect, it } from 'vitest';
import { AA_NON_TEXT, AA_TEXT, contrastRatio } from './contrast';
import { darkTheme, lightTheme, type Theme } from './tokens';

/**
 * Every text-on-surface pairing a component is allowed to make, checked in
 * both schemes. A new pairing belongs here before it ships in a screen.
 */
const textPairs = (t: Theme): [string, string, string][] => [
  ['text on bg', t.text, t.bg],
  ['text on surface', t.text, t.surface],
  ['text on surfaceMuted', t.text, t.surfaceMuted],
  ['secondary on bg', t.textSecondary, t.bg],
  ['secondary on surface', t.textSecondary, t.surface],
  ['secondary on surfaceMuted', t.textSecondary, t.surfaceMuted],
  ['accentText on bg', t.accentText, t.bg],
  ['accentText on surface', t.accentText, t.surface],
  ['accentText on surfaceMuted', t.accentText, t.surfaceMuted],
  ['onAccent on accent', t.onAccent, t.accent],
  ['onAccent on accentPressed', t.onAccent, t.accentPressed],
  ['onInverse on inverse', t.onInverse, t.inverse],
  ['onInverse on inverseRaised', t.onInverse, t.inverseRaised],
  ['onInverseMuted on inverse', t.onInverseMuted, t.inverse],
  ['onInverseMuted on inverseRaised', t.onInverseMuted, t.inverseRaised],
  ['accentOnInverse on inverse', t.accentOnInverse, t.inverse],
  ['goldOnInverse on inverse', t.goldOnInverse, t.inverse],
  ['goldText on bg', t.goldText, t.bg],
  ['goldText on surface', t.goldText, t.surface],
  ['success on surface', t.success, t.surface],
  ['success on bg', t.success, t.bg],
  ['warning on surface', t.warning, t.surface],
  ['warning on bg', t.warning, t.bg],
  ['text on solid material', t.text, t.materialSolid],
];

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('%s theme', (_name, theme) => {
  it.each(textPairs(theme))('%s meets WCAG AA for text', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('accent fill is distinguishable from the page and card', () => {
    expect(contrastRatio(theme.accent, theme.bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(theme.accent, theme.surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});
