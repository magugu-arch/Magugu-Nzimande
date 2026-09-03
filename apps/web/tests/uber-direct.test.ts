import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as courierWebhook } from '@/app/api/couriers/webhook/route';
import { dropoffAddress, e164, encodeAddress, pickupAddress } from '@/lib/fulfilment/uber/address';
import { accessToken, forgetTokens } from '@/lib/fulfilment/uber/auth';
import { uberDirectAdapter } from '@/lib/fulfilment/uber/provider';
import { orderStatusFor, phaseOf } from '@/lib/fulfilment/uber/status';
import {
  UBER_SIGNATURE_HEADER,
  parseDeliveryEvent,
  signPayload,
  verifyWebhook,
} from '@/lib/fulfilment/uber/webhook';
import { activeCourier, courierWebhookSecret } from '@/lib/fulfilment/registry';
import { requestCourier } from '@/lib/fulfilment/handoff';
import { readOrder, setOrderStatus } from '@/lib/order-store';
import { aDeliveryStore, aSuburbOf, blankState, placeOrder } from './fixtures';

/**
 * The Uber Direct courier adapter.
 *
 * Uber Eats is a marketplace — customers order in Uber's app. Uber Direct is
 * the courier underneath it, where the customer orders here and an Uber driver
 * delivers. A courier adapter for our own orders is Direct; an Uber Eats
 * integration would be an inbound order channel and a menu sync, which is a
 * different piece of work.
 *
 * Built with no Uber account. Everything is either a pure transformation or a
 * call with its fetch injected; what credentials would buy is Uber agreeing
 * that our request is well formed, which is what their sandbox is for.
 */

const SIGNING_KEY = 'a-test-signing-key';

const ENV = {
  BBQ_COURIER_PROVIDER: 'uber-direct',
  BBQ_UBER_CLIENT_ID: 'client-id',
  BBQ_UBER_CLIENT_SECRET: 'client-secret',
  BBQ_UBER_CUSTOMER_ID: 'cus_test',
  BBQ_UBER_WEBHOOK_SECRET: SIGNING_KEY,
};

const aDeliveryOrder = async () => {
  const store = aDeliveryStore();
  return placeOrder({
    storeId: store.id,
    mode: 'Delivery',
    address: '12 Oak Avenue',
    suburb: aSuburbOf(store),
  });
};

/** A fetch that answers the token call and then whatever is queued. */
function stubUber(replies: Response[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('auth.uber.com')) {
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 2_592_000 }));
    }
    return replies.shift() ?? new Response('{}', { status: 500 });
  }) as unknown as typeof fetch;

  return { fetcher, calls };
}

beforeEach(() => {
  blankState();
  forgetTokens();
});

describe('the address, which is the gap this exposed', () => {
  it('builds a dropoff from the street and suburb', async () => {
    const order = await aDeliveryOrder();
    const address = dropoffAddress(order);

    expect(address?.street_address).toEqual(['12 Oak Avenue']);
    expect(address?.city).toBe(order.suburb);
    expect(address?.country).toBe('ZA');
  });

  /**
   * Refused rather than half-built. Uber accepts a partial address and a driver
   * discovers the problem at the kerb, which is the most expensive place to
   * find it.
   */
  it('refuses to build one without a suburb', async () => {
    const order = await aDeliveryOrder();
    expect(dropoffAddress({ ...order, suburb: null })).toBeNull();
    expect(dropoffAddress({ ...order, address: null })).toBeNull();
    expect(dropoffAddress({ ...order, address: '   ' })).toBeNull();
  });

  it('is sent as a JSON string, which is what Uber takes', async () => {
    const order = await aDeliveryOrder();
    const encoded = encodeAddress(dropoffAddress(order) as never);

    expect(typeof encoded).toBe('string');
    expect(JSON.parse(encoded).street_address).toEqual(['12 Oak Avenue']);
  });

  it('builds a pickup from the store', () => {
    expect(pickupAddress(aDeliveryStore()).street_address[0]).toBe(aDeliveryStore().address);
  });
});

describe('phone numbers', () => {
  /**
   * E.164 or the driver cannot ring the customer. A South African 0-prefixed
   * number sent as typed is read as belonging to whatever country Uber assumes.
   */
  it('converts a South African mobile', () => {
    expect(e164('0821234567')).toBe('+27821234567');
    expect(e164('082 123 4567')).toBe('+27821234567');
    expect(e164('27821234567')).toBe('+27821234567');
    expect(e164('+27821234567')).toBe('+27821234567');
  });

  it('refuses something that is not one', () => {
    for (const bad of ['', '12345', '+15550100', '0121234567']) {
      expect(e164(bad), bad).toBeNull();
    }
  });
});

