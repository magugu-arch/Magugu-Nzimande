import type { Order, PlaceOrderInput } from '@/types';
import type { AuthorisePaymentInput } from '@/services/paymentService';
import { submitOrder, type SubmitOrderDeps } from '@/features/checkout/submitOrder';

const payment: AuthorisePaymentInput = {
  amount: 237,
  paymentMethodId: 'payment-visa',
  methodType: 'card',
  orderReference: 'pending',
};

const orderInput = {
  lines: [],
  totals: {
    subtotal: 200,
    deliveryFee: 32,
    serviceFee: 5,
    discount: 0,
    rewardsDiscount: 0,
    total: 237,
    pointsEarned: 200,
  },
  fulfilmentType: 'delivery',
  storeId: 'store-sandton',
  paymentMethodId: 'payment-visa',
} as PlaceOrderInput;

const placedOrder = { id: 'order-1', reference: 'BBQ-1' } as Order;

function deps(overrides: Partial<SubmitOrderDeps> = {}): SubmitOrderDeps {
  return {
    authorise: jest.fn().mockResolvedValue({ success: true, intentId: 'pi_1' }),
    place: jest.fn().mockResolvedValue(placedOrder),
    release: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('the happy path', () => {
  it('authorises, places, and releases nothing', async () => {
    const d = deps();
    const outcome = await submitOrder(payment, orderInput, d);

    expect(outcome).toEqual({ status: 'placed', order: placedOrder });
    expect(d.release).not.toHaveBeenCalled();
  });

  it('does not create the order until the money is authorised', async () => {
    const order: string[] = [];
    const d = deps({
      authorise: jest.fn(async () => {
        order.push('authorise');
        return { success: true, intentId: 'pi_1' };
      }),
      place: jest.fn(async () => {
        order.push('place');
        return placedOrder;
      }),
    });

    await submitOrder(payment, orderInput, d);
    expect(order).toEqual(['authorise', 'place']);
  });
});

describe('a payment that is refused', () => {
  it('never reaches the kitchen', async () => {
    const d = deps({
      authorise: jest.fn().mockResolvedValue({
        success: false,
        intentId: 'pi_1',
        message: 'Insufficient funds.',
      }),
    });

    const outcome = await submitOrder(payment, orderInput, d);

    expect(outcome).toEqual({ status: 'declined', message: 'Insufficient funds.' });
    expect(d.place).not.toHaveBeenCalled();
    // Nothing was taken, so there is nothing to give back.
    expect(d.release).not.toHaveBeenCalled();
  });

  it('treats a thrown authorisation the same way', async () => {
    const d = deps({ authorise: jest.fn().mockRejectedValue(new Error('Network unavailable.')) });

    const outcome = await submitOrder(payment, orderInput, d);

    expect(outcome.status).toBe('declined');
    expect(d.place).not.toHaveBeenCalled();
    expect(d.release).not.toHaveBeenCalled();
  });
});

/**
 * The bug this exists for. Checkout authorised the card and then created the
 * order, and anything failing in between left a hold against an order that
 * never existed — with nothing to release it, and an error message inviting a
 * retry that would authorise all over again.
 */
describe('an order that fails after the card is authorised', () => {
  it('gives the money back', async () => {
    const d = deps({ place: jest.fn().mockRejectedValue(new Error('Kitchen unavailable.')) });

    const outcome = await submitOrder(payment, orderInput, d);

    expect(d.release).toHaveBeenCalledWith('pi_1');
    expect(outcome.status).toBe('reversed');
  });

  it('says so, so the customer knows they can try again', async () => {
    const d = deps({ place: jest.fn().mockRejectedValue(new Error('Kitchen unavailable.')) });
    const outcome = await submitOrder(payment, orderInput, d);

    // Narrowed first: `placed` carries an order, not a message, and the union
    // is what stops a caller reading one off the other.
    expect(outcome.status).toBe('reversed');
    if (outcome.status === 'placed') throw new Error('unreachable');
    expect(outcome.message).toContain('Kitchen unavailable.');
    expect(outcome.message).toContain('not charged');
  });

  it('never tells them to try again when the hold could not be released', async () => {
    const d = deps({
      place: jest.fn().mockRejectedValue(new Error('Kitchen unavailable.')),
      release: jest.fn().mockResolvedValue(false),
    });

    const outcome = await submitOrder(payment, orderInput, d);

    expect(outcome.status).toBe('stranded');
    if (outcome.status === 'placed') throw new Error('unreachable');
    // A second attempt would authorise a second time.
    expect(outcome.message).not.toMatch(/try again/i);
    expect(outcome.message).toMatch(/authorised/);
  });

  it('treats a release that throws as a release that failed', async () => {
    const d = deps({
      place: jest.fn().mockRejectedValue(new Error('Kitchen unavailable.')),
      release: jest.fn().mockRejectedValue(new Error('Gateway down.')),
    });

    // The compensation failing must not replace the original failure with a
    // crash — the customer still needs to be told where their money is.
    const outcome = await submitOrder(payment, orderInput, d);
    expect(outcome.status).toBe('stranded');
  });

  it('releases exactly the authorisation it took', async () => {
    const d = deps({
      authorise: jest.fn().mockResolvedValue({ success: true, intentId: 'pi_specific' }),
      place: jest.fn().mockRejectedValue(new Error('nope')),
    });

    await submitOrder(payment, orderInput, d);
    expect(d.release).toHaveBeenCalledTimes(1);
    expect(d.release).toHaveBeenCalledWith('pi_specific');
  });
});

describe('cash, which is never authorised up front', () => {
  it('still places the order', async () => {
    const d = deps({
      authorise: jest.fn().mockResolvedValue({ success: true, intentId: 'cash' }),
    });

    const outcome = await submitOrder(
      { ...payment, methodType: 'cash', paymentMethodId: 'payment-cash' },
      orderInput,
      d,
    );

    expect(outcome.status).toBe('placed');
  });
});
