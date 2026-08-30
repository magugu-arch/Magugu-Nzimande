import fs from 'node:fs';
import path from 'node:path';
import { colors } from '@/theme';
import { tints } from '@/theme/colors';
import { AA_LARGE, AA_NORMAL, contrastRatio, luminance, meetsAA, parseHex } from '@/utils/contrast';

describe('contrast maths', () => {
  it('matches the ratios the guidelines publish', () => {
    // §32.3 prints these two as its worked examples.
    expect(contrastRatio(colors.brand.black, colors.neutral.white)).toBeCloseTo(16.5, 1);
    expect(contrastRatio(colors.neutral.white, colors.brand.red)).toBeCloseTo(4.7, 1);
  });

  it('is symmetric and bounded', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('expands three-digit hex', () => {
    expect(parseHex('#E31937')).toEqual([227, 25, 55]);
    expect(parseHex('#FFF')).toEqual([255, 255, 255]);
    expect(luminance('#000000')).toBe(0);
  });

  it('refuses anything that is not a hex colour', () => {
    expect(() => parseHex('rgba(0,0,0,0.5)')).toThrow();
    expect(() => parseHex('#GGGGGG')).toThrow();
  });
});

/**
 * §32.3: normal text 4.5:1, large text (24px+) 3:1.
 *
 * Every pair below is one the app actually renders. Adding a colour to the
 * theme without adding it here is fine; changing one so it stops clearing its
 * threshold is what this catches.
 */
describe('theme colour pairs meet §32.3', () => {
  const normal: [string, string, string][] = [
    ['body text on white', colors.textPrimary, colors.background],
    ['secondary text on white', colors.textSecondary, colors.background],
    ['muted text on white', colors.textMuted, colors.background],
    ['body text on light grey', colors.textPrimary, colors.surfaceAlt],
    ['white on bb.q Red', colors.onPrimary, colors.primary],
    ['white on red hover', colors.onPrimary, colors.primaryHover],
    ['white on red pressed', colors.onPrimary, colors.primaryPressed],
    ['white on bb.q Black', colors.textOnDark, colors.surfaceDark],
    ['red on white', colors.primary, colors.background],
    ['disabled primary label on its fill', colors.primaryPressed, colors.brand.redDisabled],
    ['success on its tint', colors.status.success, colors.status.successSoft],
    ['error on its tint', colors.status.error, colors.status.errorSoft],
    ['info on its tint', colors.status.info, colors.status.infoSoft],
    ['warning on its tint', colors.status.warning, colors.status.warningSoft],
    ['success on white', colors.status.success, colors.background],
    ['warning on white', colors.status.warning, colors.background],
    ['error on white', colors.status.error, colors.background],
    ['info on white', colors.status.info, colors.background],
  ];

  it.each(normal)('%s clears 4.5:1', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  // Inactive controls are exempt from WCAG 1.4.3, but §32.3 still prints light
  // grey on white as a failure, so disabled text is held to the 3:1 bar.
  const large: [string, string, string][] = [
    ['disabled text on white', colors.textDisabled, colors.background],
  ];

  it.each(large)('%s clears 3:1', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('never pairs white with the disabled primary fill', () => {
    // The combination §22.9 scores 2.1:1 and marks Fail.
    expect(meetsAA(colors.onPrimary, colors.brand.redDisabled)).toBe(false);
  });
});

/**
 * §22.7: do not use all caps for long button text.
 *
 * This checks the readability half of that rule — a long sentence in caps
 * reads as shouting — and nothing more. Whether a label physically *fits* is a
 * different question that character count cannot answer: a 20-character label
 * clears the small button and overflows the medium one, because the two have
 * different padding. `npm run assets:typefit` settles that by measuring the
 * bundled Montserrat against §22.4's geometry, and the last test here makes
 * sure that check stays wired into CI.
 */
describe('button labels obey §22.7', () => {
  const MAX_UPPERCASE = 21;

  function buttons() {
    const found: { file: string; line: number; label: string; preserved: boolean }[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.tsx')) {
          const source = fs.readFileSync(full, 'utf8');
          for (const match of source.matchAll(/<Button\b[\s\S]{0,600}?\/>/g)) {
            const tag = match[0];
            const label = /label="([^"]*)"/.exec(tag);
            if (!label?.[1]) continue;
            found.push({
              file: path.relative(process.cwd(), full),
              line: source.slice(0, match.index).split('\n').length,
              label: label[1],
              preserved: tag.includes('preserveCase'),
            });
          }
        }
      }
    };
    walk(path.resolve(__dirname, '..', 'src'));
    return found;
  }

  it('finds the buttons to check', () => {
    expect(buttons().length).toBeGreaterThan(30);
  });

  it('has no long label left to be uppercased', () => {
    const offenders = buttons()
      .filter((b) => !b.preserved && b.label.length > MAX_UPPERCASE)
      .map((b) => `${b.file}:${b.line} "${b.label}" (${b.label.length} chars)`);

    expect(offenders).toEqual([]);
  });

  // The fit check lives in a script because it needs to measure the real font
  // file. That makes it easy to drop from CI without anyone noticing, so the
  // wiring is asserted here.
  it('keeps the width audit wired into CI', () => {
    const workflow = fs.readFileSync(
      path.resolve(__dirname, '..', '.github', 'workflows', 'verify.yml'),
      'utf8',
    );
    expect(workflow).toContain('npm run assets:typefit');

    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts['assets:typefit']).toBe('node scripts/audit-type-fit.mjs');
  });
});

/**
 * §8.2's tint ramps.
 *
 * The ramp is computed rather than sampled, because the supplied guideline
 * page is not colour-faithful — its own §8.1 swatches miss their printed hex
 * values. Computing it makes the arithmetic checkable, which is what this
 * does: the endpoints must be the §8.1 brand colours and pure-white-adjacent,
 * the steps must descend in saturation, and one middle value is pinned by hand
 * so a change to the mixing maths cannot pass silently.
 */
describe('§8.2 colour tints', () => {
  const STEPS = [100, 80, 60, 40, 20, 10] as const;

  it('starts each ramp at the §8.1 brand colour', () => {
    expect(tints.red[100]).toBe(colors.brand.red);
    expect(tints.black[100]).toBe(colors.brand.black);
  });

  it.each(['red', 'black'] as const)('%s lightens monotonically toward white', (ramp) => {
    const levels = STEPS.map((step) => luminance(tints[ramp][step]));
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]).toBeGreaterThan(levels[i - 1] as number);
    }
  });

  it('mixes over white, not over black or by alpha alone', () => {
    // bb.q Red at 20%: 0.2 x 227 + 0.8 x 255 = 249.4 -> F9, and so on.
    expect(tints.red[20]).toBe('#F9D1D7');
    // bb.q Black at 40%: 0.4 x 34 + 0.6 x 255 = 166.6 -> A7, and so on.
    expect(tints.black[40]).toBe('#A7A5A5');
  });

  it('leaves the 10% step light enough to carry body text', () => {
    // The tints exist to be surfaces. One that cannot hold text is not useful.
    expect(contrastRatio(colors.textPrimary, tints.red[10])).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrastRatio(colors.textPrimary, tints.black[10])).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});
