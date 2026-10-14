import { describe, expect, it } from 'vitest';
import {
  cardBrand,
  checkCardNumber,
  checkCvc,
  checkExpiry,
  checkZip,
  formatCardNumber,
  formatExpiry,
  luhn,
  orderTotalCents,
  parseDemoOrder,
  TEST_CARDS,
} from '@/lib/demo-payment';

describe('demo payment', () => {
  it('accepts only Stripe test card numbers', () => {
    expect(checkCardNumber(TEST_CARDS.visa)).toEqual({ ok: true, outcome: 'success' });
    expect(checkCardNumber('4242 4242 4242 4242')).toEqual({ ok: true, outcome: 'success' });
    expect(checkCardNumber(TEST_CARDS.declined)).toEqual({ ok: true, outcome: 'declined' });
    expect(checkCardNumber(TEST_CARDS.insufficientFunds)).toEqual({
      ok: true,
      outcome: 'insufficient-funds',
    });
    // A valid-looking number that is not a test card is refused outright.
    const refused = checkCardNumber('4111 1111 1111 1111');
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toMatch(/only accepts test card numbers/);
    expect(checkCardNumber('4242 4242 4242 4241').ok).toBe(false);
    expect(checkCardNumber('').ok).toBe(false);
  });

  it('checks digits the way card networks do', () => {
    expect(luhn('4242424242424242')).toBe(true);
    expect(luhn('4242424242424241')).toBe(false);
    expect(luhn('12')).toBe(false);
  });

  it('formats as people type and recognises the card', () => {
    expect(formatCardNumber('4242424242424242999')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
    expect(cardBrand('5555')).toBe('mastercard');
    expect(cardBrand('37')).toBe('amex');
    expect(cardBrand('9')).toBe('unknown');
    expect(formatExpiry('1')).toBe('1');
    expect(formatExpiry('4')).toBe('04');
    expect(formatExpiry('0427')).toBe('04 / 27');
  });

  it('validates expiry, security code and ZIP', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    expect(checkExpiry('10 / 26', now)).toBeNull();
    expect(checkExpiry('09 / 26', now)).toMatch(/expired/);
    expect(checkExpiry('13 / 27', now)).toMatch(/month/);
    expect(checkExpiry('12 / 99', now)).toMatch(/year/);
    expect(checkCvc('123', 'visa')).toBeNull();
    expect(checkCvc('123', 'amex')).toMatch(/4-digit/);
    expect(checkZip('75201')).toBeNull();
    expect(checkZip('75201-1234')).toBeNull();
    expect(checkZip('7520')).toMatch(/ZIP/);
  });

  it('reads the handed-over order strictly', () => {
    const order = {
      kind: 'books',
      reference: 'MG-ABCD-EFGH',
      lines: [{ title: 'B.O.S.S. Moves', quantity: 2, unitCents: 2000 }],
      shipping: true,
      back: { href: '/books', label: 'Back to books' },
    };
    const parsed = parseDemoOrder(JSON.stringify(order));
    expect(parsed && orderTotalCents(parsed)).toBe(4000);
    expect(parseDemoOrder(null)).toBeNull();
    expect(parseDemoOrder('{')).toBeNull();
    expect(parseDemoOrder(JSON.stringify({ ...order, lines: [] }))).toBeNull();
    expect(
      parseDemoOrder(
        JSON.stringify({ ...order, lines: [{ title: 'x', quantity: 1.5, unitCents: 1 }] }),
      ),
    ).toBeNull();
  });
});
