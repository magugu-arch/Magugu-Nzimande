import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSystem, nextWeekday, openSlot, startBooking } from './helpers.ts';
import { MINUTE, isDomainError } from '../src/domain/util/core.ts';
import { staff } from '../src/domain/roles.ts';
import { SYSTEM } from '../src/domain/context.ts';
import { SANDBOX_PAYMENTS_SIGNING_KEY, signatureHeader } from '../src/domain/sandbox/webhooks.ts';
import { utf8 } from '../src/domain/util/sha256.ts';
import { reconciliationReport, settlementCsv } from '../src/domain/payments/reconciliation.ts';
import { WEBHOOK_GRACE_MS } from '../src/domain/payments/service.ts';

async function depositCheckout() {
  const { sys, clock } = makeSystem();
  const date = nextWeekday(sys, 2, 3);
  const time = await openSlot(sys, 'rosebank', date, 6);
  const attemptId = await startBooking(sys, { branchId: 'rosebank', date, time, partySize: 6 });
  const r = await sys.bookings.submit(attemptId, { policyAccepted: true });
  if (r.status !== 'checkout') throw new Error('expected checkout');
  return { sys, clock, attemptId, paymentId: r.paymentId };
}

describe('payment verification', () => {
  test('the return URL cannot mark a payment successful', async () => {
    const { sys, paymentId } = await depositCheckout();
    const p = await sys.payments.handleReturn(paymentId, { status: 'succeeded', paid: 'true' });
    assert.equal(p.status, 'pending');
    await sys.settle();
    assert.equal(sys.db.all('bookings').length, 0);
  });

  test('duplicate webhooks are processed once', async () => {
    const { sys, clock, paymentId } = await depositCheckout();
    sys.db.update('settings', 'global', (s) => ({ ...s, sandbox: { ...s.sandbox, duplicateWebhooks: true } }));
    sys.gateway.completeCheckout(sys.payments.get(paymentId).providerPaymentId!, 'succeed');
    clock.advance(MINUTE);
    await sys.settle();
    const events = sys.db.where('paymentEvents', (e) => e.paymentId === paymentId);
    assert.equal(events.length, 1, 'the second copy is recognised by its event id');
    assert.equal(sys.db.where('outbox', (e) => e.eventType === 'payment.succeeded').length, 1);
    assert.equal(sys.db.where('notifications', (n) => n.templateId === 'payment-receipt').length, 1);
    assert.equal(sys.db.all('bookings').length, 1);
  });

  test('a webhook with a bad signature changes nothing', async () => {
    const { sys, paymentId } = await depositCheckout();
    const p = sys.payments.get(paymentId);
    const body = JSON.stringify({
      id: 'pev_forged',
      type: 'payment.succeeded',
      created: sys.ctx.clock.now(),
      data: { payment: { id: p.providerPaymentId, providerPaymentId: p.providerPaymentId, status: 'succeeded', amountMinor: p.amountMinor } },
    });
    const result = await sys.payments.handleWebhook(utf8(body), {
      'x-sandbox-signature': signatureHeader('wrong-key', body, sys.ctx.clock.now()),
    });
    assert.equal(result.httpStatus, 401);
    assert.equal(sys.payments.get(paymentId).status, 'pending');
    assert.equal(sys.db.where('paymentEvents', (e) => e.outcome === 'rejected' && !e.signatureVerified).length, 1);
  });

  test('a correctly signed webhook for an altered body fails verification', async () => {
    const { sys, paymentId } = await depositCheckout();
    const p = sys.payments.get(paymentId);
    const body = JSON.stringify({ id: 'pev_1', type: 'payment.succeeded', data: { payment: { id: p.providerPaymentId, status: 'succeeded' } } });
    const header = signatureHeader(SANDBOX_PAYMENTS_SIGNING_KEY, body, sys.ctx.clock.now());
    const tampered = body.replace('succeeded', 'refunded');
    const result = await sys.payments.handleWebhook(utf8(tampered), { 'x-sandbox-signature': header });
    assert.equal(result.httpStatus, 401);
  });

  test('when webhooks are lost the status API still finds the outcome', async () => {
    const { sys, clock, paymentId } = await depositCheckout();
    sys.db.update('settings', 'global', (s) => ({ ...s, sandbox: { ...s.sandbox, dropWebhooks: true } }));
    sys.gateway.completeCheckout(sys.payments.get(paymentId).providerPaymentId!, 'succeed');
    clock.advance(MINUTE);
    await sys.settle();
    assert.equal(sys.db.all('sandboxWebhooks').length, 0);
    clock.advance(WEBHOOK_GRACE_MS);
    await sys.settle();
    assert.equal(sys.payments.get(paymentId).status, 'succeeded');
    assert.equal(sys.db.all('bookings').length, 1);
  });

  test('a late, out-of-order event cannot undo a success', async () => {
    const { sys, clock, paymentId } = await depositCheckout();
    const p = sys.payments.get(paymentId);
    sys.gateway.completeCheckout(p.providerPaymentId!, 'succeed');
    clock.advance(MINUTE);
    await sys.settle();
    const body = JSON.stringify({
      id: 'pev_late',
      type: 'payment.failed',
      created: sys.ctx.clock.now(),
      data: { payment: { id: p.providerPaymentId, providerPaymentId: p.providerPaymentId, status: 'failed', amountMinor: p.amountMinor } },
    });
    const r = await sys.payments.handleWebhook(utf8(body), {
      'x-sandbox-signature': signatureHeader(SANDBOX_PAYMENTS_SIGNING_KEY, body, sys.ctx.clock.now()),
    });
    assert.equal(r.outcome, 'ignored-stale');
    assert.equal(sys.payments.get(paymentId).status, 'succeeded');
  });

  test('only configured currencies are accepted and amounts are whole cents', async () => {
    const { sys } = makeSystem();
    const base = { purpose: 'voucher' as const, referenceId: 'r', description: 'd', returnUrl: '/', cancelUrl: '/' };
    await assert.rejects(sys.payments.createCheckout({ ...base, amountMinor: 100, currency: 'USD', idempotencyKey: 'a' }), (e) => isDomainError(e, 'unsupported_currency'));
    await assert.rejects(sys.payments.createCheckout({ ...base, amountMinor: 10.5, currency: 'ZAR', idempotencyKey: 'b' }), (e) => isDomainError(e, 'invalid_amount'));
  });

  test('reusing an idempotency key for a different amount is refused', async () => {
    const { sys } = makeSystem();
    const base = { purpose: 'voucher' as const, referenceId: 'r', description: 'd', returnUrl: '/', cancelUrl: '/', currency: 'ZAR' };
    await sys.payments.createCheckout({ ...base, amountMinor: 1000, idempotencyKey: 'same' });
    await assert.rejects(sys.payments.createCheckout({ ...base, amountMinor: 9999, idempotencyKey: 'same' }), (e) => isDomainError(e, 'idempotency_conflict'));
  });
});

