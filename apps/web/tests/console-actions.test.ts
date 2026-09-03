import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET as queueRoute } from '@/app/api/admin/orders/route';
import { POST as problemsRoute } from '@/app/api/admin/problems/route';
import { forgetTokens } from '@/lib/fulfilment/uber/auth';
import { requestCourier } from '@/lib/fulfilment/handoff';
import { activeCourier } from '@/lib/fulfilment/registry';
import { intentForOrder, openIntent, settle } from '@/lib/payments/ledger';
import { suppress } from '@/lib/notifications/suppression';
import {
  CONSOLE_PASSPHRASE,
  aDeliveryStore,
  aSuburbOf,
  blankState,
  bodyOf,
  operatorCookie,
  placeOrder,
  request,
  stubFetch,
} from './fixtures';

/**
 * The console doing something about what it shows.
 *
 * The Problems tab printed "worth retrying" beside a refused handoff and gave
 * the operator no way to retry it — which is worse than saying nothing, because
 * it names an action and then does not provide it. The suppression list had the
 * same shape, and the payment ledger was settled and reconciled by tests and
 * displayed to nobody.
 *
 * The refusals are covered harder than the successes. Retrying a handoff that
 * already worked puts an order through a till twice, and restoring an address
 * whose owner reported us as spam is a compliance problem rather than a bug.
 */

let cookie: string;
let restoreFetch: (() => void) | null = null;

const UBER_ENV = {
  BBQ_COURIER_PROVIDER: 'uber-direct',
  BBQ_UBER_CLIENT_ID: 'client-id',
  BBQ_UBER_CLIENT_SECRET: 'client-secret',
  BBQ_UBER_CUSTOMER_ID: 'cus_test',
} as const;

beforeEach(async () => {
  process.env.BBQ_ADMIN_PASSWORD = CONSOLE_PASSPHRASE;
  blankState();
  cookie = await operatorCookie();
});

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
  delete process.env.BBQ_ADMIN_PASSWORD;
  for (const key of Object.keys(UBER_ENV)) delete process.env[key];
  forgetTokens();
});

const withUber = () => {
  for (const [key, value] of Object.entries(UBER_ENV)) process.env[key] = value;
};

const act = (body: unknown) =>
  problemsRoute(request('/api/admin/problems', { body, cookie }));

/** Deliberately without the operator cookie. */
const actSignedOut = (body: unknown) =>
  problemsRoute(request('/api/admin/problems', { body }));

/**
 * A delivery order, which is the only kind a courier is asked for.
 *
 * The default store in the fixtures is a collection store, so passing only
 * `mode: 'Delivery'` gets a 400 from the route for a suburb that store does not
 * serve — which is the route being right, not the fixture being awkward.
 */
const aDeliveryOrder = async () => {
  const store = aDeliveryStore();
  return placeOrder({
    storeId: store.id,
    mode: 'Delivery',
    address: '12 Oak Avenue',
    suburb: aSuburbOf(store),
  });
};

describe('who may act', () => {
  it('refuses somebody who is not signed in', async () => {
    const response = await actSignedOut({ action: 'unsuppress', address: 'a@b.com' });
    expect(response.status).toBe(401);
  });

  it('refuses a body it does not recognise', async () => {
    expect((await act({ action: 'delete-everything' })).status).toBe(400);
  });
});

describe('restoring an address', () => {
  it('allows a bounced address again', async () => {
    suppress('thandi@example.com', 'hard-bounce');

    const response = await act({ action: 'unsuppress', address: 'thandi@example.com' });

    expect(response.status).toBe(200);
    const body = await bodyOf<{ suppressed: unknown[] }>(response);
    expect(body.suppressed).toHaveLength(0);
  });

  /**
   * A complaint is the customer telling a mailbox provider we are spam.
   * Reversing it from the console puts us back to emailing them, which is the
   * thing that gets a sending domain blocked.
   */
  it('refuses to undo a complaint, and says why', async () => {
    suppress('thandi@example.com', 'complaint');

    const response = await act({ action: 'unsuppress', address: 'thandi@example.com' });

    expect(response.status).toBe(409);
    expect((await bodyOf<{ error: string }>(response)).error).toMatch(/only they can restore/i);
  });

  it('refuses to undo an unsubscribe', async () => {
    suppress('thandi@example.com', 'unsubscribed');
    expect((await act({ action: 'unsuppress', address: 'thandi@example.com' })).status).toBe(409);
  });

  it('says so when the address is not suppressed at all', async () => {
    expect((await act({ action: 'unsuppress', address: 'nobody@example.com' })).status).toBe(404);
  });

  /** The list is keyed case-insensitively, and so is the way back off it. */
  it('matches the address however it is capitalised', async () => {
    suppress('Thandi@Example.com', 'hard-bounce');

    const response = await act({ action: 'unsuppress', address: 'thandi@example.com' });
    expect(response.status).toBe(200);
  });
});

