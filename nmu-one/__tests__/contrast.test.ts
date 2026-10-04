import { colors } from '@/design/tokens';

/** WCAG relative luminance and contrast ratio. */
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
};

/** Every text-on-surface pairing the design system uses (brief §20, WCAG 2.2 AA). */
const PAIRS: [string, string, string][] = [
  ['primary text on canvas', colors.textPrimary, colors.background],
  ['primary text on cards', colors.textPrimary, colors.surface],
  ['secondary text on canvas', colors.textSecondary, colors.background],
  ['secondary text on cards', colors.textSecondary, colors.surface],
  ['white on navy', colors.white, colors.navy],
  ['muted on navy', colors.textOnDarkMuted, colors.navy],
  ['yellow on navy', colors.yellow, colors.navy],
  ['navy on yellow', colors.navy, colors.yellow],
  ['white on secondary navy', colors.white, colors.navy2],
  ['success on its tint', colors.success, colors.successSoft],
  ['warning on its tint', colors.warning, colors.warningSoft],
  ['danger on its tint', colors.danger, colors.dangerSoft],
  ['info on its tint', colors.info, colors.infoSoft],
  ['white on danger', colors.white, colors.danger],
];

describe('colour contrast', () => {
  it.each(PAIRS)('%s meets 4.5:1', (_name, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('never uses yellow as text on a light surface', () => {
    expect(ratio(colors.yellow, colors.surface)).toBeLessThan(3);
  });
});
