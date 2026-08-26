import fs from 'node:fs';
import path from 'node:path';
import {
  formatPrice,
  formatPriceDelta,
  multiplyRand,
  pointsToRand,
  randToPoints,
  sumRand,
  PRICE_UNAVAILABLE,
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

  /**
   * This used to assert `R 0.00`, which is the bug rather than the behaviour.
   *
   * Zero is a price. A menu tile reading "R 0.00" is a promise of free food
   * that the bill does not keep — and the way it happens is ordinary: money
   * APIs commonly return decimals as strings, `request<T>` casts rather than
   * validates, and the arithmetic coerces `"129.00"` correctly while
   * `Number.isFinite` does not. Two of that item came to R 258.00 on a
   * checkout screen whose lines both read R 0.00.
   */
  it('shows a dash rather than a price it does not have', () => {
    expect(formatPrice(Number.NaN)).toBe(PRICE_UNAVAILABLE);
    expect(formatPrice(Number.POSITIVE_INFINITY)).toBe(PRICE_UNAVAILABLE);
    expect(formatPrice(undefined as unknown as number)).toBe(PRICE_UNAVAILABLE);
    expect(formatPrice('129.00' as unknown as number)).toBe(PRICE_UNAVAILABLE);
  });

  it('still prices a genuinely free thing at zero', () => {
    // The dash is for "no price", not for "no charge".
    expect(formatPrice(0)).toBe('R 0.00');
  });
});

describe('formatPriceDelta', () => {
  it('shows a dash rather than a surcharge it does not have', () => {
    // Checked before the zero test — a non-number is not equal to 0, so it
    // used to fall through to a sign and render "−R 0.00" as an option's
    // price. An option that says it takes money off is worse than one that
    // says nothing.
    expect(formatPriceDelta(Number.NaN)).toBe(PRICE_UNAVAILABLE);
    expect(formatPriceDelta('20' as unknown as number)).toBe(PRICE_UNAVAILABLE);
  });

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

/**
 * The rule this enforces, and why it needs enforcing.
 *
 * `groupDigits` and the hand-built date formatter both exist because Hermes
 * ships without full ICU on some builds: `Intl` and the `toLocale*` family
 * then silently fall back — a comma where a space belongs, or US month-day
 * ordering where the design says `Fri, 21 Aug`. Neither throws. It renders
 * differently on two phones and nobody reports it.
 *
 * Three separate places drifted back onto `toLocaleString` after the rule was
 * written down: the nutrition panel, and then every points figure in the app,
 * fifteen of them. A comment in one util was not enough.
 */
describe('nothing in the app formats numbers or dates through Intl', () => {
  const root = path.resolve(__dirname, '..');

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sourceFiles(full));
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  /** Comments explain the trap; only executable code can fall into it. */
  const stripComments = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  const offenders: string[] = [];

  for (const file of sourceFiles(path.join(root, 'src'))) {
    const code = stripComments(fs.readFileSync(file, 'utf8'));
    for (const pattern of [
      /\.toLocaleString\s*\(/,
      /\.toLocaleDateString\s*\(/,
      /\.toLocaleTimeString\s*\(/,
      /\bIntl\s*\./,
    ]) {
      if (pattern.test(code)) {
        offenders.push(`${path.relative(root, file)} — ${pattern.source}`);
      }
    }
  }

  it('uses groupDigits and the hand-built date formatters instead', () => {
    expect(offenders).toEqual([]);
  });

  it('is looking at the real source tree, not an empty one', () => {
    // A walker that finds nothing would pass the check above forever.
    expect(sourceFiles(path.join(root, 'src')).length).toBeGreaterThan(50);
  });
});
