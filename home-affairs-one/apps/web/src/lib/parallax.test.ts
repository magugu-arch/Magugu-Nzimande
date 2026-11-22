import { describe, expect, it } from 'vitest';
import { parallaxValue } from './parallax';

describe('parallaxValue', () => {
  const viewport = 800;
  const height = 400;

  it('is −1 as the frame enters at the bottom of the screen', () => {
    expect(parallaxValue(viewport + height, height, viewport)).toBe(-1);
  });

  it('is 0 when the frame is centred', () => {
    expect(parallaxValue(viewport / 2 + height / 2, height, viewport)).toBeCloseTo(0);
  });

  it('is 1 as the frame leaves at the top', () => {
    expect(parallaxValue(0, height, viewport)).toBe(1);
  });

  it('never goes past either end, and survives a frame with no size', () => {
    expect(parallaxValue(5000, height, viewport)).toBe(-1);
    expect(parallaxValue(-5000, height, viewport)).toBe(1);
    expect(parallaxValue(0, 0, 0)).toBe(0);
  });
});
