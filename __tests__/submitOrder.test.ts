import type { Order, PlaceOrderInput } from '@/types';
import type { AuthorisePaymentInput } from '@/services/paymentService';
import {
  safeToRetry,
  submitOrder,
  type SubmitFailure,
  type SubmitOrderDeps,
} from '@/features/checkout/submitOrder';
import { ApiRequestError } from '@/services/apiClient';

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
  paymentMethodType: 'card',
  idempotencyKey: 'test-key',
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

/**
 * A failed authorisation call is two different things, and the code treated
 * them as one.
 *
 * A refusal is an answer: the gateway received the request, considered it and
 * said no. Nothing was taken, so "please try again" is sound.
 *
 * A timeout or a dropped connection is not an answer. The card may have been
 * authorised and the reply lost — and there is no `intentId` to release,
 * because the call that would have returned one never did. Inviting that
 * customer to retry is how one order becomes two holds, which is the whole
 * thing this sequence exists to prevent. It was reasoned about carefully for
 * the second call and not at all for the first.
 */
describe('when the authorisation call gets no answer', () => {
  const throwing = (error: unknown) => deps({ authorise: jest.fn().mockRejectedValue(error) });

  it('does not call a timeout a decline', async () => {
    const timedOut = new ApiRequestError({ code: 'timeout', message: 'That took too long.' });
    const outcome = await submitOrder(payment, orderInput, throwing(timedOut));
    expect(outcome.status).toBe('uncertain');
  });

  it('does not tell them to try again', async () => {
    const offline = new ApiRequestError({ code: 'network', message: "We can't reach bb.q." });
    const outcome = await submitOrder(payment, orderInput, throwing(offline));
    // The one thing this message must never do.
    expect(outcome.status === 'uncertain' && outcome.message).not.toMatch(/try again\.$/);
    expect(outcome.status === 'uncertain' && outcome.message).toMatch(/banking app/i);
  });

  it('treats a 5xx the same way, because the gateway may still have acted', async () => {
    const broken = new ApiRequestError({ code: 'http_502', message: 'Bad gateway', status: 502 });
    expect((await submitOrder(payment, orderInput, throwing(broken))).status).toBe('uncertain');
  });

  it('still calls a refusal a refusal, so retrying stays free', async () => {
    const refused = new ApiRequestError({
      code: 'card_declined',
      message: 'That card was declined.',
      status: 402,
    });
    const outcome = await submitOrder(payment, orderInput, throwing(refused));
    expect(outcome.status).toBe('declined');
    expect(outcome.status === 'declined' && outcome.message).toBe('That card was declined.');
  });

  it('calls a plain error a refusal rather than guessing', async () => {
    // Not an ApiRequestError at all — a bug in our own code on the way to the
    // request. Nothing was sent, so nothing was taken.
    const outcome = await submitOrder(payment, orderInput, throwing(new Error('boom')));
    expect(outcome.status).toBe('declined');
  });

  it('never places the order when it could not authorise', async () => {
    const place = jest.fn();
    const timedOut = new ApiRequestError({ code: 'timeout', message: 'slow' });
    await submitOrder(
      payment,
      orderInput,
      deps({ authorise: jest.fn().mockRejectedValue(timedOut), place }),
    );
    expect(place).not.toHaveBeenCalled();
  });
});

/**
 * Which failures a customer may answer by pressing the button again.
 *
 * The four outcomes above are told apart precisely so this question has an
 * answer, and the checkout screen threw the answer away: every non-placed
 * outcome went to one `setSubmitError(outcome.message)`, under a "Place order"
 * button whose `disabled` looked only at pre-flight validation. So the
 * `uncertain` message — "we cannot tell whether your card was authorised …
 * call the store rather than paying twice" — rendered directly above a working
 * Place order button. The words said stop; the affordance said go.
 *
 * The rule lives beside the statuses because this is the file that knows what
 * they mean, and a screen is the wrong place to re-derive it.
 */
describe('safeToRetry', () => {
  it('lets a customer try again when nothing was taken', async () => {
    // A refusal is an answer: the gateway considered the card and said no.
    const declined = await submitOrder(
      payment,
      orderInput,
      deps({ authorise: jest.fn().mockRejectedValue(new Error('Card declined')) }),
    );
    expect(declined.status).toBe('declined');
    expect(safeToRetry(declined as SubmitFailure)).toBe(true);
  });

  it('lets a customer try again once a hold is confirmed released', async () => {
    const reversed = await submitOrder(
      payment,
      orderInput,
      deps({
        place: jest.fn().mockRejectedValue(new Error('Kitchen offline')),
        release: jest.fn().mockResolvedValue(true),
      }),
    );
    expect(reversed.status).toBe('reversed');
    expect(safeToRetry(reversed as SubmitFailure)).toBe(true);
  });

  it('refuses a retry when nobody knows whether the card was charged', async () => {
    const uncertain = await submitOrder(
      payment,
      orderInput,
      deps({
        // A timeout is not an answer — the gateway may have authorised and
        // lost the reply, and there is no intentId to release.
        authorise: jest
          .fn()
          .mockRejectedValue(
            new ApiRequestError({ code: 'timeout', message: 'That took too long.' }),
          ),
      }),
    );
    expect(uncertain.status).toBe('uncertain');
    expect(safeToRetry(uncertain as SubmitFailure)).toBe(false);
  });

  it('refuses a retry when the hold could not be released', async () => {
    const stranded = await submitOrder(
      payment,
      orderInput,
      deps({
        place: jest.fn().mockRejectedValue(new Error('Kitchen offline')),
        release: jest.fn().mockResolvedValue(false),
      }),
    );
    expect(stranded.status).toBe('stranded');
    expect(safeToRetry(stranded as SubmitFailure)).toBe(false);
  });

  it('tells the customer to check rather than to try again', () => {
    // The copy and the affordance have to agree; this is the copy half.
    for (const status of ['uncertain', 'stranded'] as const) {
      const message =
        status === 'uncertain'
          ? 'We could not reach the payment provider, and we cannot tell whether your card was authorised. Check your banking app before trying again — if a hold is showing, call the store rather than paying twice.'
          : 'Your order did not go through, but your card was authorised. The hold should clear shortly — call the store if it does not.';
      expect(message).toMatch(/call the store/i);
      expect(safeToRetry({ status, message })).toBe(false);
    }
  });
});
