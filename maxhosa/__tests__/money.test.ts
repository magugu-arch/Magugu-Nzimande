import { formatMoney, fromMinor, multiply, sum, toMinor } from '@/domain/money';

describe('money', () => {
  it('round-trips decimal strings through integer minor units', () => {
    expect(toMinor({ amount: '5400.00', currencyCode: 'ZAR' })).toBe(540000);
    expect(toMinor({ amount: '0.1', currencyCode: 'ZAR' })).toBe(10);
    expect(toMinor({ amount: '-12.34', currencyCode: 'ZAR' })).toBe(-1234);
    expect(fromMinor(540000, 'ZAR')).toEqual({ amount: '5400.00', currencyCode: 'ZAR' });
    expect(fromMinor(-1234, 'ZAR').amount).toBe('-12.34');
  });

  it('adds without floating-point drift', () => {
    const tenCents = { amount: '0.10', currencyCode: 'USD' };
    expect(sum([tenCents, { amount: '0.20', currencyCode: 'USD' }], 'USD').amount).toBe('0.30');
    expect(multiply({ amount: '3200.00', currencyCode: 'ZAR' }, 3).amount).toBe('9600.00');
  });

  it('refuses to add different currencies or fractional quantities', () => {
    expect(() => sum([{ amount: '1.00', currencyCode: 'GBP' }], 'ZAR')).toThrow(
      /Cannot add GBP to ZAR/,
    );
    expect(() => multiply({ amount: '1.00', currencyCode: 'ZAR' }, 1.5)).toThrow();
  });

  it('formats in the market locale', () => {
    expect(formatMoney({ amount: '95.00', currencyCode: 'GBP' }, { locale: 'en-GB' })).toBe(
      '£95.00',
    );
  });
});
