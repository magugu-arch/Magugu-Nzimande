import { businessRules } from '@/constants/config';

/**
 * Money helpers. Prices are stored as rand with at most two decimals; all
 * arithmetic rounds to cents so floating point never leaks into a total.
 */

/** Round to whole cents. */
export function toCents(rand: number): number {
  return Math.round(rand * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Add a list of rand amounts without accumulating float error. */
export function sumRand(values: number[]): number {
  return fromCents(values.reduce((total, value) => total + toCents(value), 0));
}

export function multiplyRand(value: number, quantity: number): number {
  return fromCents(toCents(value) * quantity);
}

/**
 * Thousands grouped South African style, with a space.
 *
 * Done by hand rather than through `Intl`: Hermes ships without full ICU on
 * some builds, and `toLocaleString('en-ZA')` then silently falls back to a
 * comma or to no grouping at all. A price that renders differently on two
 * phones is the kind of bug nobody reports and everybody notices.
 */
export function groupDigits(value: number): string {
  return String(Math.trunc(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** `R 129.90` — the South African convention used across the app. */
export function formatPrice(rand: number): string {
  const safe = Number.isFinite(rand) ? rand : 0;
  const fixed = Math.abs(safe).toFixed(2);
  const [whole = '0', decimals = '00'] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = safe < 0 ? '-' : '';
  return `${sign}${businessRules.currencySymbol} ${grouped}.${decimals}`;
}

/** `+R 20.00` / `−R 5.00` / `Free` — used on option rows. */
export function formatPriceDelta(rand: number): string {
  if (rand === 0) return 'Free';
  const prefix = rand > 0 ? '+' : '−';
  return `${prefix}${formatPrice(Math.abs(rand))}`;
}

export function pointsToRand(points: number): number {
  return fromCents(toCents(points * businessRules.randPerPoint));
}

export function randToPoints(rand: number): number {
  return Math.floor(rand * businessRules.pointsPerRand);
}