describe('the status vocabularies', () => {
  /**
   * Two of them, and this is not defensiveness. Uber's older delivery API
   * reports lower-case statuses and the newer Direct endpoints report
   * upper-case ones; which an account gets depends on when it was provisioned.
   * An adapter that knows one looks right in testing and goes silent in
   * production.
   */
  it('reads the older vocabulary', () => {
    expect(phaseOf('pending')).toBe('assigned');
    expect(phaseOf('pickup')).toBe('collecting');
    expect(phaseOf('dropoff')).toBe('delivering');
    expect(phaseOf('delivered')).toBe('delivered');
    expect(phaseOf('canceled')).toBe('failed');
  });

  it('reads the newer one', () => {
    expect(phaseOf('EN_ROUTE_TO_PICKUP')).toBe('collecting');
    expect(phaseOf('EN_ROUTE_TO_DROPOFF')).toBe('delivering');
    expect(phaseOf('ARRIVED_AT_DROPOFF')).toBe('delivering');
    expect(phaseOf('COMPLETED')).toBe('delivered');
    expect(phaseOf('FAILED')).toBe('failed');
  });

  it('does not guess at one it has never seen', () => {
    expect(phaseOf('TELEPORTED')).toBeNull();
  });

  it('moves the order only when there is something to say', () => {
    expect(orderStatusFor('delivering')).toBe('out_for_delivery');
    expect(orderStatusFor('delivered')).toBe('completed');
    // The kitchen already said ready; a courier collecting tells the customer
    // nothing new.
    expect(orderStatusFor('assigned')).toBeNull();
    expect(orderStatusFor('collecting')).toBeNull();
  });

  /**
   * A failed delivery is a decision — refund, redeliver, or the customer
   * collects — and cancelling an order the kitchen has cooked is not one an
   * adapter should take on its own.
   */
  it('does not cancel an order because a delivery failed', () => {
    expect(orderStatusFor('failed')).toBeNull();
    expect(orderStatusFor('returned')).toBeNull();
  });
});

