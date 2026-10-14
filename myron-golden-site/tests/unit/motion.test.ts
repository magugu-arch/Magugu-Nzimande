import { describe, expect, it } from 'vitest';
import {
  landingIndex,
  project,
  pushSample,
  rubberband,
  shouldDismiss,
  velocityFromSamples,
} from '@/lib/motion';

describe('project', () => {
  it('matches the exponential-decay projection Apple ships', () => {
    // (1000/1000) * 0.998 / 0.002 = 499
    expect(project(1000)).toBeCloseTo(499, 6);
    expect(project(-1000)).toBeCloseTo(-499, 6);
    expect(project(0)).toBe(0);
  });

  it('travels less with a snappier deceleration rate', () => {
    expect(Math.abs(project(1000, 0.99))).toBeLessThan(Math.abs(project(1000, 0.998)));
  });
});

describe('rubberband', () => {
  it('resists more the further past the edge', () => {
    const a = rubberband(50, 400);
    const b = rubberband(100, 400);
    const c = rubberband(400, 400);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b - a).toBeLessThan(a); // diminishing returns
    expect(c).toBeLessThan(400);
  });

  it('keeps the sign of the overshoot and is zero at the edge', () => {
    expect(rubberband(-80, 400)).toBeLessThan(0);
    expect(rubberband(0, 400)).toBe(0);
    expect(rubberband(10, 0)).toBe(0);
  });
});

describe('velocityFromSamples', () => {
  it('measures px/s over the recent window', () => {
    const samples = [
      { t: 0, v: 0 },
      { t: 50, v: 50 },
      { t: 100, v: 100 },
    ];
    expect(velocityFromSamples(samples)).toBeCloseTo(1000, 6);
  });

  it('reads a pause before release as no velocity', () => {
    const samples = [
      { t: 0, v: 0 },
      { t: 16, v: 40 },
      { t: 300, v: 40 },
    ];
    expect(velocityFromSamples(samples)).toBe(0);
  });

  it('needs two samples', () => {
    expect(velocityFromSamples([{ t: 0, v: 10 }])).toBe(0);
  });

  it('keeps the history bounded', () => {
    let s = [{ t: 0, v: 0 }];
    for (let i = 1; i < 50; i++) s = pushSample(s, { t: i, v: i });
    expect(s).toHaveLength(8);
    expect(s.at(-1)).toEqual({ t: 49, v: 49 });
  });
});

describe('landingIndex', () => {
  const base = { width: 400, count: 5 };

  it('snaps back on a short, slow drag', () => {
    expect(landingIndex({ ...base, startIndex: 2, offset: -2 * 400 - 60, velocity: 0 })).toBe(2);
  });

  it('advances on a flick even when the drag was short', () => {
    expect(landingIndex({ ...base, startIndex: 2, offset: -2 * 400 - 30, velocity: -800 })).toBe(3);
    expect(landingIndex({ ...base, startIndex: 2, offset: -2 * 400 + 30, velocity: 800 })).toBe(1);
  });

  it('moves at most one page per gesture', () => {
    expect(landingIndex({ ...base, startIndex: 1, offset: -400, velocity: -9000 })).toBe(2);
  });

  it('never leaves the ends', () => {
    expect(landingIndex({ ...base, startIndex: 0, offset: 80, velocity: 3000 })).toBe(0);
    expect(landingIndex({ ...base, startIndex: 4, offset: -1700, velocity: -3000 })).toBe(4);
  });
});

describe('shouldDismiss', () => {
  it('dismisses a short fast flick', () => {
    expect(shouldDismiss({ offset: 40, velocity: 900, distance: 400 })).toBe(true);
  });

  it('keeps a slow drag that is let go before halfway', () => {
    expect(shouldDismiss({ offset: 120, velocity: 50, distance: 400 })).toBe(false);
  });

  it('treats moving back towards the origin as a no', () => {
    expect(shouldDismiss({ offset: 260, velocity: -400, distance: 400 })).toBe(false);
  });
});
