/**
 * Money is integer cents everywhere in this codebase, formatted only at the edge.
 * Every arithmetic helper here takes and returns cents, never a float.
 */

export type Cents = number;

const RAND = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats cents as South African rand. The only place cents becomes a decimal. */
export function formatMoney(cents: Cents): string {
  // Intl renders ZAR as "R 1 234,56" in some runtimes and "ZAR 1,234.56" in
  // others, so the group and decimal separators are normalised by hand to the
  // single form the brand uses on price flags and receipts.
  const parts = RAND.formatToParts(Math.round(cents) / 100);
  let out = '';
  for (const part of parts) {
    if (part.type === 'currency') out += 'R';
    else if (part.type === 'group') out += ' ';
    else if (part.type === 'decimal') out += '.';
    else if (part.type === 'literal') continue;
    else out += part.value;
  }
  return out;
}

/** Formats cents without the trailing ".00" on whole rand, for compact price flags. */
export function formatMoneyCompact(cents: Cents): string {
  const formatted = formatMoney(cents);
  return formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted;
}

/** Applies a percentage discount, rounded to the nearest cent. */
export function applyPercentage(cents: Cents, percentage: number): Cents {
  return Math.round(cents * percentage);
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce<Cents>((total, value) => total + value, 0);
}
