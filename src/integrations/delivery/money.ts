/**
 * Rands in, cents out — once, at the provider boundary.
 *
 * The app carries money as rand floats: `businessRules.deliveryFee` is 32,
 * a product price is 189.50. The brief's provider contract carries integer
 * cents: `deliveryFeeCents`, `unitPriceCents`, `totalCents`.
 *
 * Both conventions are defensible and the app is not changing its one for a
 * delivery extension. What is not defensible is converting ad hoc: a stray
 * `* 100` in an adapter and a missing one in a test is how an order is placed
 * for R4.50 instead of R450, and floats make it worse — `189.5 * 100` is
 * 18950.000000000004 in IEEE 754, and `Math.floor` on that is fine while
 * `0.29 * 100` floors to 28.
 *
 * So: one conversion, rounding correctly, used by every adapter.
 */

/** Rand amount (possibly fractional) to integer cents. */
export function toCents(rands: number): number {
  if (!Number.isFinite(rands)) {
    throw new Error(`toCents received a non-finite amount: ${rands}`);
  }
  // Round rather than truncate: `Math.round(0.29 * 100)` is 29, which is the
  // answer a person reading "R0.29" expects. `Math.floor` gives 28.
  return Math.round(rands * 100);
}

/** Integer cents back to a rand amount, for display and for app totals. */
export function fromCents(cents: number): number {
  if (!Number.isInteger(cents)) {
    throw new Error(`fromCents received non-integer cents: ${cents}`);
  }
  return cents / 100;
}

/**
 * Format cents as South African rands for UI.
 *
 * Kept here rather than in a formatting util because provider amounts are
 * the only place in the app that holds cents, and a formatter that accepts
 * both units is a formatter that will eventually be handed the wrong one.
 */
export function formatCents(cents: number): string {
  const rands = fromCents(cents);
  return `R${rands.toFixed(2)}`;
}
