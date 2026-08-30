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

/**
 * What to show where a price should be but there is not one.
 *
 * An em dash, because every alternative is a number and a number here is a
 * claim. This used to be `R 0.00`: `formatPrice` coerced anything non-finite
 * to zero, so a price the app could not read rendered as free.
 *
 * That is reachable, and the way it is reachable is ordinary. Money APIs
 * routinely return decimals as strings to keep float precision out of the
 * wire, and `request<T>` casts the parsed JSON rather than validating it — so
 * `basePrice: "129.00"` reaches the app as a string. The arithmetic coerces
 * and gets the right answer; `Number.isFinite` does not coerce and got zero.
 * The menu tile said R 0.00, the product screen said R 0.00, and the bill said
 * R 258.00.
 *
 * A dash is noticed and reported. Free chicken is noticed and ordered.
 */
export const PRICE_UNAVAILABLE = '—';

/** `R 129.90` — the South African convention used across the app. */
export function formatPrice(rand: number): string {
  if (!Number.isFinite(rand)) return PRICE_UNAVAILABLE;
  const fixed = Math.abs(rand).toFixed(2);
  const [whole = '0', decimals = '00'] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = rand < 0 ? '-' : '';
  return `${sign}${businessRules.currencySymbol} ${grouped}.${decimals}`;
}

/** `+R 20.00` / `−R 5.00` / `Free` — used on option rows. */
export function formatPriceDelta(rand: number): string {
  // Checked before the zero test, which a non-number fails into a sign.
  if (!Number.isFinite(rand)) return PRICE_UNAVAILABLE;
  if (rand === 0) return 'Free';
  const prefix = rand > 0 ? '+' : '−';
  return `${prefix}${formatPrice(Math.abs(rand))}`;
}

export function pointsToRand(points: number): number {
  return fromCents(toCents(points * businessRules.randPerPoint));
}

export function randToPoints(rand: number, pointsPerRand?: number): number {
  // The tier's rate when one is known, the flat business rule otherwise.
  // Optional rather than required so the pricing path keeps working for a
  // basket priced before anyone has signed in — a guest has no tier, and
  // quoting them nothing at all would be worse than quoting them the base.
  return Math.floor(rand * (pointsPerRand ?? businessRules.pointsPerRand));
}
