import type { Money } from './models';

/** Rands to Money. Only for fixtures and literal amounts — never for arithmetic. */
export const zar = (rands: number): Money => ({ cents: Math.round(rands * 100), currency: 'ZAR' });

export const addMoney = (...amounts: Money[]): Money => ({
  cents: amounts.reduce((sum, m) => sum + m.cents, 0),
  currency: 'ZAR',
});

export const multiplyMoney = (m: Money, quantity: number): Money => ({
  cents: m.cents * quantity,
  currency: 'ZAR',
});

/**
 * South African rand formatting: "R 4 250,00" is the SI style, but NMU's own
 * statements and the C.I. imagery use "R4,250.00". The app follows the
 * statement, since that is what a student compares it with.
 */
export function formatMoney(m: Money, opts: { showCents?: boolean; signed?: boolean } = {}): string {
  const { showCents = true, signed = false } = opts;
  const negative = m.cents < 0;
  const abs = Math.abs(m.cents);
  const rands = Math.floor(abs / 100);
  const cents = abs % 100;
  const grouped = rands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = showCents ? `${grouped}.${cents.toString().padStart(2, '0')}` : grouped;
  const sign = negative ? '−' : signed && m.cents > 0 ? '+' : '';
  return `${sign}R${body}`;
}

/** Spoken form for screen readers: "4,250 rand" rather than "R4,250.00". */
export function moneyAccessibilityLabel(m: Money): string {
  const abs = Math.abs(m.cents);
  const rands = Math.floor(abs / 100);
  const cents = abs % 100;
  const prefix = m.cents < 0 ? 'minus ' : '';
  return cents === 0
    ? `${prefix}${rands} rand`
    : `${prefix}${rands} rand ${cents} cents`;
}
