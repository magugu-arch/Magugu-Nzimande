import type { QuoteLine } from './types';

export const DEFAULT_TAX_RATE_BPS = 1500; // South African VAT, 15%
export const DEFAULT_DEPOSIT_PERCENT = 50;

export const DEFAULT_CANCELLATION_TERMS = [
  'The deposit secures the date and is non-refundable once paid, except where the performance is cancelled by the artist.',
  'Cancellation by the client more than 60 days before the event: the deposit is retained and no further amount is due.',
  'Cancellation by the client 60 days or fewer before the event: the full fee is due.',
  'Force majeure, rescheduling and production obligations are as set out in the performance agreement.',
].join('\n');

export type QuoteTotals = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
};

/**
 * Quote arithmetic, in integer cents. Tax is rounded half-up once on the
 * subtotal (not per line), and the deposit is rounded the same way, so the
 * deposit and balance always add back to the total exactly.
 */
export function calculateQuote(lines: QuoteLine[], opts: { taxApplicable: boolean; taxRateBps: number; depositPercent: number }): QuoteTotals {
  if (opts.depositPercent < 0 || opts.depositPercent > 100) throw new RangeError('depositPercent must be 0–100');
  if (opts.taxRateBps < 0) throw new RangeError('taxRateBps must be non-negative');
  for (const line of lines) {
    if (!Number.isInteger(line.amountCents) || line.amountCents < 0) throw new RangeError('Line amounts must be whole, non-negative cents');
  }
  const subtotalCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const taxCents = opts.taxApplicable ? Math.round((subtotalCents * opts.taxRateBps) / 10_000) : 0;
  const totalCents = subtotalCents + taxCents;
  const depositCents = Math.round((totalCents * opts.depositPercent) / 100);
  return { subtotalCents, taxCents, totalCents, depositCents, balanceCents: totalCents - depositCents };
}

const ZAR = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 });

export function formatZar(cents: number): string {
  return ZAR.format(cents / 100);
}

/** "12 500,50" or "12500.50" → 1250050 cents. Returns null for anything that is not money. */
export function parseRandToCents(input: string): number | null {
  const cleaned = input.replace(/[R\s ]/gi, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