describe('the token', () => {
  it('is fetched once and reused', async () => {
    const { fetcher, calls } = stubUber([]);

    await accessToken({ clientId: 'a', clientSecret: 'b' }, fetcher);
    await accessToken({ clientId: 'a', clientSecret: 'b' }, fetcher);

    expect(calls.filter((call) => call.url.includes('auth.uber.com'))).toHaveLength(1);
  });

  it('is fetched again once it is close to expiring', async () => {
    const { fetcher, calls } = stubUber([]);
    const now = Date.now();

    await accessToken({ clientId: 'a', clientSecret: 'b' }, fetcher, now);
    // Thirty days on, well past the token and inside the renewal margin.
    await accessToken({ clientId: 'a', clientSecret: 'b' }, fetcher, now + 2_592_000_000);

    expect(calls.filter((call) => call.url.includes('auth.uber.com'))).toHaveLength(2);
  });

  it('does not hand one client another client’s token', async () => {
    const { fetcher, calls } = stubUber([]);

    await accessToken({ clientId: 'a', clientSecret: 'b' }, fetcher);
    await accessToken({ clientId: 'other', clientSecret: 'b' }, fetcher);

    expect(calls).toHaveLength(2);
  });

  it('is null rather than a throw when Uber refuses', async () => {
    const refusing = (async () => new Response('nope', { status: 401 })) as unknown as typeof fetch;
    expect(await accessToken({ clientId: 'a', clientSecret: 'b' }, refusing)).toBeNull();
  });

  it('is null when the network never answered', async () => {
    const broken = (async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;
    expect(await accessToken({ clientId: 'a', clientSecret: 'b' }, broken)).toBeNull();
  });
});

describe('asking for a driver', () => {
  const adapter = (fetcher: typeof fetch) =>
    uberDirectAdapter({
      clientId: 'a',
      clientSecret: 'b',
      customerId: 'cus_test',
      fetcher,
    });

  it('creates a delivery and keeps Uber’s id', async () => {
    const order = await aDeliveryOrder();
    const { fetcher } = stubUber([new Response(JSON.stringify({ id: 'del_123' }))]);

    const result = await adapter(fetcher).requestPickup(order);
    expect(result).toEqual({ ok: true, reference: 'del_123' });
  });

  /**
   * Uber deduplicates on this header. Without it a retried dispatch — a timeout
   * that actually succeeded — sends a second driver for the same food.
   */
  it('sends an idempotency key that is the order', async () => {
    const order = await aDeliveryOrder();
    const { fetcher, calls } = stubUber([new Response(JSON.stringify({ id: 'del_123' }))]);

    await adapter(fetcher).requestPickup(order);
    const dispatch = calls.find((call) => call.url.includes('/deliveries'));

    expect(new Headers(dispatch?.init.headers).get('Idempotency-Key')).toBe(order.id);
  });

  it('sends our order id so the webhook can find it again', async () => {
    const order = await aDeliveryOrder();
    const { fetcher, calls } = stubUber([new Response(JSON.stringify({ id: 'del_123' }))]);

    await adapter(fetcher).requestPickup(order);
    const dispatch = calls.find((call) => call.url.includes('/deliveries'));
    const body = JSON.parse(String(dispatch?.init.body));

    expect(body.external_id).toBe(order.id);
    expect(body.manifest_reference).toBe(order.orderNumber);
  });

  it('refuses an order with no address rather than sending half of one', async () => {
    const order = await aDeliveryOrder();
    const { fetcher, calls } = stubUber([]);

    const result = await adapter(fetcher).requestPickup({ ...order, suburb: null });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.retryable, 'it will be just as wrong next time').toBe(false);
    expect(calls.filter((call) => call.url.includes('/deliveries'))).toHaveLength(0);
  });

  /** A 4xx will be wrong again; a 5xx or a 429 is worth another go. */
  it('marks a refusal retryable only when retrying could help', async () => {
    const order = await aDeliveryOrder();

    for (const [status, retryable] of [
      [400, false],
      [422, false],
      [429, true],
      [500, true],
      [503, true],
    ] as const) {
      forgetTokens();
      const { fetcher } = stubUber([new Response('no', { status })]);
      const result = await adapter(fetcher).requestPickup(order);

      expect(result.ok).toBe(false);
      expect(!result.ok && result.retryable, `${status}`).toBe(retryable);
    }
  });

  it('treats a network that never answered as retryable', async () => {
    const order = await aDeliveryOrder();
    const broken = (async (url: string) => {
      if (String(url).includes('auth.uber.com')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3_600 }));
      }
      throw new Error('ETIMEDOUT');
    }) as unknown as typeof fetch;

    const result = await adapter(broken).requestPickup(order);
    expect(!result.ok && result.retryable).toBe(true);
  });

  /**
   * Accepted, but we cannot say by what. Not retryable — a retry creates a
   * second delivery — and loud, because a driver is on the way to an order
   * nothing here can track.
   */
  it('refuses without retrying when Uber returns no id', async () => {
    const order = await aDeliveryOrder();
    const { fetcher } = stubUber([new Response(JSON.stringify({ status: 'pending' }))]);

    const result = await adapter(fetcher).requestPickup(order);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.retryable).toBe(false);
  });

  it('only ever asks for one driver per order', async () => {
    const order = await aDeliveryOrder();
    const { fetcher, calls } = stubUber([
      new Response(JSON.stringify({ id: 'del_123' })),
      new Response(JSON.stringify({ id: 'del_456' })),
    ]);
    const courier = adapter(fetcher);

    await requestCourier(order, courier);
    await requestCourier(order, courier);

    expect(calls.filter((call) => call.url.includes('/deliveries'))).toHaveLength(1);
  });
});

