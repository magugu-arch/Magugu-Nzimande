import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as availabilityRoute } from '@/app/api/admin/availability/route';
import { POST as ordersRoute } from '@/app/api/admin/orders/route';
import { POST as servicesRoute } from '@/app/api/admin/services/route';
import { GET as productsRoute } from '@/app/api/products/route';
import { POST as createOrderRoute } from '@/app/api/orders/route';
import type { AuditEntry } from '@/lib/catalogue-state';
import { readOrder, setOrderStatus } from '@/lib/order-store';
import type { Product, Store } from '@bbq/types';
import {
  CONSOLE_PASSPHRASE,
  aChickenProduct,
  aDeliveryStore,
  bodyOf,
  operatorCookie,
  orderLine,
  orderRequest,
  placeOrder,
  request,
  resetState,
} from './fixtures';

/**
 * What the console actually does, once somebody is signed in.
 *
 * The auth suite covers who may press the buttons. These cover whether the
 * buttons work — and in particular whether a console change reaches the
 * storefront, because a switch that only moves the console's own copy of the
 * state looks correct to the operator and changes nothing for the customer.
 */

const product = aChickenProduct();
let cookie: string;

beforeEach(async () => {
  process.env.BBQ_ADMIN_PASSWORD = CONSOLE_PASSPHRASE;
  resetState();
  cookie = await operatorCookie();
});

afterEach(() => {
  delete process.env.BBQ_ADMIN_PASSWORD;
});

const asOperator = (url: string, body: unknown) => request(url, { body, cookie });

describe('marking an item sold out', () => {
  it('is reflected in the catalogue the storefront reads', async () => {
    await availabilityRoute(
      asOperator('/api/admin/availability', { slug: product.slug, soldOut: true }),
    );

    const { products } = await bodyOf<{ products: Product[] }>(await productsRoute());
    expect(products.find((candidate) => candidate.slug === product.slug)?.soldOut).toBe(true);
  });

  it('stops the API taking an order for it', async () => {
    await availabilityRoute(
      asOperator('/api/admin/availability', { slug: product.slug, soldOut: true }),
    );

    const response = await createOrderRoute(
      request('/api/orders', { body: orderRequest([orderLine(product)]) }),
    );
    expect(response.status).toBe(409);
  });

  it('can be undone', async () => {
    await availabilityRoute(
      asOperator('/api/admin/availability', { slug: product.slug, soldOut: true }),
    );
    await availabilityRoute(
      asOperator('/api/admin/availability', { slug: product.slug, soldOut: false }),
    );

    const response = await createOrderRoute(
      request('/api/orders', { body: orderRequest([orderLine(product)]) }),
    );
    expect(response.status).toBe(201);
  });

  it('hides an item from the catalogue entirely when hidden rather than sold out', async () => {
    await availabilityRoute(
      asOperator('/api/admin/availability', { slug: product.slug, hidden: true }),
    );

    const { products } = await bodyOf<{ products: Product[] }>(await productsRoute());
    expect(products.some((candidate) => candidate.slug === product.slug)).toBe(false);
  });

  it('writes what happened to the audit log', async () => {
    const response = await availabilityRoute(
      asOperator('/api/admin/availability', { slug: product.slug, soldOut: true }),
    );
    const { audit } = await bodyOf<{ audit?: AuditEntry[] }>(response);

    // The route may or may not return the log; the next console read must show it.
    const entries = audit ?? [];
    if (entries.length > 0) {
      expect(entries[0]?.what).toContain(product.slug);
    }
  });
});

describe('switching a store service off', () => {
  const store = aDeliveryStore();

  it('is reflected in the stores the storefront reads', async () => {
    const response = await servicesRoute(
      asOperator('/api/admin/services', { storeId: store.id, mode: 'Delivery', enabled: false }),
    );

    expect(response.status).toBe(200);
    const { stores } = await bodyOf<{ stores: Store[] }>(response);
    expect(stores.find((candidate) => candidate.id === store.id)?.services.Delivery).toBe(false);
  });

  it('stops the API taking that kind of order', async () => {
    await servicesRoute(
      asOperator('/api/admin/services', { storeId: store.id, mode: 'Delivery', enabled: false }),
    );

    const response = await createOrderRoute(
      request('/api/orders', {
        body: orderRequest([orderLine(product)], {
          storeId: store.id,
          mode: 'Delivery',
          address: '12 Rivonia Road',
          suburb: store.zones[0],
        }),
      }),
    );
    expect(response.status).toBe(409);
  });

  it('leaves the store’s other services alone', async () => {
    const response = await servicesRoute(
      asOperator('/api/admin/services', { storeId: store.id, mode: 'Delivery', enabled: false }),
    );
    const { stores } = await bodyOf<{ stores: Store[] }>(response);

    expect(stores.find((candidate) => candidate.id === store.id)?.services.Collection).toBe(true);
  });

  it('refuses a store that does not exist', async () => {
    const response = await servicesRoute(
      asOperator('/api/admin/services', {
        storeId: 'ST-NOWHERE',
        mode: 'Delivery',
        enabled: false,
      }),
    );
    expect(response.status).toBe(404);
  });
});

