import { project, rubberband, springConfig, nearestSnap } from '@/design/motion';
import { dark, light, type Palette } from '@/design/tokens';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe.each([
  ['light', light],
  ['dark', dark],
] as [string, Palette][])('%s palette', (_, p) => {
  const text = ['ink', 'ink2', 'ink3', 'green', 'rust', 'cobalt'] as const;
  it.each(text)('%s meets WCAG AA (4.5:1) on paper and card', (key) => {
    expect(contrast(p[key], p.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p[key], p.card)).toBeGreaterThanOrEqual(4.5);
  });
  it('ochre text meets AA on paper and card; status text meets AA on its tint', () => {
    expect(contrast(p.ochre, p.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.green, p.greenSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.rust, p.rustSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.cobalt, p.cobaltSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.onInk, p.ink)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('motion', () => {
  it('maps Apple damping/response to physics exactly', () => {
    const c = springConfig({ damping: 1, response: 0.5 });
    const omega = (2 * Math.PI) / 0.5;
    expect(c.stiffness).toBeCloseTo(omega * omega);
    // Critically damped: c = 2·√k (unit mass).
    expect(c.damping).toBeCloseTo(2 * Math.sqrt(c.stiffness!));
  });

  it('projects momentum with Apple’s deceleration formula', () => {
    expect(project(1000, 0.998)).toBeCloseTo(499);
    expect(project(-1000, 0.99)).toBeCloseTo(-99);
  });

  it('rubber-bands progressively and never past the dimension', () => {
    const a = rubberband(100, 400);
    const b = rubberband(200, 400);
    expect(a).toBeLessThan(100);
    expect(b - a).toBeLessThan(a);
    expect(rubberband(100000, 400)).toBeLessThan(400);
    expect(rubberband(-100, 400)).toBeCloseTo(-a);
  });

  it('snaps to where a flick is heading, not where it let go', () => {
    expect(nearestSnap(100, 0, [0, 600])).toBe(0);
    expect(nearestSnap(100, 3000, [0, 600])).toBe(600);
  });
});
