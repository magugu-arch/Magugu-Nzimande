import { beforeEach, describe, expect, it } from 'vitest';
import { readState } from '@/lib/demo-state';
import { POST as intentRoute } from '@/app/api/payments/intent/route';
import { POST as webhookRoute } from '@/app/api/payments/webhook/route';
import { intentForOrder, listIntents, openIntent, settle } from '@/lib/payments/ledger';
import { signBody } from '@/lib/payments/provider';
import { activeProvider, isPaymentConfigured } from '@/lib/payments/registry';
import { SANDBOX_SIGNATURE_HEADER } from '@/lib/payments/sandbox-provider';
import { setOrderStatus } from '@/lib/order-store';
import {
  PAYMENT_SECRET,
  blankState,
  bodyOf,
  forgedWebhook,
  placeOrder,
  request,
  signedWebhook,
  withPaymentProvider,
  withoutPaymentProvider,
} from './fixtures';

/**
 * The payment seam.
 *
 * No gateway has been selected and no merchant credentials exist, so what is
 * covered here is everything that is true whatever gateway is eventually
 * chosen: the amount comes off the order, the callback is verified before it is
 * believed, and a redelivered event settles once.
 *
 * The endpoints still answer 501 on this deployment. That refusal is tested
 * first and hardest, because a build with no merchant account must refuse
 * payment visibly rather than accept it plausibly.
 */

beforeEach(blankState);

describe('with no provider configured', () => {
  it('is not configured, which is what this deployment is', () => {
    expect(isPaymentConfigured({})).toBe(false);
    expect(activeProvider({})).toBeNull();
  });

  it('refuses to open an intent, and says why', async () => {
    const response = await withoutPaymentProvider(() =>
      intentRoute(request('/api/payments/intent', { body: { orderId: 'anything' } })),
    );

    expect(response.status).toBe(501);
    expect((await bodyOf(response)).error).toBe('No payment provider is configured');
  });

  /**
   * Refused before the signature is even looked at. With nothing configured
   * there is no secret to check against, so a build that tried would be
   * checking a callback against the empty string.
   */
  it('refuses a callback, however well signed', async () => {
    const response = await withoutPaymentProvider(() =>
      webhookRoute(signedWebhook({ id: 'evt_1', intentId: 'pi_1', status: 'captured' })),
    );

    expect(response.status).toBe(501);
  });

  /**
   * A named provider with no secret cannot verify a callback, which would leave
   * the webhook open to anyone who found the path. Treated as switched off
   * rather than half on.
   */
  it('treats a provider with no secret as no provider', () => {
    expect(
      isPaymentConfigured({ BBQ_PAYMENT_PROVIDER: 'sandbox' }),
    ).toBe(false);
    expect(isPaymentConfigured({ BBQ_PAYMENT_SECRET: 'shh' })).toBe(false);
  });

  /** A typo in a deployment variable should stop payments, not pick a gateway. */
  it('refuses a provider name nobody has written an adapter for', () => {
    expect(
      activeProvider({
        BBQ_PAYMENT_PROVIDER: 'payfost',
        BBQ_PAYMENT_SECRET: 'shh',
      }),
    ).toBeNull();
  });
});

describe('opening a payment', () => {
  it('takes the amount off the order, not off the request', async () => {
    const order = await placeOrder();
    const opened = openIntent(order.id, 'sandbox');

    expect(opened.ok).toBe(true);
    expect(opened.ok && opened.intent.amountCents).toBe(order.totals.totalCents);
  });

  /**
   * The reason `CreatePaymentIntentRequestSchema` has one field. There is no
   * amount to tamper with because there is nowhere to put one — the same
   * lesson as the order route, which once accepted a client's line prices and
   * would take a valid order totalling a cent.
   */
  it('ignores an amount a caller tries to smuggle in', async () => {
    const order = await placeOrder();

    const response = await withPaymentProvider(() =>
      intentRoute(
        request('/api/payments/intent', {
          body: { orderId: order.id, amountCents: 1, totalCents: 1 },
        }),
      ),
    );

    expect(response.status).toBe(200);
    const { intent } = await bodyOf<{ intent: { amountCents: number } }>(response);
    expect(intent.amountCents).toBe(order.totals.totalCents);
  });

  it('hands back the same intent when the customer reloads', async () => {
    const order = await placeOrder();
    const first = openIntent(order.id, 'sandbox');
    const second = openIntent(order.id, 'sandbox');

    expect(first.ok && second.ok && second.intent.id).toBe(first.ok ? first.intent.id : '');
    expect(second.ok && second.replayed).toBe(true);
    expect(listIntents()).toHaveLength(1);
  });

  it('has nothing to pay for when the order does not exist', () => {
    const opened = openIntent('O-nope', 'sandbox');
    expect(opened.ok).toBe(false);
    expect(!opened.ok && opened.status).toBe(404);
  });

  it('refuses to open one against a cancelled order', async () => {
    const order = await placeOrder();
    setOrderStatus(order.id, 'cancelled', 'store closed');

    const opened = openIntent(order.id, 'sandbox');
    expect(!opened.ok && opened.status).toBe(409);
  });

  /** Reopening a captured payment is how a customer pays twice for one meal. */
  it('refuses to reopen a payment that is already captured', async () => {
    const order = await placeOrder();
    const opened = openIntent(order.id, 'sandbox');
    const intentId = opened.ok ? opened.intent.id : '';

    settle({
      id: 'evt_capture',
      intentId,
      status: 'captured',
      providerRef: 'ref_1',
      amountCents: order.totals.totalCents,
      failureReason: null,
    });

    const again = openIntent(order.id, 'sandbox');
    expect(!again.ok && again.status).toBe(409);
  });
});