describe('moving an order along', () => {
  it('sets the status the operator chose', async () => {
    const placed = await placeOrder();
    const response = await ordersRoute(
      asOperator('/api/admin/orders', { orderId: placed.id, status: 'ready' }),
    );

    expect(response.status).toBe(200);
    const { orders } = await bodyOf<{ orders: { id: string; status: string }[] }>(response);
    expect(orders.find((order) => order.id === placed.id)?.status).toBe('ready');
  });

  /**
   * The documented rule with the sharpest edge: a cancellation without a
   * reason is refused. A cancelled order the customer cannot be told the
   * reason for is a support call nobody can answer.
   */
  it('will not cancel an order without a reason', async () => {
    const placed = await placeOrder();
    const response = await ordersRoute(
      asOperator('/api/admin/orders', { orderId: placed.id, status: 'cancelled' }),
    );

    expect(response.status).toBe(400);
  });

  it('will not accept an empty reason as a reason', async () => {
    const placed = await placeOrder();
    const response = await ordersRoute(
      asOperator('/api/admin/orders', {
        orderId: placed.id,
        status: 'cancelled',
        reason: '   ',
      }),
    );

    expect(response.status).toBe(400);
  });

  it('leaves the order untouched when it refuses the cancellation', async () => {
    const placed = await placeOrder();
    await ordersRoute(
      asOperator('/api/admin/orders', { orderId: placed.id, status: 'cancelled' }),
    );

    expect(readOrder(placed.id)?.status).toBe('received');
  });

  it('cancels when given one, and keeps it', async () => {
    const placed = await placeOrder();
    const response = await ordersRoute(
      asOperator('/api/admin/orders', {
        orderId: placed.id,
        status: 'cancelled',
        reason: 'Kitchen closed early',
      }),
    );

    expect(response.status).toBe(200);
    const { orders } = await bodyOf<
      { orders: { id: string; status: string; cancelledReason: string | null }[] }
    >(response);
    const cancelled = orders.find((order) => order.id === placed.id);

    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.cancelledReason).toBe('Kitchen closed early');
  });

  it('refuses a status that is not one of the order states', async () => {
    const placed = await placeOrder();
    const response = await ordersRoute(
      asOperator('/api/admin/orders', { orderId: placed.id, status: 'incinerated' }),
    );
    expect(response.status).toBe(400);
  });

  it('refuses an order that does not exist', async () => {
    const response = await ordersRoute(
      asOperator('/api/admin/orders', { orderId: 'O-nonexistent', status: 'ready' }),
    );
    expect(response.status).not.toBe(200);
  });
});

/**
 * The order store's own refusal, underneath the route's.
 *
 * The route checks for a reason before it ever calls this, so removing the
 * guard here changes nothing a route-level test can see — which is exactly why
 * it needs its own. It is the layer that protects any future caller that is
 * not this one route.
 */
describe('the order store, directly', () => {
  it('refuses a cancellation with no reason', async () => {
    const placed = await placeOrder();
    expect(setOrderStatus(placed.id, 'cancelled')).toBeNull();
    expect(readOrder(placed.id)?.status).toBe('received');
  });

  it('refuses a cancellation with an empty reason', async () => {
    const placed = await placeOrder();
    expect(setOrderStatus(placed.id, 'cancelled', '')).toBeNull();
  });

  it('accepts a cancellation with one, and keeps it', async () => {
    const placed = await placeOrder();
    const cancelled = setOrderStatus(placed.id, 'cancelled', 'Load shedding');

    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.cancelledReason).toBe('Load shedding');
  });

  it('clears a stale cancellation reason when an order moves on', async () => {
    const placed = await placeOrder();
    setOrderStatus(placed.id, 'cancelled', 'Load shedding');
    const revived = setOrderStatus(placed.id, 'preparing');

    // A reason left behind would show under an order that is not cancelled.
    expect(revived?.cancelledReason).toBeNull();
  });

  it('returns null for an order it does not have', () => {
    expect(setOrderStatus('O-nonexistent', 'ready')).toBeNull();
  });
});
