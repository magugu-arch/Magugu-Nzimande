/**
 * The preview's stand-in for Stripe's payment page. While no Stripe key is
 * set, "Check out" and "Continue to payment" lead here so the whole journey —
 * details, card, pay, confirmation — can be reviewed. It is never available
 * in production, and it is built so it cannot take a real payment:
 *
 * - only Stripe's published test card numbers are accepted; any other number,
 *   real or not, is refused;
 * - card fields have no `name`, the form has no action, and nothing typed is
 *   stored or sent anywhere.
 *
 * Pure functions: shared by the React page, the tests and (ported) the
 * single-file export.
 */

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'unknown';

export const TEST_CARDS = {
  /** Succeeds. */
  visa: '4242424242424242',
  mastercard: '5555555555554444',
  amex: '378282246310005',
  /** Declines, the way a bank would. */
  declined: '4000000000000002',
  insufficientFunds: '4000000000009995',
} as const;

export type CardOutcome = 'success' | 'declined' | 'insufficient-funds';

const OUTCOMES: Record<string, CardOutcome> = {
  [TEST_CARDS.visa]: 'success',
  [TEST_CARDS.mastercard]: 'success',
  [TEST_CARDS.amex]: 'success',
  [TEST_CARDS.declined]: 'declined',
  [TEST_CARDS.insufficientFunds]: 'insufficient-funds',
};

export function digits(value: string): string {
  return value.replace(/\D/g, '');
}

export function cardBrand(number: string): CardBrand {
  const n = digits(number);
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  return 'unknown';
}

/** Groups as the card itself does: 4-4-4-4, or 4-6-5 for Amex. */
export function formatCardNumber(value: string): string {
  const n = digits(value);
  if (cardBrand(n) === 'amex') {
    const d = n.slice(0, 15);
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10)].filter(Boolean).join(' ');
  }
  return (n.slice(0, 16).match(/.{1,4}/g) ?? []).join(' ');
}

/** "0427" or "04/27" → "04 / 27", as people type. */
export function formatExpiry(value: string): string {
  let n = digits(value).slice(0, 4);
  if (n.length === 1 && Number(n) > 1) n = `0${n}`;
  return n.length > 2 ? `${n.slice(0, 2)} / ${n.slice(2)}` : n;
}

export function luhn(number: string): boolean {
  const n = digits(number);
  if (n.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export type CardCheck = { ok: true; outcome: CardOutcome } | { ok: false; message: string };

export function checkCardNumber(number: string): CardCheck {
  const n = digits(number);
  if (!n) return { ok: false, message: 'Enter the card number.' };
  if (!luhn(n))
    return { ok: false, message: 'Check the card number; it is not complete or has a typo.' };
  const outcome = OUTCOMES[n];
  if (!outcome) {
    return {
      ok: false,
      message:
        'This demo only accepts test card numbers, such as 4242 4242 4242 4242. Real cards are refused, and nothing typed here is sent anywhere.',
    };
  }
  return { ok: true, outcome };
}

/** MM / YY, this month or later, within twenty years. */
export function checkExpiry(value: string, now = new Date()): string | null {
  const n = digits(value);
  if (n.length !== 4) return 'Enter the expiry date as MM / YY.';
  const month = Number(n.slice(0, 2));
  const year = 2000 + Number(n.slice(2));
  if (month < 1 || month > 12) return 'Enter a month from 01 to 12.';
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const expiry = year * 12 + (month - 1);
  if (expiry < thisMonth) return 'This card has expired. Use a future date.';
  if (expiry > thisMonth + 20 * 12) return 'Check the expiry year.';
  return null;
}

export function checkCvc(value: string, brand: CardBrand): string | null {
  const n = digits(value);
  const length = brand === 'amex' ? 4 : 3;
  return n.length === length ? null : `Enter the ${length}-digit security code.`;
}

export function checkZip(value: string): string | null {
  return /^\d{5}(-\d{4})?$/.test(value.trim()) ? null : 'Enter a 5-digit ZIP code.';
}

export function checkEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter your email address.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    ? null
    : 'Enter an email address in the format name@example.com.';
}

export const declineMessages: Record<Exclude<CardOutcome, 'success'>, string> = {
  declined: 'Your card was declined. Try another card. (Demo: this test card always declines.)',
  'insufficient-funds':
    'Your card has insufficient funds. Try another card. (Demo: this test card always fails this way.)',
};

// ---------------------------------------------------------------- the order

/** What the payment page is paying for, handed over in sessionStorage. */
export interface DemoOrder {
  kind: 'books' | 'event';
  reference: string;
  lines: { title: string; detail?: string; quantity: number; unitCents: number }[];
  /** Books need a delivery address; event seats do not. */
  shipping: boolean;
  email?: string;
  back: { href: string; label: string };
}

export const DEMO_ORDER_KEY = 'mg-demo-order-v1';

export function orderTotalCents(order: Pick<DemoOrder, 'lines'>): number {
  return order.lines.reduce((sum, l) => sum + l.unitCents * l.quantity, 0);
}

export function parseDemoOrder(raw: string | null): DemoOrder | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as DemoOrder;
    if (
      (o.kind !== 'books' && o.kind !== 'event') ||
      typeof o.reference !== 'string' ||
      !Array.isArray(o.lines) ||
      o.lines.length === 0 ||
      !o.lines.every(
        (l) =>
          typeof l.title === 'string' &&
          Number.isInteger(l.quantity) &&
          l.quantity > 0 &&
          Number.isInteger(l.unitCents) &&
          l.unitCents >= 0,
      )
    ) {
      return null;
    }
    return o;
  } catch {
    return null;
  }
}
