import { beforeEach, describe, expect, it } from 'vitest';
import { POST as refundRoute } from '@/app/api/admin/payments/route';
import { GET as orderRoute } from '@/app/api/orders/[id]/route';
import { POST as advanceRoute } from '@/app/api/orders/[id]/advance/route';
import { intentForOrder, refundPayment } from '@/lib/payments/ledger';
import { setOrderStatus } from '@/lib/order-store';
import { orderMoved, paymentRefunded } from '@/lib/notifications/messages';
import { readState } from '@/lib/demo-state';
import { readAudit } from '@/lib/catalogue-state';
import {
  aPaidOrder,
  aRefundedOrder,
  asOperator,
  blankState,
  bodyOf,
  concurrently,
  errorOf,
  openIntentFor,
  params,
  placeOrder,
  request,
  settlePayment,
  webFile,
  withConsole,
  withoutPaymentProvider,
  withPayfast,
  withPaymentProvider,
  withRefusedRefunds,
} from './fixtures';

/**
 * Sending money back.
 *
 * There was no refund anywhere. `refunded` had been a payment status since the
 * type system was written, the kitchen guard handled it correctly, and nothing
 * in the application could ever produce one — so a store that cancelled an
 * order somebody had paid for left the capture standing and had no way to
 * return it except the gateway's own dashboard, if their gateway has one.
 *
 * What is testable without a merchant account is everything except the network
 * call: who may ask, what may be refunded, what happens when the gateway says
 * no, and that the ledger is never written unless it said yes.
 */

beforeEach(blankState);

const refund = (cookie: string, body: unknown) =>
  refundRoute(asOperator(cookie)('/api/admin/payments', body));

describe('who may refund', () => {
  it('refuses somebody who is not signed in', async () => {
    const order = await aPaidOrder();
    const response = await withConsole(() =>
      refundRoute(
        request('/api/admin/payments', {
          body: { action: 'refund', orderId: order.id, reason: 'Load shedding' },
        }),
      ),
    );

    expect(response.status).toBe(401);
    expect(intentForOrder(order.id)?.status).toBe('captured');
  });
});

