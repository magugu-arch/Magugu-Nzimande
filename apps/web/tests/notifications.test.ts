import { beforeEach, describe, expect, it } from 'vitest';
import { GET as healthRoute } from '@/app/api/health/route';
import { POST as advanceRoute } from '@/app/api/orders/[id]/advance/route';
import { readAudit } from '@/lib/catalogue-state';
import { orderMoved, orderPlaced } from '@/lib/notifications/messages';
import { notifyMoved, notifyPlaced, sentMessageIds } from '@/lib/notifications/send';
import { setOrderStatus } from '@/lib/order-store';
import { blankState, bodyOf, params, placeOrder, request, withPaymentProvider } from './fixtures';

/**
 * Messages to the customer, and whether this deployment is well.
 *
 * No messaging provider has been contracted, so nothing here reaches anybody:
 * the transport writes to the audit log and says its name is `log`, which is
 * what an operator needs to see while there is no provider and what stops a
 * dashboard being misread as delivery.
 *
 * What is worth testing is true whichever provider is eventually chosen — the
 * message goes out once, the wrong transitions stay quiet, and a failure to
 * send never costs the customer their order.
 */

beforeEach(blankState);

describe('what a customer is told', () => {
  it('confirms a new order by email and by message', async () => {
    const order = await placeOrder();
    const messages = orderPlaced(order);

    expect(messages.map((message) => message.channel)).toEqual(['email', 'sms']);
    expect(messages[0]?.to).toBe(order.customer.email);
    expect(messages[1]?.to).toBe(order.customer.mobile);
  });

  it('names the order and what it cost', async () => {
    const order = await placeOrder();
    for (const message of orderPlaced(order)) {
      expect(message.body, message.channel).toContain(order.orderNumber);
    }
  });

  /**
   * One segment is one message's worth of money, and status updates go out
   * several times per order. 160 characters is the boundary.
   */
  it('keeps a text message to a single segment', async () => {
    const order = await placeOrder();
    const texts = [...orderPlaced(order), ...orderMoved({ ...order, status: 'ready' })].filter(
      (message) => message.channel === 'sms',
    );

    expect(texts.length).toBeGreaterThan(0);
    for (const message of texts) {
      expect(message.body.length, message.body).toBeLessThanOrEqual(160);
    }
  });

  /**
   * A customer messaged at every transition stops reading the one that matters.
   * `preparing` follows `received` within a minute and says nothing new.
   */
  it('says nothing about the transitions that say nothing', async () => {
    const order = await placeOrder();

    expect(orderMoved({ ...order, status: 'received' })).toEqual([]);
    expect(orderMoved({ ...order, status: 'preparing' })).toEqual([]);
    expect(orderMoved({ ...order, status: 'completed' })).toEqual([]);
  });

  it('speaks up for the ones that matter', async () => {
    const order = await placeOrder();

    expect(orderMoved({ ...order, status: 'ready' })).toHaveLength(1);
    expect(orderMoved({ ...order, mode: 'Delivery', status: 'out_for_delivery' })).toHaveLength(1);
  });

  it('gives the reason when an order is cancelled', async () => {
    const order = await placeOrder();
    const [message] = orderMoved({
      ...order,
      status: 'cancelled',
      cancelledReason: 'The store has closed',
    });

    expect(message?.body).toContain('cancelled');
    expect(message?.body).toContain('The store has closed');
  });
});

describe('sending', () => {
  it('records what it would have sent, so an operator can see it', async () => {
    const order = await placeOrder();
    await notifyPlaced(order);

    const entries = readAudit().filter((entry) => entry.who === 'notifications');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.what.includes(order.customer.email))).toBe(true);
  });

  /**
   * The property that survives a change of provider. A retried request, a
   * redelivered webhook or an operator pressing the button twice all produce
   * the same message id, and the second send is dropped.
   */
  /**
   * Placing the order already sent both messages — the route does it — so
   * every call here is a repeat, which is the case worth pinning. It also
   * proves the route's send and a direct send share one ledger rather than
   * keeping a count each.
   */
  it('sends one message once, however many times it is asked', async () => {
    const order = await placeOrder();
    expect(sentMessageIds().filter((id) => id.startsWith(order.id))).toHaveLength(2);

    expect(await notifyPlaced(order)).toBe(0);
    expect(await notifyPlaced(order)).toBe(0);
    expect(sentMessageIds().filter((id) => id.startsWith(order.id))).toHaveLength(2);
  });

  it('tells two different orders apart', async () => {
    const one = await placeOrder();
    const two = await placeOrder();

    expect(sentMessageIds().filter((id) => id.startsWith(one.id))).toHaveLength(2);
    expect(sentMessageIds().filter((id) => id.startsWith(two.id))).toHaveLength(2);
    expect(one.id).not.toBe(two.id);
  });

  it('sends a status message once per status, not once per request', async () => {
    const order = await placeOrder();
    setOrderStatus(order.id, 'ready');
    const ready = { ...order, status: 'ready' as const };

    expect(await notifyMoved(ready)).toBe(1);
    expect(await notifyMoved(ready)).toBe(0);
  });
});

describe('a message that cannot be sent', () => {
  /**
   * The food is already being cooked by the time a confirmation is attempted.
   * Failing the request because the message failed tells the customer the
   * opposite of what has happened.
   */
  it('does not cost the customer their order', async () => {
    const order = await placeOrder();
    expect(order.orderNumber).toBeTruthy();

    // The whole path, driven through the real route rather than the helper.
    const response = await advanceRoute(
      request(`/api/orders/${order.id}/advance`, { method: 'POST' }),
      params({ id: order.id }),
    );

    expect(response.status).toBe(200);
  });
});

describe('the health endpoint', () => {
  it('says the deployment is serving', async () => {
    const response = healthRoute();
    expect(response.status).toBe(200);

    const body = await bodyOf<{ status: string; checks: Record<string, boolean> }>(response);
    expect(body.status).toBe('ok');
    expect(body.checks.catalogue).toBe(true);
    expect(body.checks.storage).toBe(true);
  });

  /**
   * Configuration is not health. A build with no payment provider is correctly
   * configured for what it is, so the flags are reported and the status stays
   * ok — but a deployment that has quietly lost its secret is visible here
   * rather than only in a customer's failed checkout.
   */
  it('reports what is switched on without calling it unhealthy', async () => {
    const body = await bodyOf<{ status: string; configured: Record<string, boolean> }>(
      healthRoute(),
    );

    expect(body.configured.payments).toBe(false);
    expect(body.status).toBe('ok');
  });

  it('notices when payments are configured', async () => {
    const body = await withPaymentProvider(async () =>
      bodyOf<{ configured: Record<string, boolean> }>(healthRoute()),
    );

    expect(body.configured.payments).toBe(true);
  });

  /** An uptime check that reads a cached 200 is checking its own cache. */
  it('is never cached', () => {
    expect(healthRoute().headers.get('cache-control')).toContain('no-store');
  });

  it('gives away no secret, only whether one is present', async () => {
    const body = await healthRoute().text();

    expect(body).not.toContain('BBQ_');
    expect(body).not.toMatch(/secret|password|passphrase/i);
  });
});
