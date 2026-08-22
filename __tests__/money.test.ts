import {
  formatPrice,
  formatPriceDelta,
  multiplyRand,
  pointsToRand,
  randToPoints,
  sumRand,
} from '@/utils/money';

describe('formatPrice', () => {
  it('formats rand with two decimals and a space separator', () => {
    expect(formatPrice(129.9)).toBe('R 129.90');
    expect(formatPrice(45)).toBe('R 45.00');
    expect(formatPrice(0)).toBe('R 0.00');
  });

  it('groups thousands', () => {
    expect(formatPrice(1234.5)).toBe('R 1 234.50');
    expect(formatPrice(1234567.89)).toBe('R 1 234 567.89');
  });

  it('keeps the minus outside the currency symbol', () => {
    expect(formatPrice(-50)).toBe('-R 50.00');
  });

  it('falls back to zero for non-finite input', () => {
    expect(formatPrice(Number.NaN)).toBe('R 0.00');
    expect(formatPrice(Number.POSITIVE_INFINITY)).toBe('R 0.00');
  });
});

describe('formatPriceDelta', () => {
  it('labels a zero delta as free', () => {
    expect(formatPriceDelta(0)).toBe('Free');
  });

  it('signs positive and negative deltas', () => {
    expect(formatPriceDelta(20)).toBe('+R 20.00');
    expect(formatPriceDelta(-5)).toBe('−R 5.00');
  });
});

describe('rand arithmetic', () => {
  it('sums without floating point drift', () => {
    expect(sumRand([0.1, 0.2])).toBe(0.3);
    expect(sumRand([149, 60, 18, 18])).toBe(245);
  });

  it('multiplies without drift', () => {
    expect(multiplyRand(0.1, 3)).toBe(0.3);
    expect(multiplyRand(225, 4)).toBe(900);
  });
});

describe('points conversion', () => {
  it('converts rand to whole points', () => {
    expect(randToPoints(287)).toBe(287);
    expect(randToPoints(287.9)).toBe(287);
  });

  it('converts points back to rand at the configured rate', () => {
    expect(pointsToRand(1000)).toBe(50);
    expect(pointsToRand(400)).toBe(20);
  });
});
