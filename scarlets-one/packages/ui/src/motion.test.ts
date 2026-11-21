import { describe, expect, it } from 'vitest';
import { clamp, nearest, project, rubberband, spring } from './motion';

describe('spring', () => {
  it('is critically damped at ratio 1', () => {
    const s = spring(0.4, 1);
    // critical damping: c = 2 * sqrt(k * m)
    expect(s.damping).toBeCloseTo(2 * Math.sqrt(s.stiffness * s.mass), 6);
  });

  it('gets stiffer as response shortens', () => {
    expect(spring(0.2, 1).stiffness).toBeGreaterThan(spring(0.4, 1).stiffness);
  });

  it('under-damps below ratio 1', () => {
    const s = spring(0.3, 0.8);
    expect(s.damping).toBeLessThan(2 * Math.sqrt(s.stiffness));
  });
});

describe('project', () => {
  it('throws a flick about half its velocity forward at the default rate', () => {
    // (1000 / 1000) * 0.998 / 0.002 = 499
    expect(project(1000)).toBeCloseTo(499, 5);
  });

  it('keeps the sign of the gesture', () => {
    expect(project(-800)).toBeLessThan(0);
    expect(project(0)).toBe(0);
  });

  it('travels less with a snappier rate', () => {
    expect(project(1000, 0.99)).toBeLessThan(project(1000, 0.998));
  });
});

describe('rubberband', () => {
  it('follows less the further past the edge', () => {
    const near = rubberband(20, 600);
    const far = rubberband(200, 600);
    expect(near / 20).toBeGreaterThan(far / 200);
  });

  it('never exceeds the raw overshoot and never reaches the dimension', () => {
    for (const overshoot of [1, 50, 400, 5000]) {
      const moved = rubberband(overshoot, 600);
      expect(moved).toBeLessThan(overshoot);
      expect(moved).toBeLessThan(600);
    }
  });

  it('is symmetric', () => {
    expect(rubberband(-80, 600)).toBeCloseTo(-rubberband(80, 600), 8);
  });
});

describe('nearest / clamp', () => {
  it('picks the closest snap point', () => {
    expect(nearest(310, [0, 300, 700])).toBe(300);
    expect(nearest(520, [0, 300, 700])).toBe(700);
  });

  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});
