import type { PaymentMethod } from '@/types';
import { STANDING_RAILS, offeredPaymentMethods } from '@/features/checkout/paymentOptions';

const card = (id: string, label: string, isDefault = false): PaymentMethod => ({
  id,
  type: 'card',
  label,
  last4: id.slice(-4),
  isDefault,
});

/**
 * Checkout offered exactly what the account endpoint returned, and the seeded
 * version of that list mixed saved cards with rails like cash on delivery —
 * which belong to the business and are saved by nobody. Against the mock it
 * looked fine. Driven in a browser with the saved list emptied, the way it
 * would arrive for someone who installed the app that morning:
 *
 *     payment options offered: 0
 *
 * An empty Payment section and no way to pay at all.
 */
describe('what a customer can pay with', () => {
  it('offers the standing rails to someone with nothing saved', () => {
    const offered = offeredPaymentMethods([], 'delivery');

    expect(offered.length).toBeGreaterThan(0);
    expect(offered.map((method) => method.type)).toEqual(
      expect.arrayContaining(['snapscan', 'eft', 'cash']),
    );
  });

  it('puts saved cards first, because that is the fast path', () => {
    const offered = offeredPaymentMethods([card('pm-1', 'Visa ending 4821', true)], 'delivery');

    expect(offered[0]?.id).toBe('pm-1');
    expect(offered).toHaveLength(1 + STANDING_RAILS.length);
  });

  /**
   * Nobody has settled whether the backend returns rails alongside saved
   * cards. If it does, they must not appear twice.
   */
  it('does not double a rail the server already sent', () => {
    const fromServer: PaymentMethod[] = [
      card('pm-1', 'Visa ending 4821'),
      { id: 'server-cash', type: 'cash', label: 'Cash on delivery', isDefault: false },
    ];

    const offered = offeredPaymentMethods(fromServer, 'delivery');
    const cash = offered.filter((method) => method.type === 'cash');

    expect(cash).toHaveLength(1);
    // The server's version wins — it knows things this list cannot.
    expect(cash[0]?.id).toBe('server-cash');
  });

  /** There is nobody to hand the money to when you collect it yourself. */
  it('keeps cash off a collection order', () => {
    const offered = offeredPaymentMethods([], 'collection');
    expect(offered.map((method) => method.type)).not.toContain('cash');
  });

  it('keeps cash off a dine-in order too', () => {
    const offered = offeredPaymentMethods([], 'dinein');
    expect(offered.map((method) => method.type)).not.toContain('cash');
  });

  it('still offers the card-free rails on a collection order', () => {
    const offered = offeredPaymentMethods([], 'collection');
    expect(offered.map((method) => method.type)).toEqual(
      expect.arrayContaining(['snapscan', 'eft']),
    );
  });
});
