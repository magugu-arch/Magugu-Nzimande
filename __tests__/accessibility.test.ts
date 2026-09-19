import fs from 'node:fs';
import path from 'node:path';
import { colors } from '@/theme';
import { AA_LARGE, AA_NORMAL, contrastRatio, luminance, meetsAA, parseHex } from '@/utils/contrast';

/** HSL hue in degrees and saturation in 0–1, for the signal-red rule below. */
function hueSaturation(hex: string): [number, number] {
  const [r, g, b] = parseHex(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return [0, 0];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  return [hue < 0 ? hue + 360 : hue, saturation];
}

describe('contrast maths', () => {
  it('measures the two pairs brief §13 singles out by name', () => {
    // "WCAG-aware contrast, especially gold on beige and blue on beige."
    //
    // Both are worth a number rather than an assumption, and they come out
    // very differently: the blue pair is comfortable, the gold pair is the
    // reason gold is not allowed to carry text anywhere in this app.
    expect(contrastRatio(colors.brand.aegean, colors.brand.stone)).toBeGreaterThan(7);
    expect(contrastRatio(colors.brand.gold, colors.brand.stone)).toBeLessThan(2);
  });

  it('is symmetric and bounded', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('expands three-digit hex', () => {
    expect(parseHex('#2E4A2F')).toEqual([46, 74, 47]);
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
    ['body text on the stone ground', colors.textPrimary, colors.background],
    ['secondary text on the stone ground', colors.textSecondary, colors.background],
    ['muted text on the stone ground', colors.textMuted, colors.background],
    ['body text on a white card', colors.textPrimary, colors.surface],
    ['muted text on a white card', colors.textMuted, colors.surface],
    ['body text on stone beige', colors.textPrimary, colors.surfaceSunken],
    ['white on olive', colors.onPrimary, colors.primary],
    ['white on olive pressed', colors.onPrimary, colors.primaryPressed],
    ['white on aegean', colors.onSecondary, colors.secondary],
    ['white on charcoal', colors.textOnDark, colors.surfaceDark],
    ['olive on the stone ground', colors.primary, colors.background],
    ['aegean link on the stone ground', colors.textLink, colors.background],
    ['aegean link on a white card', colors.textLink, colors.surface],
    // Gold is a fill behind charcoal, never an ink on a light ground.
    ['charcoal on gold', colors.onAccent, colors.accent],
    ['the darkened gold ink on its own wash', colors.accentInk, colors.accentSoft],
    ['the darkened gold ink on a white card', colors.accentInk, colors.surface],
    ['the darkened terracotta ink on its wash', colors.warmInk, colors.warmSoft],
    ['the darkened terracotta ink on a white card', colors.warmInk, colors.surface],
    ['disabled primary label on its fill', colors.primaryPressed, colors.primaryDisabled],
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
    expect(meetsAA(colors.onPrimary, colors.primaryDisabled)).toBe(false);
  });

  /**
   * The rule the whole palette turns on.
   *
   * Sunset Gold is the colour that reads as "premium" at a glance, which is
   * exactly why it keeps getting reached for as an ink. It cannot be one on a
   * light ground: 2.0:1 on white, 1.7:1 on stone. §13 names this pair. The
   * app uses gold as a fill behind charcoal, as a rule and as a small mark
   * beside a worded label — never as small text on a light background, and
   * never as a primary CTA.
   */
  it('refuses gold as an ink on any light ground', () => {
    expect(meetsAA(colors.accent, colors.surface)).toBe(false);
    expect(meetsAA(colors.accent, colors.background)).toBe(false);
    expect(meetsAA(colors.accent, colors.surfaceSunken)).toBe(false);
  });

  it('keeps a darkened gold available for the one place an ink is needed', () => {
    // Having both means the correct token is available rather than the
    // convenient one being reused.
    expect(meetsAA(colors.accentInk, colors.surface)).toBe(true);
  });

  /**
   * §15's first guardrail: no oversized red CTAs, no fast-food UI.
   *
   * The Pappas palette has no signal red, and this catches one creeping back
   * in as a brand or accent colour — which is how a hospitality app slowly
   * becomes a delivery app.
   *
   * What separates a signal red from Terracotta is *saturation*, not hue.
   * Terracotta sits at hue 16° and 52% saturation: a muted earth tone, and one
   * the CI sheet names. The red this rule is about sits near hue 351° at 80%.
   * So the test measures both, and a colour is only a signal red if it is both
   * red-hued and loud. Charcoal is hue 0° with zero saturation and must not
   * trip it either, which a hue-only rule would get wrong.
   */
  it('admits no signal red into the brand palette', () => {
    for (const [name, value] of Object.entries(colors.brand)) {
      const [hue, saturation] = hueSaturation(value);
      const redHued = hue >= 345 || hue <= 15;
      expect([name, redHued && saturation >= 0.6]).toEqual([name, false]);
    }
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
 * The wash tokens.
 *
 * Each brand colour has a pale companion used as a surface — a selected row,
 * a chip fill, the ground behind a status message. They exist to be
 * *backgrounds*, and a background that cannot hold body text is not a
 * background, it is a decoration that will one day have text put on it.
 *
 * The bb.q palette this replaced carried a computed tint ramp at six steps.
 * The Pappas CI sheet publishes no such ramp — panel 03 names six flat
 * values and panel 07 handles softness with texture instead — so the washes
 * are chosen rather than derived, and the invariant worth keeping is not the
 * arithmetic but the outcome: every one of them reads.
 */
describe('the wash surfaces can carry text', () => {
  const washes: [string, string][] = [
    ['olive wash', colors.brand.oliveWash],
    ['aegean wash', colors.brand.aegeanWash],
    ['gold wash', colors.brand.goldWash],
    ['terracotta wash', colors.brand.terracottaWash],
    ['stone beige', colors.brand.stone],
    ['stone light', colors.brand.stoneLight],
  ];

  it.each(washes)('%s holds body text at 4.5:1', (_name, wash) => {
    expect(contrastRatio(colors.textPrimary, wash)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it.each(washes)('%s also holds muted text', (_name, wash) => {
    // The likelier real use: a caption under a heading inside a filled card.
    expect(contrastRatio(colors.textMuted, wash)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('keeps each wash lighter than the colour it belongs to', () => {
    const pairs: [string, string][] = [
      [colors.brand.olive, colors.brand.oliveWash],
      [colors.brand.aegean, colors.brand.aegeanWash],
      [colors.brand.gold, colors.brand.goldWash],
      [colors.brand.terracotta, colors.brand.terracottaWash],
    ];
    for (const [base, wash] of pairs) {
      expect(luminance(wash)).toBeGreaterThan(luminance(base));
    }
  });
});
