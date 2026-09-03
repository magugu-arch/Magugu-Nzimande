import { createIdempotencyScope, IDEMPOTENCY_HEADER } from '@/features/checkout/idempotency';
import { placeOrder, resetIdempotencyLedger } from '@/services/orderService';
import { authorisePayment, resetAuthorisationLedger } from '@/services/paymentService';
import { submitOrder } from '@/features/checkout/submitOrder';
import { fetchLoyaltyAccount } from '@/services/rewardsService';
import { ApiRequestError } from '@/services/apiClient';
import type { Order, PlaceOrderInput } from '@/types';

/**
 * The brief's acceptance criterion: "checkout retries cannot create duplicate
 * orders". Everything here is about the second tap.
 */

const totals = {
  subtotal: 200,
  deliveryFee: 32,
  serviceFee: 5,
  discount: 0,
  rewardsDiscount: 0,
  total: 237,
  pointsEarned: 200,
};

const orderPayload = (idempotencyKey: string): PlaceOrderInput => ({
  lines: [],
  totals,
  fulfilmentType: 'delivery',
  storeId: 'store-sandton',
  paymentMethodId: 'payment-visa',
  paymentMethodType: 'card',
  idempotencyKey,
});

beforeEach(() => {
  resetIdempotencyLedger();
  resetAuthorisationLedger();
});

describe('the key that names an attempt', () => {
  it('mints once and keeps giving the same answer', () => {
    const scope = createIdempotencyScope();
    const first = scope.current();

    expect(scope.current()).toBe(first);
    expect(scope.current()).toBe(first);
  });

  it('holds the key until the attempt is settled, then starts a new one', () => {
    const scope = createIdempotencyScope();
    const first = scope.current();

    expect(scope.isHeld()).toBe(true);
    scope.settle();
    expect(scope.isHeld()).toBe(false);

    expect(scope.current()).not.toBe(first);
  });

  it('does not repeat itself across scopes', () => {
    const keys = new Set(Array.from({ length: 200 }, () => createIdempotencyScope().current()));
    expect(keys.size).toBe(200);
  });

  it('travels in the header gateways expect', () => {
    expect(IDEMPOTENCY_HEADER).toBe('Idempotency-Key');
  });
});

describe('placing the same attempt twice', () => {
  it('returns the original order rather than making a second', async () => {
    const first = await placeOrder(orderPayload('idem-retry'));
    const second = await placeOrder(orderPayload('idem-retry'));

    expect(second.id).toBe(first.id);
    expect(second.reference).toBe(first.reference);
  });

  it('does not charge the customer twice for the same key', async () => {
    const first = await placeOrder(orderPayload('idem-once'));
    const second = await placeOrder(orderPayload('idem-once'));

    expect(second.totals.total).toBe(first.totals.total);
    // Same order, so the same single amount — not two orders of R237.
    expect(second).toEqual(first);
  });

  it('still makes a second order for a genuinely new attempt', async () => {
    const first = await placeOrder(orderPayload('idem-a'));
    const second = await placeOrder(orderPayload('idem-b'));

    expect(second.id).not.toBe(first.id);
    expect(second.reference).not.toBe(first.reference);
  });

  it('does not award the points a second time', async () => {
    await placeOrder(orderPayload('idem-points'));
    const afterFirst = await fetchLoyaltyAccount();

    await placeOrder(orderPayload('idem-points'));
    const afterRetry = await fetchLoyaltyAccount();

    expect(afterRetry.pointsBalance).toBe(afterFirst.pointsBalance);
  });
});

describe('authorising the same attempt twice', () => {
  it('returns the original hold rather than taking a second', async () => {
    const input = {
      amount: 237,
      paymentMethodId: 'payment-visa',
      methodType: 'card' as const,
      orderReference: 'pending',
      idempotencyKey: 'idem-auth',
    };

    const first = await authorisePayment(input);
    const second = await authorisePayment(input);

    expect(second.intentId).toBe(first.intentId);
  });

  it('takes a separate hold for a separate attempt', async () => {
    const base = {
      amount: 237,
      paymentMethodId: 'payment-visa',
      methodType: 'card' as const,
      orderReference: 'pending',
    };

    const first = await authorisePayment({ ...base, idempotencyKey: 'idem-auth-1' });
    const second = await authorisePayment({ ...base, idempotencyKey: 'idem-auth-2' });

    expect(second.intentId).not.toBe(first.intentId);
  });
});

/**
 * The sequence this was built for: an order that fails after the card is
 * authorised, retried by a customer who taps again.
 */
describe('a retry after the order call fails', () => {
  it('reuses the authorisation instead of stacking a second hold', async () => {
    const scope = createIdempotencyScope();
    const key = scope.current();

    const authorised: string[] = [];
    const authorise = async (input: { idempotencyKey: string }) => {
      const result = await authorisePayment({
        amount: 237,
        paymentMethodId: 'payment-visa',
        methodType: 'card',
        orderReference: 'pending',
        idempotencyKey: input.idempotencyKey,
      });
      authorised.push(result.intentId);
      return result;
    };

    let attempt = 0;
    const place = async (input: PlaceOrderInput): Promise<Order> => {
      attempt += 1;
      // First call dies after the card is authorised — the case the whole
      // sequence exists for.
      if (attempt === 1) {
        throw new ApiRequestError({
          message: 'The kitchen did not answer',
          code: 'server_error',
          status: 500,
        });
      }
      return placeOrder(input);
    };

    const deps = { authorise, place, release: async () => true };
    const payment = {
      amount: 237,
      paymentMethodId: 'payment-visa',
      methodType: 'card' as const,
      orderReference: 'pending',
      idempotencyKey: key,
    };

    const failed = await submitOrder(payment, orderPayload(key), deps);
    expect(failed.status).not.toBe('placed');

    // The customer taps again. The scope was never settled, so it is the same
    // attempt — not a new one.
    expect(scope.current()).toBe(key);

    const retried = await submitOrder(payment, orderPayload(scope.current()), deps);
    expect(retried.status).toBe('placed');

    // Two authorise calls, one hold.
    expect(authorised).toHaveLength(2);
    expect(new Set(authorised).size).toBe(1);
  });
});