describe('the webhook signature', () => {
  const body = JSON.stringify({ delivery_id: 'del_123', status: 'delivered' });

  it('accepts one Uber signed', () => {
    const headers = new Headers({ [UBER_SIGNATURE_HEADER]: signPayload(body, SIGNING_KEY) });
    expect(verifyWebhook(body, headers, SIGNING_KEY)).toBe(true);
  });

  it('refuses one signed with the wrong key', () => {
    const headers = new Headers({ [UBER_SIGNATURE_HEADER]: signPayload(body, 'wrong') });
    expect(verifyWebhook(body, headers, SIGNING_KEY)).toBe(false);
  });

  it('refuses one with no signature', () => {
    expect(verifyWebhook(body, new Headers(), SIGNING_KEY)).toBe(false);
  });

  /**
   * The reason this verifies raw bytes rather than a re-serialised object.
   *
   * The example that circulates for Uber webhooks hashes
   * `JSON.stringify(req.body)`, which usually round-trips and therefore usually
   * works — and fails on the first payload whose key order or escaping differs
   * from what the parser produced. Here the bytes are the same bytes.
   */
  it('is taken over the bytes that arrived, not a reserialisation of them', () => {
    /**
     * Three payloads that survive a parse and come back as different bytes.
     * Key order is not one of them — V8 preserves insertion order, which is
     * exactly why the re-serialising version passes a casual test and then
     * fails in production on something like these:
     *
     *   - whitespace, from any sender that pretty-prints
     *   - a unicode escape, which JSON.stringify resolves to the character
     *   - a trailing zero on a number, which it drops
     */
    for (const asSent of [
      '{"delivery_id": "del_123", "status": "delivered"}',
      '{"delivery_id":"del_123","dropoff_name":"Andr\\u00e9"}',
      '{"delivery_id":"del_123","dropoff_eta":12.0}',
    ]) {
      const reserialised = JSON.stringify(JSON.parse(asSent));
      expect(reserialised, `${asSent} round-tripped unchanged`).not.toBe(asSent);

      const headers = new Headers({ [UBER_SIGNATURE_HEADER]: signPayload(asSent, SIGNING_KEY) });
      expect(verifyWebhook(asSent, headers, SIGNING_KEY), 'the real bytes verify').toBe(true);
      expect(
        createHmac('sha256', SIGNING_KEY).update(reserialised).digest('hex'),
        'and the reserialised ones would not have',
      ).not.toBe(signPayload(asSent, SIGNING_KEY));
    }
  });
});

describe('reading the event', () => {
  it('reads a status change', () => {
    const event = parseDeliveryEvent(
      JSON.stringify({ delivery_id: 'del_1', status: 'delivered', external_id: 'O-1' }),
    );
    expect(event).toMatchObject({ deliveryId: 'del_1', status: 'delivered', orderId: 'O-1' });
  });

  it('reads one nested under data, which is the other shape they send', () => {
    const event = parseDeliveryEvent(
      JSON.stringify({ kind: 'event.delivery_status', data: { id: 'del_1', status: 'dropoff' } }),
    );
    expect(event).toMatchObject({ deliveryId: 'del_1', status: 'dropoff' });
  });

  it('has nothing for an event that is not a delivery moving', () => {
    expect(parseDeliveryEvent(JSON.stringify({ kind: 'event.refund' }))).toBeNull();
    expect(parseDeliveryEvent('not json')).toBeNull();
  });
});

describe('the courier webhook route', () => {
  async function post(body: string, key = SIGNING_KEY) {
    const before = { ...process.env };
    Object.assign(process.env, ENV);
    try {
      return await courierWebhook(
        new Request('http://localhost/api/couriers/webhook', {
          method: 'POST',
          headers: { [UBER_SIGNATURE_HEADER]: signPayload(body, key) },
          body,
        }),
      );
    } finally {
      for (const name of Object.keys(ENV)) delete process.env[name];
      Object.assign(process.env, before);
    }
  }

  it('refuses everything with no courier configured', async () => {
    const response = await courierWebhook(
      new Request('http://localhost/api/couriers/webhook', { method: 'POST', body: '{}' }),
    );
    expect(response.status).toBe(501);
  });

  it('refuses a forged signature', async () => {
    const order = await aDeliveryOrder();
    const body = JSON.stringify({ delivery_id: 'd', status: 'delivered', external_id: order.id });

    const response = await post(body, 'not-the-key');
    expect(response.status).toBe(401);
    expect(readOrder(order.id)?.status, 'and the order did not move').toBe('received');
  });

  it('moves the order out for delivery', async () => {
    const order = await aDeliveryOrder();
    const body = JSON.stringify({
      delivery_id: 'del_1',
      status: 'EN_ROUTE_TO_DROPOFF',
      external_id: order.id,
    });

    expect((await post(body)).status).toBe(200);
    expect(readOrder(order.id)?.status).toBe('out_for_delivery');
  });

  it('completes it on delivery', async () => {
    const order = await aDeliveryOrder();
    const body = JSON.stringify({
      delivery_id: 'del_1',
      status: 'delivered',
      external_id: order.id,
    });

    await post(body);
    expect(readOrder(order.id)?.status).toBe('completed');
  });

  it('leaves the order alone on a status it does not know', async () => {
    const order = await aDeliveryOrder();
    const body = JSON.stringify({
      delivery_id: 'del_1',
      status: 'TELEPORTED',
      external_id: order.id,
    });

    const response = await post(body);
    expect(response.status).toBe(200);
    expect(readOrder(order.id)?.status).toBe('received');
  });

  it('answers 200 for a delivery it has never heard of', async () => {
    const body = JSON.stringify({ delivery_id: 'del_nope', status: 'delivered' });
    expect((await post(body)).status).toBe(200);
  });
});

