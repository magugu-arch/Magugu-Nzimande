import { describe, expect, it } from 'vitest';
import {
  brand,
  color,
  contrastRatio,
  projectMomentum,
  rubberband,
  spring,
  textStyle,
  toPhysicalSpring,
  trackingPx,
} from '../src';
import { tokensAsCss } from '../src/css';

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe('colour tokens', () => {
  it('keeps the five proposed brand values from the brief', () => {
    expect(brand).toEqual({
      gold: '#E0B43C',
      black: '#101010',
      charcoal: '#242424',
      ivory: '#F5F0E4',
      mutedGold: '#A9822B',
    });
  });

  const darkSurfaces = ['bg', 'bgRaised', 'surface', 'surfaceHigh'] as const;
  const bodyText = ['text', 'textSecondary', 'textTertiary'] as const;

  for (const surface of darkSurfaces) {
    for (const fg of bodyText) {
      it(`${fg} on ${surface} meets WCAG AA for body text`, () => {
        expect(contrastRatio(color[fg], color[surface])).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
    it(`gold accent on ${surface} meets AA for text`, () => {
      expect(contrastRatio(color.accent, color[surface])).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }

  it('text on a gold button meets AA', () => {
    expect(contrastRatio(color.onAccent, color.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('inverse text on ivory reading surfaces meets AA', () => {
    expect(contrastRatio(color.textInverse, color.surfaceInverse)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(color.textInverseSecondary, color.surfaceInverse)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it('DEMO labels are high contrast and not gold', () => {
    expect(contrastRatio(color.demoText, color.demoBg)).toBeGreaterThanOrEqual(7);
    expect(color.demoBg).not.toBe(color.accent);
  });

  it('muted gold is only strong enough for non-text details', () => {
    expect(contrastRatio(color.accentMuted, color.bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('live and danger states are legible on the background', () => {
    expect(contrastRatio(color.live, color.bg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(color.success, color.bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('type tokens', () => {
  it('tightens large type and opens small type', () => {
    expect(textStyle.title1.tracking).toBeLessThan(0);
    expect(textStyle.body.tracking).toBe(0);
    expect(textStyle.footnote.tracking).toBeGreaterThan(0);
  });

  it('sets large type with tighter leading than body copy', () => {
    expect(textStyle.hero.leading).toBeLessThan(textStyle.title1.leading);
    expect(textStyle.title1.leading).toBeLessThan(textStyle.body.leading);
  });

  it('uses tabular figures wherever numbers are compared', () => {
    expect(textStyle.score.tabular).toBe(true);
    expect(textStyle.data.tabular).toBe(true);
  });

  it('converts em tracking to px', () => {
    expect(trackingPx(textStyle.eyebrow)).toBeCloseTo(1.92);
  });
});

describe('motion tokens', () => {
  it('defaults to critically damped springs', () => {
    expect(spring.standard.dampingRatio).toBe(1);
    expect(spring.snappy.dampingRatio).toBe(1);
  });

  it('converts damping ratio and response to physical parameters', () => {
    const p = toPhysicalSpring({ dampingRatio: 1, response: 0.4 });
    // Critically damped: damping² = 4·mass·stiffness
    expect(p.damping ** 2).toBeCloseTo(4 * p.stiffness, 0);
  });

  it('projects momentum like scroll deceleration', () => {
    expect(projectMomentum(0)).toBe(0);
    expect(projectMomentum(1000)).toBeCloseTo(499, 0);
  });

  it('rubber-bands progressively', () => {
    const a = rubberband(50, 400);
    const b = rubberband(200, 400);
    expect(a).toBeLessThan(50);
    expect(b - a).toBeLessThan(150);
  });
});

describe('css export', () => {
  it('emits custom properties from the same tokens', () => {
    const css = tokensAsCss();
    expect(css).toContain('--kc-color-accent: #E0B43C;');
    expect(css).toContain('--kc-space-lg: 16px;');
  });
});
