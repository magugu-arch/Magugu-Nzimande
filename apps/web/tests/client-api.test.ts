import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, advanceOrder, fetchOrder, placeOrder, quoteDelivery } from '@/lib/client-api';
import type { CreateOrderRequest } from '@bbq/types';
import {
  aProduct,
  customer,
  orderLine,
  orderRequest,
  stubFetch,
  type StubbedResponse,
} from './fixtures';

/**
 * The browser-side service layer.
 *
 * Its whole job is that "a shape the API did not promise fails here rather
 * than three components later" — which is a claim about what it does with a
 * *wrong* response, so these hand it wrong ones on purpose. Nothing here
 * reaches the real API; `stubFetch` stands in for the network.
 */

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

const serve = (reply: (path: string) => StubbedResponse) => {
  restore = stubFetch(reply);
};

const product = aProduct();

/**
 * The journey response, whole. The payment half is not optional in the schema,
 * so a fixture that leaves it out is a fixture that no longer describes the API
 * — which is what two of these were until the schema said so.
 */
const anOrderStatus = (payment = { required: false, status: null }) => ({
  order: anOrder(),
  statusLabel: 'Order received',
  payment,
});

/** A well-formed order, as the API would really answer. */
const anOrder = () => ({
  id: 'O-1',
  orderNumber: 'BBQ-260902-0001',
  storeId: 'ST-CRE',
  mode: 'Collection',
  status: 'received',
  customer,
  accountId: null,
  cancelledReason: null,
  placedAt: new Date().toISOString(),
  etaMinutes: 25,
  lines: [orderLine(product)],
  totals: {
    subtotalCents: product.priceCents,
    discountCents: 0,
    deliveryCents: 0,
    totalCents: product.priceCents,
  },
  promoCode: null,
  address: null,
  suburb: null,
  kitchenNote: '',
  pointsEarned: 1,
});

describe('a response the API promised', () => {
  it('comes back parsed', async () => {
    serve(() => ({ body: { order: anOrder() } }));

    const order = await placeOrder(orderRequest([orderLine(product)]) as CreateOrderRequest);
    expect(order.orderNumber).toBe('BBQ-260902-0001');
  });

  it('carries the status label through on a journey read', async () => {
    serve(() => ({ body: anOrderStatus() }));

    const result = await fetchOrder('O-1');
    expect(result.statusLabel).toBe('Order received');
  });

  it('parses a delivery quote', async () => {
    serve(() => ({
      body: { quote: { serviceable: true, feeCents: 3_500, etaMinutes: 45, storeId: 'ST-CRE' } },
    }));

    const quote = await quoteDelivery('Sandton', 15_000);
    expect(quote.serviceable).toBe(true);
  });

  it('parses an unserviceable quote, which is an answer rather than a failure', async () => {
    serve(() => ({
      body: { quote: { serviceable: false, reason: 'We do not deliver to this suburb yet.' } },
    }));

    const quote = await quoteDelivery('Nowhere', 15_000);
    expect(quote.serviceable).toBe(false);
  });
});

describe('a response the API did not promise', () => {
  /**
   * The point of the layer. Without the parse this returns an object with an
   * undefined `totals`, and the failure surfaces wherever a total is first
   * formatted — a long way from the thing that was wrong.
   */
  it('fails on a missing field rather than passing it on', async () => {
    const { totals, ...withoutTotals } = anOrder();
    void totals;
    serve(() => ({ body: { order: withoutTotals } }));

    await expect(
      placeOrder(orderRequest([orderLine(product)]) as CreateOrderRequest),
    ).rejects.toThrow();
  });

  it('fails on a field of the wrong type', async () => {
    serve(() => ({ body: { order: { ...anOrder(), etaMinutes: 'about half an hour' } } }));

    await expect(fetchOrder('O-1')).rejects.toThrow();
  });

  it('fails when the envelope itself is missing', async () => {
    serve(() => ({ body: anOrder() }));

    await expect(fetchOrder('O-1')).rejects.toThrow();
  });

  it('fails on a body that is not an object at all', async () => {
    serve(() => ({ body: 'have a nice day' }));

    await expect(fetchOrder('O-1')).rejects.toThrow();
  });
});

describe('an error from the API', () => {
  it('arrives as an ApiError carrying the status', async () => {
    serve(() => ({ status: 409, body: { error: 'That promo code is not valid' } }));

    await expect(fetchOrder('O-1')).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrder('O-1')).rejects.toMatchObject({ status: 409 });
  });

  /** The API's own words, so the customer reads what actually went wrong. */
  it('keeps the message the API sent', async () => {
    serve(() => ({ status: 409, body: { error: 'Some items are no longer available' } }));

    await expect(fetchOrder('O-1')).rejects.toThrow(/no longer available/);
  });

  it('falls back to something sayable when the API sends no message', async () => {
    serve(() => ({ status: 500, body: {} }));

    await expect(fetchOrder('O-1')).rejects.toThrow(/something went wrong/i);
  });

  it('does not mistake a non-string error field for a message', async () => {
    serve(() => ({ status: 400, body: { error: { code: 42 } } }));

    await expect(fetchOrder('O-1')).rejects.toThrow(/something went wrong/i);
  });

  it('reports a 404 as a 404 rather than a parse failure', async () => {
    serve(() => ({ status: 404, body: { error: 'No such order' } }));

    await expect(advanceOrder('O-nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('the requests it sends', () => {
  it('escapes an order id rather than pasting it into the path', async () => {
    const paths: string[] = [];
    restore = stubFetch((path) => {
      paths.push(path);
      return { body: anOrderStatus() };
    });

    await fetchOrder('O-1/../admin');
    expect(paths[0]).not.toContain('/../');
  });

  it('sends JSON when it posts', async () => {
    const seen: (RequestInit | undefined)[] = [];
    restore = stubFetch((_path, init) => {
      seen.push(init);
      return { body: { order: anOrder() } };
    });

    await placeOrder(orderRequest([orderLine(product)], { customer }) as CreateOrderRequest);

    expect(seen[0]?.method).toBe('POST');
    expect(
      new Headers(seen[0]?.headers as HeadersInit | undefined).get('content-type'),
    ).toMatch(/application\/json/);
  });
});