describe('retrying a handoff', () => {
  it('says so when the order was never handed off', async () => {
    const order = await aDeliveryOrder();
    const response = await act({
      action: 'retry-handoff',
      orderId: order.id,
      kind: 'courier',
    });

    expect(response.status).toBe(404);
  });

  it('says so when there is no such order', async () => {
    const response = await act({ action: 'retry-handoff', orderId: 'O-nope', kind: 'courier' });
    expect(response.status).toBe(404);
  });

  /**
   * A success is final. Sending it again would put the same order through the
   * till twice, which a kitchen reads as two of everything.
   */
  it('refuses to send a handoff that already succeeded', async () => {
    const order = await aDeliveryOrder();
    withUber();
    restoreFetch = stubFetch((path) =>
      path.includes('oauth')
        ? { body: { access_token: 'tok', expires_in: 3_600 } }
        : { body: { id: 'del_1' } },
    );
    await requestCourier(order, activeCourier());

    const response = await act({
      action: 'retry-handoff',
      orderId: order.id,
      kind: 'courier',
    });

    expect(response.status).toBe(409);
    expect((await bodyOf<{ error: string }>(response)).error).toMatch(/already succeeded/i);
  });

  it('sends a failed handoff again, and reports that it was accepted', async () => {
    const order = await aDeliveryOrder();
    withUber();

    // First attempt: Uber is having a bad afternoon.
    restoreFetch = stubFetch((path) =>
      path.includes('oauth')
        ? { body: { access_token: 'tok', expires_in: 3_600 } }
        : { status: 503, body: { message: 'service unavailable' } },
    );
    await requestCourier(order, activeCourier());
    restoreFetch();

    // Second: it is not.
    restoreFetch = stubFetch((path) =>
      path.includes('oauth')
        ? { body: { access_token: 'tok', expires_in: 3_600 } }
        : { body: { id: 'del_1' } },
    );

    const response = await act({
      action: 'retry-handoff',
      orderId: order.id,
      kind: 'courier',
    });

    expect(response.status).toBe(200);
    const body = await bodyOf<{ outcome: string; unacknowledged: unknown[] }>(response);
    expect(body.outcome).toBe('accepted');
    // And it leaves the report it came from.
    expect(body.unacknowledged).toHaveLength(0);
  });

  it('says which system is missing when none is attached', async () => {
    const order = await aDeliveryOrder();
    withUber();
    restoreFetch = stubFetch((path) =>
      path.includes('oauth')
        ? { body: { access_token: 'tok', expires_in: 3_600 } }
        : { status: 503, body: { message: 'service unavailable' } },
    );
    await requestCourier(order, activeCourier());
    restoreFetch();
    restoreFetch = null;

    // The record survives; the adapter does not.
    for (const key of Object.keys(UBER_ENV)) delete process.env[key];

    const response = await act({
      action: 'retry-handoff',
      orderId: order.id,
      kind: 'courier',
    });

    expect(response.status).toBe(503);
    expect((await bodyOf<{ error: string }>(response)).error).toMatch(/no courier system/i);
  });
});

describe('the payment ledger reaches the console', () => {
  const queue = async () =>
    bodyOf<{ payments: { orderNumber: string; status: string; providerRef: string | null }[] }>(
      await queueRoute(request('/api/admin/orders', { cookie })),
    );

  it('is empty on a deployment that takes no payments', async () => {
    await placeOrder();
    expect((await queue()).payments).toEqual([]);
  });

  it('carries the amount, the status and the provider’s own reference', async () => {
    const order = await placeOrder();
    openIntent(order.id, 'payfast');
    const intent = intentForOrder(order.id);
    if (!intent) throw new Error('No intent was opened');
    settle({
      id: 'evt_1',
      intentId: intent.id,
      status: 'captured',
      // The reference an operator types into PayFast's dashboard.
      providerRef: 'pf_9912',
      amountCents: intent.amountCents,
      failureReason: null,
    });

    const [payment] = (await queue()).payments;
    expect(payment).toMatchObject({
      orderNumber: order.orderNumber,
      status: 'captured',
      providerRef: 'pf_9912',
    });
  });

  it('keeps the provider’s words when a payment failed, for support to read', async () => {
    const order = await placeOrder();
    openIntent(order.id, 'payfast');
    const intent = intentForOrder(order.id);
    if (!intent) throw new Error('No intent was opened');
    settle({
      id: 'evt_1',
      intentId: intent.id,
      status: 'failed',
      providerRef: 'pf_9912',
      amountCents: intent.amountCents,
      failureReason: 'PayFast reported FAILED',
    });

    const [payment] = (await queue()).payments;
    expect(payment).toMatchObject({ failureReason: 'PayFast reported FAILED' });
  });

  it('is refused to somebody who is not signed in', async () => {
    const response = await queueRoute(request('/api/admin/orders'));
    expect(response.status).toBe(401);
  });
});