describe('what may be refunded', () => {
  /**
   * The same refusal as opening a payment, for the same reason. A build with no
   * merchant account must not report money as returned any more than it may
   * report money as taken.
   */
  it('refuses when no gateway is configured', async () => {
    const order = await aPaidOrder();

    const result = await withoutPaymentProvider(() => refundPayment(order.id, 'Load shedding'));

    expect(result).toMatchObject({ ok: false, status: 501 });
    expect(intentForOrder(order.id)?.status).toBe('captured');
  });

  it('refuses a payment that was never captured', async () => {
    const order = await placeOrder();

    const result = await withPaymentProvider(async () => {
      await openIntentFor(order.id);
      return refundPayment(order.id, 'Changed their mind');
    });

    expect(result).toMatchObject({ ok: false, status: 409 });
    if (!result.ok) expect(result.error).toMatch(/pending/);
  });

  it('refuses a payment that failed', async () => {
    const order = await placeOrder();

    const result = await withPaymentProvider(async () => {
      await settlePayment(order.id, 'failed');
      return refundPayment(order.id, 'Not sure why');
    });

    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it('refuses an order that has no payment at all', async () => {
    const order = await placeOrder();

    const result = await withPaymentProvider(() => refundPayment(order.id, 'Load shedding'));

    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  /**
   * The distinction that matters most on this path. A gateway that cannot
   * refund through its API is refused by name — several South African providers
   * require a person in their dashboard — rather than recorded as refunded,
   * which would tell an operator the money went back when nothing had moved.
   */
  it('refuses a gateway with no refund API, and says where to go instead', async () => {
    const order = await aPaidOrder();

    // PayFast is that gateway. Its adapter implements the three required
    // methods and not the optional fourth, because refunding there is done by a
    // person with the merchant login — so this is a real adapter's real
    // limitation rather than a stub arranged to fail.
    const result = await withPayfast(() => refundPayment(order.id, 'Load shedding'));

    expect(result).toMatchObject({ ok: false, status: 501 });
    if (!result.ok) expect(result.error).toMatch(/dashboard/);
    expect(intentForOrder(order.id)?.status).toBe('captured');
  });
});

describe('refunding a captured payment', () => {
  it('marks it refunded and records why', async () => {
    const order = await aPaidOrder();

    const result = await withPaymentProvider(() => refundPayment(order.id, 'Load shedding'));

    expect(result.ok).toBe(true);
    const intent = intentForOrder(order.id);
    expect(intent?.status).toBe('refunded');
    expect(intent?.failureReason).toBe('Load shedding');
  });

  /** An operator pressing the button twice must not send the money twice. */
  it('does not refund the same payment twice', async () => {
    const order = await aPaidOrder();

    const { first, second } = await withPaymentProvider(async () => ({
      first: await refundPayment(order.id, 'Load shedding'),
      second: await refundPayment(order.id, 'Load shedding'),
    }));

    expect(first).toMatchObject({ ok: true, replayed: false });
    expect(second).toMatchObject({ ok: true, replayed: true });
  });

  it('works for an order that was cancelled, which is the case it exists for', async () => {
    const order = await aPaidOrder();
    setOrderStatus(order.id, 'cancelled', 'Load shedding');

    const result = await withPaymentProvider(() => refundPayment(order.id, 'Load shedding'));

    expect(result.ok).toBe(true);
    expect(intentForOrder(order.id)?.status).toBe('refunded');
  });
});

/**
 * What the rest of the application makes of a refunded order.
 *
 * The status has been in the type system since the beginning and nothing could
 * produce one, so every rule about it had only ever been checked against a
 * literal. These drive the real thing.
 */
describe('an order whose payment has gone back', () => {
  it('is not cooked, whatever state the kitchen had it in', async () => {
    const order = await aRefundedOrder();

    const response = await withPaymentProvider(() =>
      advanceRoute(
        request(`/api/orders/${order.id}/advance`, { method: 'POST' }),
        params({ id: order.id }),
      ),
    );

    expect(response.status).toBe(409);
    expect(await errorOf(response)).toMatch(/not been paid/i);
  });

  /** The customer's own screen has to say so too, not just the console. */
  it('reports itself refunded on the order endpoint', async () => {
    const order = await aRefundedOrder();

    const body = await withPaymentProvider(async () =>
      bodyOf<{ payment: { required: boolean; status: string } }>(
        await orderRoute(request(`/api/orders/${order.id}`), params({ id: order.id })),
      ),
    );

    expect(body.payment).toEqual({ required: true, status: 'refunded' });
  });
});

describe('through the console route', () => {
  it('refunds and hands back the whole console view', async () => {
    const order = await aPaidOrder();

    const response = await withConsole((cookie) =>
      withPaymentProvider(() =>
        refund(cookie, { action: 'refund', orderId: order.id, reason: 'Load shedding' }),
      ),
    );

    expect(response.status).toBe(200);
    const body = await bodyOf<{
      payments: { status: string }[];
      orders: unknown[];
      audit: unknown[];
    }>(response);

    // The whole view, so the screen re-renders rather than patching its own
    // copy of the payments list.
    expect(body.orders).toBeDefined();
    expect(body.audit).toBeDefined();
    expect(body.payments[0]?.status).toBe('refunded');
  });

  it('refuses a refund with no reason', async () => {
    const order = await aPaidOrder();

    const response = await withConsole((cookie) =>
      withPaymentProvider(() => refund(cookie, { action: 'refund', orderId: order.id, reason: '   ' })),
    );

    expect(response.status).toBe(400);
    expect(intentForOrder(order.id)?.status).toBe('captured');
  });

  it('passes the ledger’s own status through rather than flattening it', async () => {
    const order = await aPaidOrder();

    const response = await withConsole((cookie) =>
      withoutPaymentProvider(() =>
        refund(cookie, { action: 'refund', orderId: order.id, reason: 'Load shedding' }),
      ),
    );

    expect(response.status).toBe(501);
  });
});

/**
 * What the customer is told.
 *
 * The half that is easiest to leave out, and the half they actually see. The
 * operator's console said "Refunded" from the first commit of this path; the
 * customer's own screen said the opposite of the truth.
 */
describe('the customer’s side of a refund', () => {
  const JOURNEY = webFile('src/components/journey/OrderJourney.tsx');

  /**
   * The defect this covers. A refunded payment matched none of the branches —
   * captured, pending, failed — and fell through to the last one, which reads
   * "nothing has been charged" and offers a button to pay. Money taken and
   * returned, described as never taken, with an invitation to pay again.
   */
  it('has a branch of its own, before the one that offers to take payment', () => {
    expect(JOURNEY).toContain("payment.status === 'refunded'");

    const refunded = JOURNEY.indexOf("payment.status === 'refunded'");
    const payAgain = JOURNEY.indexOf('Pay for this order');
    expect(refunded).toBeGreaterThan(-1);
    expect(refunded, 'the refunded branch must return before the pay button').toBeLessThan(
      payAgain,
    );
  });

  it('does not tell a refunded customer that nothing was charged', () => {
    const refunded = JOURNEY.indexOf("payment.status === 'refunded'");
    const branch = JOURNEY.slice(refunded, JOURNEY.indexOf('}', refunded + 400));

    expect(branch).toMatch(/refunded/i);
    expect(branch).not.toMatch(/nothing has been charged/i);
  });
});

describe('the message a refunded customer gets', () => {
  it('names the order and says the money is coming back', async () => {
    const order = await placeOrder();
    const [message] = paymentRefunded(order, 'pi_test');

    expect(message?.channel).toBe('sms');
    expect(message?.to).toBe(order.customer.mobile);
    expect(message?.body).toContain(order.orderNumber);
    expect(message?.body).toMatch(/refunded/i);
  });

  /**
   * Separate from the cancellation, because they are not the same news. A
   * cancellation that says nothing about money reads as the money being kept.
   */
  it('is not the same message as the cancellation', async () => {
    const order = await placeOrder();
    const cancelled = orderMoved({
      ...order,
      status: 'cancelled',
      cancelledReason: 'Load shedding',
    });

    expect(cancelled[0]?.body).not.toMatch(/refund/i);
    expect(paymentRefunded(order, 'pi_test')[0]?.id).not.toBe(cancelled[0]?.id);
  });

  /** Keyed on the payment, so one payment can only produce one of these. */
  it('carries an id derived from the intent rather than the order', async () => {
    const order = await placeOrder();
    expect(paymentRefunded(order, 'pi_one')[0]?.id).toContain('pi_one');
    expect(paymentRefunded(order, 'pi_one')[0]?.id).not.toBe(
      paymentRefunded(order, 'pi_two')[0]?.id,
    );
  });

  it('is sent when the console refunds, and recorded so it cannot repeat', async () => {
    const order = await aPaidOrder();

    await withConsole((cookie) =>
      withPaymentProvider(() =>
        refund(cookie, { action: 'refund', orderId: order.id, reason: 'Load shedding' }),
      ),
    );

    const intent = intentForOrder(order.id);
    expect(readState().notifications.sent).toContain(`${intent?.id}:refunded:sms`);
  });
});

/**
 * Two operators, one payment, the same moment.
 *
 * `mutateState` holds a lock and is synchronous, so every single write here is
 * atomic — and that is not the same as the operation being atomic. Refunding
 * reads the intent, asks the gateway, and then writes, and a second caller
 * arriving during the ask sees a payment that is still captured.
 *
 * A queue on a busy Saturday is worked by whoever is free. Two people pressing
 * Refund on the same order is the ordinary case.
 */
describe('two refunds at once', () => {
  it('asks the gateway once, whatever the console does', async () => {
    const order = await aPaidOrder();

    const results = await withPaymentProvider(() =>
      concurrently(2, () => refundPayment(order.id, 'Load shedding')),
    );

    expect(results.every((result) => result.ok)).toBe(true);
    // One of them did the work and the other found it done.
    expect(results.filter((result) => result.ok && !result.replayed)).toHaveLength(1);
  });

  /** The audit log is the record of money moving. It must show one movement. */
  it('records the refund once', async () => {
    const order = await aPaidOrder();

    await withPaymentProvider(() => concurrently(3, () => refundPayment(order.id, 'Load shedding')));

    const refunds = readAudit().filter((entry) => entry.what.includes('refunded'));
    expect(refunds).toHaveLength(1);
  });
});

/**
 * When the gateway says no.
 *
 * The branch that releases the claim, and the one most easily got wrong. A
 * refund that fails must leave the payment exactly as it was and must leave the
 * operator able to try again — holding the claim after a failure would make one
 * transient network error permanent, with the payment still captured and every
 * retry told the refund had already been done.
 */
describe('a refund the gateway refuses', () => {
  it('leaves the payment captured and says what happened', async () => {
    const order = await aPaidOrder();

    const result = await withPaymentProvider(() =>
      withRefusedRefunds(() => refundPayment(order.id, 'Load shedding')),
    );

    expect(result).toMatchObject({ ok: false, status: 502 });
    if (!result.ok) expect(result.error).toMatch(/gateway refused/i);
    expect(intentForOrder(order.id)?.status).toBe('captured');
  });

  it('records nothing in the audit log, because nothing moved', async () => {
    const order = await aPaidOrder();

    await withPaymentProvider(() =>
      withRefusedRefunds(() => refundPayment(order.id, 'Load shedding')),
    );

    expect(readAudit().filter((entry) => entry.what.includes('refunded'))).toHaveLength(0);
  });

  /** The one that matters: a failure must not lock the payment out of retrying. */
  it('can be tried again once the gateway is working', async () => {
    const order = await aPaidOrder();

    const outcome = await withPaymentProvider(async () => {
      const refused = await withRefusedRefunds(() => refundPayment(order.id, 'Load shedding'));
      expect(refused.ok, 'the first attempt must fail for this test to mean anything').toBe(false);
      return refundPayment(order.id, 'Load shedding');
    });

    expect(outcome).toMatchObject({ ok: true, replayed: false });
    expect(intentForOrder(order.id)?.status).toBe('refunded');
  });
});