describe('refunds', () => {
  async function paid() {
    const ctx = await depositCheckout();
    ctx.sys.gateway.completeCheckout(ctx.sys.payments.get(ctx.paymentId).providerPaymentId!, 'succeed');
    ctx.clock.advance(MINUTE);
    await ctx.sys.settle();
    return ctx;
  }

  test('partial then full refunds reconcile with the gateway', async () => {
    const { sys, clock, paymentId } = await paid();
    await sys.payments.refund({ paymentId, amountMinor: 20000, reason: 'Goodwill', actor: staff('finance'), idempotencyKey: 'r1' });
    assert.equal(sys.payments.get(paymentId).status, 'refund-pending');
    clock.advance(MINUTE);
    await sys.settle();
    assert.equal(sys.payments.get(paymentId).status, 'partially-refunded');
    assert.equal(sys.payments.get(paymentId).refundedMinor, 20000);

    await sys.payments.refund({ paymentId, reason: 'Rest of it', actor: staff('finance'), idempotencyKey: 'r2' });
    clock.advance(MINUTE);
    await sys.settle();
    const p = sys.payments.get(paymentId);
    assert.equal(p.status, 'refunded');
    assert.equal(p.refundedMinor, 60000);
    assert.deepEqual(sys.db.where('refunds', (r) => r.paymentId === paymentId).map((r) => r.status), ['succeeded', 'succeeded']);
    assert.equal(sys.db.where('notifications', (n) => n.templateId === 'payment-refunded').length, 2);
  });

  test('the same refund request twice refunds once', async () => {
    const { sys, clock, paymentId } = await paid();
    const a = await sys.payments.refund({ paymentId, amountMinor: 10000, reason: 'x', actor: staff('finance'), idempotencyKey: 'dup' });
    const b = await sys.payments.refund({ paymentId, amountMinor: 10000, reason: 'x', actor: staff('finance'), idempotencyKey: 'dup' });
    assert.equal(a.id, b.id);
    clock.advance(MINUTE);
    await sys.settle();
    assert.equal(sys.payments.get(paymentId).refundedMinor, 10000);
  });

  test('refunds are limited by role and by what is left', async () => {
    const { sys, paymentId } = await paid();
    await assert.rejects(sys.payments.refund({ paymentId, amountMinor: 1000, reason: 'x', actor: staff('host'), idempotencyKey: 'h' }), (e) => isDomainError(e, 'forbidden'));
    await assert.rejects(sys.payments.refund({ paymentId, amountMinor: 55000, reason: 'x', actor: staff('manager'), idempotencyKey: 'm' }), (e) => isDomainError(e, 'forbidden'));
    await assert.rejects(sys.payments.refund({ paymentId, amountMinor: 70000, reason: 'x', actor: staff('finance'), idempotencyKey: 'f' }), (e) => isDomainError(e, 'refund_exceeds_balance'));
    await assert.rejects(sys.payments.refund({ paymentId, amountMinor: 100, reason: ' ', actor: staff('finance'), idempotencyKey: 'n' }), (e) => isDomainError(e, 'reason_required'));
    const ok = await sys.payments.refund({ paymentId, amountMinor: 40000, reason: 'Manager goodwill', actor: staff('manager'), idempotencyKey: 'ok' });
    assert.equal(ok.status, 'pending');
    assert.ok(sys.db.where('audit', (a) => a.action === 'payment.refund-requested' && a.actor.role === 'manager').length === 1);
  });

  test('a failed payment cannot be refunded', async () => {
    const { sys, clock, paymentId } = await depositCheckout();
    sys.gateway.completeCheckout(sys.payments.get(paymentId).providerPaymentId!, 'decline');
    clock.advance(MINUTE);
    await sys.settle();
    await assert.rejects(sys.payments.refund({ paymentId, reason: 'x', actor: SYSTEM, idempotencyKey: 'z' }), (e) => isDomainError(e, 'not_refundable'));
  });
});

