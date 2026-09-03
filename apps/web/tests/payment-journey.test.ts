import { readFileSync } from 'node:fs';
import path from 'node:path';
import { kitchenMayStart } from '@bbq/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { GET as orderRoute } from '@/app/api/orders/[id]/route';
import { POST as advanceRoute } from '@/app/api/orders/[id]/advance/route';
import { POST as intentRoute } from '@/app/api/payments/intent/route';
import { payfastProvider } from '@/lib/payments/payfast/provider';
import { intentForOrder, settle } from '@/lib/payments/ledger';
import {
  blankState,
  bodyOf,
  params,
  placeOrder,
  request,
  withPayfast,
  withPaymentProvider,
  withoutPaymentProvider,
} from './fixtures';

/**
 * The journey from a placed order to a paid one.
 *
 * The payment stack was built and tested before anything called it: checkout
 * had "no payment provider is configured" written into its markup, the order
 * endpoint said nothing about money, and nothing anywhere sent a customer to a
 * gateway. These cover the joins — that an order screen is told what the
 * payment is doing, that an unpaid order is not cooked, and that a customer
 * coming back from the gateway lands on their own order.
 */

beforeEach(blankState);

type StatusBody = { order: { status: string }; payment: { required: boolean; status: string | null } };

const orderStatus = async (id: string): Promise<StatusBody> =>
  bodyOf<StatusBody>(await orderRoute(request(`http://localhost/api/orders/${id}`), params({ id })));

/** Opens a payment for an order, the way the checkout screen does. */
const openIntentFor = (orderId: string) =>
  intentRoute(
    request('http://localhost/api/payments/intent', { method: 'POST', body: { orderId } }),
  );

/**
 * Opens a payment and settles it, as a gateway callback would.
 *
 * A helper rather than the same nine lines three times, and it throws by name
 * when there is no intent: the alternative is a non-null assertion, which turns
 * "the intent was never opened" into an unrelated failure two lines later.
 */
async function settleFor(orderId: string, status: 'captured' | 'failed'): Promise<void> {
  await openIntentFor(orderId);
  const intent = intentForOrder(orderId);
  if (!intent) throw new Error(`No intent was opened for ${orderId}`);

  settle({
    id: `evt_${status}`,
    intentId: intent.id,
    status,
    providerRef: 'pf_1',
    amountCents: intent.amountCents,
    failureReason: status === 'failed' ? 'PayFast reported FAILED' : null,
  });
}

describe('what the order endpoint says about money', () => {
  it('reports payment as not required when no gateway is configured', async () => {
    const order = await placeOrder();

    const body = await withoutPaymentProvider(() => orderStatus(order.id));

    expect(body.payment).toEqual({ required: false, status: null });
  });

  /**
   * The distinction the two fields exist for. Without `required`, a build with
   * no gateway and an order nobody has paid for are the same null, and they
   * want opposite words on the screen.
   */
  it('tells a build with no gateway apart from an order nobody has paid', async () => {
    const order = await placeOrder();

    const unconfigured = await withoutPaymentProvider(() => orderStatus(order.id));
    const unpaid = await withPaymentProvider(() => orderStatus(order.id));

    expect(unconfigured.payment).toEqual({ required: false, status: null });
    expect(unpaid.payment).toEqual({ required: true, status: null });
  });

  it('reports the intent once one is open', async () => {
    const order = await placeOrder();

    const body = await withPaymentProvider(async () => {
      await openIntentFor(order.id);
      return orderStatus(order.id);
    });

    expect(body.payment).toEqual({ required: true, status: 'pending' });
  });

  it('reports it captured once the gateway has settled', async () => {
    const order = await placeOrder();

    const body = await withPaymentProvider(async () => {
      await settleFor(order.id, 'captured');
      return orderStatus(order.id);
    });

    expect(body.payment).toEqual({ required: true, status: 'captured' });
  });
});

describe('the kitchen and the money', () => {
  it('refuses to advance an order whose payment has not arrived', async () => {
    const order = await placeOrder();

    const response = await withPaymentProvider(() =>
      advanceRoute(request(`http://localhost/api/orders/${order.id}/advance`, { method: 'POST' }), params({ id: order.id })),
    );

    expect(response.status).toBe(409);
    const after = await withPaymentProvider(() => orderStatus(order.id));
    expect(after.order.status).toBe('received');
  });

  it('advances once the payment is captured', async () => {
    const order = await placeOrder();

    const response = await withPaymentProvider(async () => {
      await settleFor(order.id, 'captured');
      return advanceRoute(
        request(`http://localhost/api/orders/${order.id}/advance`, { method: 'POST' }),
        params({ id: order.id }),
      );
    });

    expect(response.status).toBe(200);
    expect((await bodyOf<StatusBody>(response)).order.status).toBe('preparing');
  });

  /** The demonstration build has to keep cooking, or there is nothing to show. */
  it('advances freely when no gateway is configured', async () => {
    const order = await placeOrder();

    const response = await withoutPaymentProvider(() =>
      advanceRoute(request(`http://localhost/api/orders/${order.id}/advance`, { method: 'POST' }), params({ id: order.id })),
    );

    expect(response.status).toBe(200);
  });

  it('does not cook an order whose payment failed', async () => {
    const order = await placeOrder();

    const response = await withPaymentProvider(async () => {
      await settleFor(order.id, 'failed');
      return advanceRoute(
        request(`http://localhost/api/orders/${order.id}/advance`, { method: 'POST' }),
        params({ id: order.id }),
      );
    });

    expect(response.status).toBe(409);
  });
});