describe('choosing Uber', () => {
  it('needs all three credentials', () => {
    for (const missing of [
      'BBQ_UBER_CLIENT_ID',
      'BBQ_UBER_CLIENT_SECRET',
      'BBQ_UBER_CUSTOMER_ID',
    ]) {
      expect(activeCourier({ ...ENV, [missing]: undefined }), missing).toBeNull();
    }
  });

  it('is off unless it is named', () => {
    expect(activeCourier({ ...ENV, BBQ_COURIER_PROVIDER: undefined })).toBeNull();
    expect(activeCourier({ ...ENV, BBQ_COURIER_PROVIDER: 'bolt' })).toBeNull();
  });

  it('is on with everything set', () => {
    expect(activeCourier(ENV)?.name).toBe('uber-direct');
  });

  it('keeps the webhook key separate from the API credentials', () => {
    expect(courierWebhookSecret(ENV)).toBe(SIGNING_KEY);
    expect(courierWebhookSecret({ ...ENV, BBQ_UBER_WEBHOOK_SECRET: undefined })).toBeNull();
  });
});

/** Kept quiet: the route logs, and a test run should not print. */
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('the driver’s estimate', () => {
  async function post(body: string) {
    const before = { ...process.env };
    Object.assign(process.env, ENV);
    try {
      return await courierWebhook(
        new Request('http://localhost/api/couriers/webhook', {
          method: 'POST',
          headers: { [UBER_SIGNATURE_HEADER]: signPayload(body, SIGNING_KEY) },
          body,
        }),
      );
    } finally {
      for (const name of Object.keys(ENV)) delete process.env[name];
      Object.assign(process.env, before);
    }
  }

  const update = (orderId: string, over: Record<string, unknown>) =>
    JSON.stringify({ delivery_id: 'del_eta', external_id: orderId, ...over });

  /**
   * The one this exists for. Uber sends an estimate on every courier position
   * update; the route parsed it carefully and dropped it, so the journey showed
   * the window quoted at checkout — a constant — for as long as the customer
   * waited.
   */
  it('is recorded from a courier update that moves no state', async () => {
    const order = await aDeliveryOrder();

    await post(update(order.id, { status: 'courier_update', pickup_eta: 70 }));

    expect(readOrder(order.id)?.courierEtaMinutes).toBe(70);
  });

  it('replaces the previous one rather than keeping the first', async () => {
    const order = await aDeliveryOrder();

    await post(update(order.id, { status: 'courier_update', pickup_eta: 70 }));
    await post(update(order.id, { status: 'courier_update', pickup_eta: 35 }));

    expect(readOrder(order.id)?.courierEtaMinutes).toBe(35);
  });

  it('leaves it alone when an event carries none', async () => {
    const order = await aDeliveryOrder();

    await post(update(order.id, { status: 'courier_update', pickup_eta: 70 }));
    await post(update(order.id, { status: 'pickup' }));

    expect(readOrder(order.id)?.courierEtaMinutes).toBe(70);
  });

  /**
   * A late webhook after the food arrived. Putting a wait back on a delivered
   * order is how a finished order starts counting down again.
   */
  it('is not put back onto a completed order', async () => {
    const order = await aDeliveryOrder();
    setOrderStatus(order.id, 'completed');

    await post(update(order.id, { status: 'courier_update', pickup_eta: 70 }));

    expect(readOrder(order.id)?.courierEtaMinutes).toBeNull();
  });

  it('is null on an order no courier has touched', async () => {
    const order = await aDeliveryOrder();
    expect(readOrder(order.id)?.courierEtaMinutes).toBeNull();
  });
});