describe('reconciliation and settlement', () => {
  test('a paid deposit with no table appears in the report until resolved', async () => {
    const { sys, clock, attemptId, paymentId } = await depositCheckout();
    sys.db.update('settings', 'global', (s) => ({ ...s, sandbox: { ...s.sandbox, nextCreate: 'unavailable' } }));
    sys.gateway.completeCheckout(sys.payments.get(paymentId).providerPaymentId!, 'succeed');
    clock.advance(MINUTE);
    await sys.settle();
    const report = reconciliationReport(sys.ctx);
    assert.equal(report.length, 1);
    assert.equal(report[0]?.kind, 'paid-no-table');
    assert.equal(report[0]?.entityId, attemptId);

    await sys.bookings.refundReconciliation(attemptId, staff('finance'));
    clock.advance(MINUTE);
    await sys.settle();
    assert.equal(reconciliationReport(sys.ctx).length, 0);
  });

  test('the settlement export lists every payment with net amounts', async () => {
    const { sys, clock, paymentId } = await depositCheckout();
    sys.gateway.completeCheckout(sys.payments.get(paymentId).providerPaymentId!, 'succeed');
    clock.advance(MINUTE);
    await sys.settle();
    const csv = settlementCsv(sys.ctx).trim().split('\n');
    assert.equal(csv[0], 'payment_id,gateway_reference,purpose,reference_id,status,currency,amount_minor,refunded_minor,net_minor,created_at,updated_at');
    assert.equal(csv.length, 2);
    assert.match(csv[1]!, /,reservation-deposit,.*,succeeded,ZAR,60000,0,60000,/);
  });
});