describe('the rule itself', () => {
  it('lets an unconfigured deployment through and holds a configured one', () => {
    expect(kitchenMayStart({ required: false, status: null })).toBe(true);
    expect(kitchenMayStart({ required: false, status: 'pending' })).toBe(true);
    expect(kitchenMayStart({ required: true, status: null })).toBe(false);
    expect(kitchenMayStart({ required: true, status: 'pending' })).toBe(false);
    expect(kitchenMayStart({ required: true, status: 'captured' })).toBe(true);
  });

  /** Authorised is not captured. The money is promised, not taken. */
  it('does not treat an authorised payment as paid', () => {
    expect(kitchenMayStart({ required: true, status: 'authorised' })).toBe(false);
  });

  it('does not cook a refunded order', () => {
    expect(kitchenMayStart({ required: true, status: 'refunded' })).toBe(false);
  });
});

describe('where the gateway sends the customer back', () => {
  const config = {
    merchantId: '10000100',
    merchantKey: 'key',
    passphrase: 'pass',
    sandbox: true,
    returnUrl: 'https://example.test/journey?payment=done',
    cancelUrl: 'https://example.test/checkout?payment=cancelled',
    notifyUrl: 'https://example.test/api/payments/webhook',
  };

  const urlFieldsOf = async (over: Record<string, string> = {}) => {
    const result = await payfastProvider(config).createIntent({
      reference: 'pi_1',
      amountCents: 12_900,
      currency: 'ZAR',
      description: 'bb.q Chicken order BBQ-1',
      ...over,
    });
    if (!result.ok) throw new Error('createIntent refused');
    if (!result.redirectUrl) throw new Error('PayFast is a redirect gateway; there should be a URL');
    const query = new URL(result.redirectUrl).searchParams;
    return { ret: query.get('return_url'), cancel: query.get('cancel_url') };
  };

  it('uses the caller’s per-order URLs when it is given them', async () => {
    const { ret, cancel } = await urlFieldsOf({
      returnUrl: 'https://example.test/journey?order=O-7&payment=done',
      cancelUrl: 'https://example.test/journey?order=O-7&payment=cancelled',
    });

    expect(ret).toContain('order=O-7');
    expect(cancel).toContain('order=O-7');
  });

  it('falls back to the deployment’s own URLs when it is not', async () => {
    const { ret, cancel } = await urlFieldsOf();

    expect(ret).toBe(config.returnUrl);
    expect(cancel).toBe(config.cancelUrl);
  });

  /**
   * The reason the cancel URL is per-order at all. The order is placed and the
   * basket cleared before the handover, so a cancel that lands on checkout
   * shows an empty basket while a real unpaid order sits behind it.
   */
  it('sends a cancelling customer to their order rather than to an empty basket', async () => {
    const { cancel } = await urlFieldsOf({
      cancelUrl: 'https://example.test/journey?order=O-7&payment=cancelled',
    });

    expect(cancel).not.toContain('/checkout');
    expect(cancel).toContain('/journey');
  });
});

describe('the intent route’s return URLs', () => {
  it('names the order being paid for, so the customer comes back to it', async () => {
    const order = await placeOrder();

    const body = await withPayfast(async () =>
      bodyOf(
        await intentRoute(
          request('http://localhost/api/payments/intent', {
            method: 'POST',
            body: { orderId: order.id },
          }),
        ),
      ),
    );

    const query = new URL(body.redirectUrl as string).searchParams;
    expect(query.get('return_url')).toContain(`order=${order.id}`);
    expect(query.get('cancel_url')).toContain(`order=${order.id}`);
  });
});

/**
 * The screens, scanned rather than rendered.
 *
 * The suite runs in node with no DOM, so these read the source the way
 * `accessibility.test.ts` does. Modest on purpose: they cannot prove the flow
 * works, only that the specific things that were wrong have not come back —
 * a checkout that asserts there is no gateway whatever the deployment says, and
 * screens that never call the payment endpoint at all.
 */
describe('the screens are actually joined up', () => {
  const sourceOf = (file: string) =>
    readFileSync(path.resolve(__dirname, '../src', file), 'utf8');

  const checkout = sourceOf('components/checkout/CheckoutFlow.tsx');
  const journey = sourceOf('components/journey/OrderJourney.tsx');
  const checkoutPage = sourceOf('app/checkout/page.tsx');

  it('checkout opens a payment rather than only placing an order', () => {
    expect(checkout).toContain('openPayment');
  });

  /**
   * The defect this whole workstream started from: the panel said no provider
   * was configured no matter what the deployment had, so configuring one
   * changed nothing a customer could see.
   */
  it('checkout decides what to say from the deployment, not from a constant', () => {
    expect(checkout).toContain('paymentConfigured');
    const claim = checkout.indexOf('No payment provider is configured');
    expect(claim).toBeGreaterThan(-1);
    expect(checkout.slice(0, claim)).toContain('paymentConfigured ?');
  });

  it('the checkout page reads the real configuration on the server', () => {
    expect(checkoutPage).toContain('isPaymentConfigured');
    // Prerendering it would bake one deployment's answer into the markup.
    expect(checkoutPage).toContain("dynamic = 'force-dynamic'");
  });

  it('the journey asks the server what the payment is doing', () => {
    expect(journey).toContain('fetchOrder');
    expect(journey).toContain('kitchenMayStart');
  });

  it('the journey offers a way to pay for an order that is not paid', () => {
    expect(journey).toContain('openPayment');
  });
});
