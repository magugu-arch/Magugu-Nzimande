import { statesForMode } from '@bbq/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST as advanceRoute } from '@/app/api/orders/[id]/advance/route';
import { GET as orderRoute } from '@/app/api/orders/[id]/route';
import { POST as intentRoute } from '@/app/api/payments/intent/route';
import { POST as webhookRoute } from '@/app/api/payments/webhook/route';
import { aDeliveryStore, bodyOf, params, placeOrder, request, resetState } from './fixtures';

/**
 * What a customer sees after they have paid: the journey screen's endpoint,
 * and the kitchen stand-in that moves an order along.
 */

type OrderBody = { order: { id: string; status: string; mode: string }; statusLabel: string };

beforeEach(resetState);

describe('GET /api/orders/:id', () => {
  it('serves an order the API actually created', async () => {
    const placed = await placeOrder();
    const response = await orderRoute(
      request(`/api/orders/${placed.id}`),
      params({ id: placed.id }),
    );

    expect(response.status).toBe(200);
    const body = await bodyOf<OrderBody>(response);
    expect(body.order.id).toBe(placed.id);
    expect(body.statusLabel).toBeTruthy();
  });

  it('starts an order at received', async () => {
    const placed = await placeOrder();
    expect(placed.status).toBe('received');
  });

  it('is a 404 for an order id nobody placed', async () => {
    const response = await orderRoute(
      request('/api/orders/O-nonexistent'),
      params({ id: 'O-nonexistent' }),
    );
    expect(response.status).toBe(404);
  });
});

describe('POST /api/orders/:id/advance', () => {
  const advance = (id: string) =>
    advanceRoute(request(`/api/orders/${id}/advance`, { body: {} }), params({ id }));

  it('moves an order to its next state', async () => {
    const placed = await placeOrder();
    const body = await bodyOf<OrderBody>(await advance(placed.id));

    expect(body.order.status).toBe('preparing');
  });

  /**
   * A delivery order goes out for delivery; a collection order never does.
   * Walking the whole ladder is the check that the two modes really do take
   * different paths rather than sharing one and relabelling the end.
   */
  it('walks a collection order to its end without a courier step', async () => {
    const placed = await placeOrder({ mode: 'Collection' });
    const seen: string[] = [placed.status];

    for (let step = 0; step < 6; step += 1) {
      const body = await bodyOf<OrderBody>(await advance(placed.id));
      if (seen[seen.length - 1] === body.order.status) break;
      seen.push(body.order.status);
    }

    expect(seen).toEqual(statesForMode('Collection'));
    expect(seen).not.toContain('out_for_delivery');
  });

  it('walks a delivery order through out_for_delivery', async () => {
    const store = aDeliveryStore();
    const placed = await placeOrder({
      storeId: store.id,
      mode: 'Delivery',
      address: '12 Rivonia Road',
      suburb: store.zones[0],
    });

    const seen: string[] = [placed.status];
    for (let step = 0; step < 6; step += 1) {
      const body = await bodyOf<OrderBody>(await advance(placed.id));
      if (seen[seen.length - 1] === body.order.status) break;
      seen.push(body.order.status);
    }

    expect(seen).toEqual(statesForMode('Delivery'));
  });

  it('stays at the end rather than falling off it', async () => {
    const placed = await placeOrder({ mode: 'Collection' });
    for (let step = 0; step < 10; step += 1) await advance(placed.id);

    const body = await bodyOf<OrderBody>(await advance(placed.id));
    expect(body.order.status).toBe('completed');
  });

  it('is a 404 for an order that does not exist', async () => {
    expect((await advance('O-nonexistent')).status).toBe(404);
  });
});

describe('the payment endpoints', () => {
  /**
   * These answer 501 on purpose: no provider is selected and no merchant
   * credentials exist. A plausible-looking success here is how a build gets
   * mistaken for a live integration, so the refusal is the feature.
   */
  it('refuse to create a payment intent', async () => {
    const response = await intentRoute();
    expect(response.status).toBe(501);

    const body = await bodyOf<{ error: string }>(response);
    expect(body.error).toMatch(/no payment provider/i);
  });

  it('refuse to accept a webhook', async () => {
    expect((await webhookRoute()).status).toBe(501);
  });

  it('never answer as though a payment had succeeded', async () => {
    const body = JSON.stringify(await bodyOf(await intentRoute()));
    expect(body).not.toMatch(/"(status|state)"\s*:\s*"(succeeded|paid|authorised|authorized)"/i);
  });
});
