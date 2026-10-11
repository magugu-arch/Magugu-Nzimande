import type { Market, Money } from './types';

/**
 * Money arithmetic in integer minor units. Amounts arrive as decimal strings
 * and leave as decimal strings; a float only exists inside Intl at the moment
 * of display. The app never computes a price the customer pays — checkout
 * does — but a bag subtotal still has to add up exactly.
 */

const DIGITS: Record<string, number> = { JPY: 0, KRW: 0 };

function decimals(currencyCode: string): number {
  return DIGITS[currencyCode] ?? 2;
}

export function toMinor(money: Money): number {
  const d = decimals(money.currencyCode);
  const negative = money.amount.trim().startsWith('-');
  const [whole = '0', frac = ''] = money.amount.replace('-', '').split('.');
  const minor = Number(whole) * 10 ** d + Number((frac + '0'.repeat(d)).slice(0, d) || '0');
  if (!Number.isSafeInteger(minor)) throw new Error(`Amount out of range: ${money.amount}`);
  return negative ? -minor : minor;
}

export function fromMinor(minor: number, currencyCode: string): Money {
  const d = decimals(currencyCode);
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  if (d === 0) return { amount: `${sign}${abs}`, currencyCode };
  const whole = Math.floor(abs / 10 ** d);
  const frac = String(abs % 10 ** d).padStart(d, '0');
  return { amount: `${sign}${whole}.${frac}`, currencyCode };
}

export function multiply(money: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) throw new Error('Quantity must be a whole number');
  return fromMinor(toMinor(money) * quantity, money.currencyCode);
}

export function sum(items: Money[], currencyCode: string): Money {
  let total = 0;
  for (const m of items) {
    if (m.currencyCode !== currencyCode) {
      throw new Error(`Cannot add ${m.currencyCode} to ${currencyCode}`);
    }
    total += toMinor(m);
  }
  return fromMinor(total, currencyCode);
}

export function formatMoney(money: Money, market: Pick<Market, 'locale'>): string {
  try {
    return new Intl.NumberFormat(market.locale, {
      style: 'currency',
      currency: money.currencyCode,
    }).format(Number(money.amount));
  } catch {
    return `${money.currencyCode} ${money.amount}`;
  }
}