describe('the callback', () => {
  async function anIntent() {
    const order = await placeOrder();
    const opened = openIntent(order.id, 'sandbox');
    if (!opened.ok) throw new Error('could not open an intent');
    return { order, intent: opened.intent };
  }

  it('settles a signed event', async () => {
    const { order, intent } = await anIntent();

    const response = await withPaymentProvider(() =>
      webhookRoute(
        signedWebhook({
          id: 'evt_1',
          intentId: intent.id,
          status: 'captured',
          providerRef: 'ref_1',
          amountCents: order.totals.totalCents,
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(intentForOrder(order.id)?.status).toBe('captured');
  });

  /**
   * The one that matters. A public URL that acts on an unsigned body is a way
   * to mark orders paid, and the failure is silent — the orders look normal.
   */
  it('refuses a forged signature and changes nothing', async () => {
    const { order, intent } = await anIntent();

    const response = await withPaymentProvider(() =>
      webhookRoute(
        forgedWebhook({
          id: 'evt_forged',
          intentId: intent.id,
          status: 'captured',
          amountCents: order.totals.totalCents,
        }),
      ),
    );

    expect(response.status).toBe(401);
    expect(intentForOrder(order.id)?.status, 'still unpaid').toBe('pending');
  });

  it('refuses a body with no signature at all', async () => {
    const { order, intent } = await anIntent();

    const response = await withPaymentProvider(() =>
      webhookRoute(
        new Request('http://localhost/api/payments/webhook', {
          method: 'POST',
          body: JSON.stringify({ id: 'e', intentId: intent.id, status: 'captured', amountCents: 1 }),
        }),
      ),
    );

    expect(response.status).toBe(401);
    expect(intentForOrder(order.id)?.status).toBe('pending');
  });

  /**
   * The signature covers the bytes that were sent. Signing one body and posting
   * a different one is the attack that a verify-after-parse implementation
   * lets through.
   */
  it('refuses a body that was swapped after signing', async () => {
    const { order, intent } = await anIntent();
    const honest = JSON.stringify({
      id: 'evt_1',
      intentId: intent.id,
      status: 'failed',
      amountCents: order.totals.totalCents,
    });

    const response = await withPaymentProvider(() =>
      webhookRoute(
        new Request('http://localhost/api/payments/webhook', {
          method: 'POST',
          headers: { [SANDBOX_SIGNATURE_HEADER]: signBody(honest, PAYMENT_SECRET) },
          // Signed the refusal, posted the capture.
          body: JSON.stringify({
            id: 'evt_1',
            intentId: intent.id,
            status: 'captured',
            amountCents: order.totals.totalCents,
          }),
        }),
      ),
    );

    expect(response.status).toBe(401);
    expect(intentForOrder(order.id)?.status).toBe('pending');
  });

  it('refuses a signature made with the wrong secret', async () => {
    const { order, intent } = await anIntent();

    const response = await withPaymentProvider(() =>
      webhookRoute(
        signedWebhook(
          {
            id: 'evt_1',
            intentId: intent.id,
            status: 'captured',
            amountCents: order.totals.totalCents,
          },
          'not-the-secret',
        ),
      ),
    );

    expect(response.status).toBe(401);
  });

  /** Verified, so it really is the provider — just not something we act on. */
  it('answers 400 for verified bytes that are not an event', async () => {
    const rawBody = 'not json at all';
    const response = await withPaymentProvider(() =>
      webhookRoute(
        new Request('http://localhost/api/payments/webhook', {
          method: 'POST',
          headers: { [SANDBOX_SIGNATURE_HEADER]: signBody(rawBody, PAYMENT_SECRET) },
          body: rawBody,
        }),
      ),
    );

    expect(response.status).toBe(400);
  });

  it('answers 400 for a verified event of a shape we do not know', async () => {
    const rawBody = JSON.stringify({ kind: 'customer.updated', who: 'someone' });
    const response = await withPaymentProvider(() =>
      webhookRoute(
        new Request('http://localhost/api/payments/webhook', {
          method: 'POST',
          headers: { [SANDBOX_SIGNATURE_HEADER]: signBody(rawBody, PAYMENT_SECRET) },
          body: rawBody,
        }),
      ),
    );

    expect(response.status).toBe(400);
  });
});

describe('a redelivered callback', () => {
  /**
   * Gateways redeliver anything they did not get an acknowledgement for. The
   * applied-event list is what makes that harmless, and it is state rather than
   * a cache because the workers have to agree about what has been applied.
   */
  it('settles the order once', async () => {
    const order = await placeOrder();
    const opened = openIntent(order.id, 'sandbox');
    const intentId = opened.ok ? opened.intent.id : '';
    const event = {
      id: 'evt_same',
      intentId,
      status: 'captured' as const,
      providerRef: 'ref_1',
      amountCents: order.totals.totalCents,
      failureReason: null,
    };

    const first = settle(event);
    const second = settle(event);

    expect(first.ok && first.replayed).toBe(false);
    expect(second.ok && second.replayed).toBe(true);
    expect(intentForOrder(order.id)?.status).toBe('captured');
  });

  /**
   * The one that actually pins the event id.
   *
   * The test above passes with the idempotency check deleted, because a second
   * `captured` is stopped by the has-already-settled guard instead — two
   * defences, one test, and mutation testing showed the wrong one was holding
   * it up. `authorised` is not terminal, so nothing else catches this: without
   * the applied-event list the second delivery is a second application.
   */
  it('recognises a redelivery even when the payment is not yet final', async () => {
    const order = await placeOrder();
    const opened = openIntent(order.id, 'sandbox');
    const intentId = opened.ok ? opened.intent.id : '';
    const event = {
      id: 'evt_auth',
      intentId,
      status: 'authorised' as const,
      providerRef: 'ref_1',
      amountCents: order.totals.totalCents,
      failureReason: null,
    };

    const first = settle(event);
    const second = settle(event);

    expect(first.ok && first.replayed, 'the first delivery is not a replay').toBe(false);
    expect(second.ok && second.replayed, 'the second one is').toBe(true);
    expect(intentForOrder(order.id)?.status).toBe('authorised');
  });

  it('records the event id once, however many times it arrives', async () => {
    const order = await placeOrder();
    const opened = openIntent(order.id, 'sandbox');
    const intentId = opened.ok ? opened.intent.id : '';
    const event = {
      id: 'evt_auth',
      intentId,
      status: 'authorised' as const,
      providerRef: 'ref_1',
      amountCents: order.totals.totalCents,
      failureReason: null,
    };

    settle(event);
    settle(event);
    settle(event);

    const applied = readState().payments.appliedEvents.filter((id) => id === 'evt_auth');
    expect(applied).toHaveLength(1);
  });

  it('is answered 200, so the gateway stops redelivering', async () => {
    const order = await placeOrder();
    const opened = openIntent(order.id, 'sandbox');
    const intentId = opened.ok ? opened.intent.id : '';
    const event = {
      id: 'evt_same',
      intentId,
      status: 'captured',
      providerRef: 'ref_1',
      amountCents: order.totals.totalCents,
    };

    await withPaymentProvider(() => webhookRoute(signedWebhook(event)));
    const second = await withPaymentProvider(() => webhookRoute(signedWebhook(event)));

    expect(second.status).toBe(200);
    expect((await bodyOf<{ replayed: boolean }>(second)).replayed).toBe(true);
  });

  it('does not let a second event move a settled payment', async () => {
    const order = await placeOrder();
    const opened = openIntent(order.id, 'sandbox');
    const intentId = opened.ok ? opened.intent.id : '';

    settle({
      id: 'evt_capture',
      intentId,
      status: 'captured',
      providerRef: 'ref_1',
      amountCents: order.totals.totalCents,
      failureReason: null,
    });
    settle({
      id: 'evt_late_failure',
      intentId,
      status: 'failed',
      providerRef: 'ref_1',
      amountCents: order.totals.totalCents,
      failureReason: 'too late',
    });

    expect(intentForOrder(order.id)?.status, 'captured stays captured').toBe('captured');
  });
});

describe('an event that does not add up', () => {
  it('refuses an amount that is not the one we asked for', async () => {
    const order = await placeOrder();
    const opened = openIntent(order.id, 'sandbox');
    const intentId = opened.ok ? opened.intent.id : '';

    const result = settle({
      id: 'evt_short',
      intentId,
      status: 'captured',
      providerRef: 'ref_1',
      amountCents: order.totals.totalCents - 1,
      failureReason: null,
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.status).toBe(409);
    expect(intentForOrder(order.id)?.status).toBe('pending');
  });

  it('has nothing to settle for an intent that does not exist', () => {
    const result = settle({
      id: 'evt_orphan',
      intentId: 'pi_nope',
      status: 'captured',
      providerRef: null,
      amountCents: 1_000,
      failureReason: null,
    });

    expect(!result.ok && result.status).toBe(404);
  });

  it('records why a payment failed, for support to read', async () => {
    const order = await placeOrder();
    const opened = openIntent(order.id, 'sandbox');
    const intentId = opened.ok ? opened.intent.id : '';

    settle({
      id: 'evt_declined',
      intentId,
      status: 'failed',
      providerRef: 'ref_1',
      amountCents: order.totals.totalCents,
      failureReason: 'Insufficient funds',
    });

    expect(intentForOrder(order.id)?.failureReason).toBe('Insufficient funds');
  });
});
