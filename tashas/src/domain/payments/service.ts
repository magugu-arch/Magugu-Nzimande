/**
 * Payments (brief §13.3–13.5).
 *
 * Rules this module enforces:
 * - Amounts come from the calling service's server-side quote, in integer
 *   minor units; a browser-supplied total is never accepted.
 * - A payment is "succeeded" only when the gateway says so through a verified
 *   webhook or its authenticated status API. The return URL is ignored.
 * - Webhooks are signature-checked against the raw body and deduplicated by
 *   provider event id before anything changes.
 * - Refunds are permission-checked, idempotent and audited.
 */

import type { Ctx } from '../context.ts';
import { SYSTEM, audit, raiseAlert, resolveAlerts } from '../context.ts';
import type { Outbox } from '../outbox.ts';
import { authorize } from '../roles.ts';
import type {
  Actor,
  CreatePaymentRequest,
  Payment,
  PaymentRecord,
  PaymentStatus,
  Refund,
} from '../types.ts';
import { DomainError, assertMinor, isDomainError } from '../util/core.ts';
import type { NamedPaymentProvider } from '../sandbox/gateway.ts';
import { refundedOf } from '../sandbox/gateway.ts';
import { canTransition } from './stateMachine.ts';
import { UniqueViolation } from '../db.ts';

/** How long a webhook gets to arrive before the status API is asked instead. */
export const WEBHOOK_GRACE_MS = 5_000;

export interface WebhookResult {
  httpStatus: 200 | 400 | 401;
  outcome: 'processed' | 'duplicate' | 'rejected' | 'ignored-stale' | 'unknown-payment';
  paymentId?: string;
}

export class PaymentService {
  private ctx: Ctx;
  private outbox: Outbox;
  readonly provider: NamedPaymentProvider;

  constructor(ctx: Ctx, outbox: Outbox, provider: NamedPaymentProvider) {
    this.ctx = ctx;
    this.outbox = outbox;
    this.provider = provider;
  }

  get(paymentId: string): Payment {
    return this.ctx.db.require('payments', paymentId);
  }

  async createCheckout(request: CreatePaymentRequest): Promise<Payment> {
    const { db, ids, clock } = this.ctx;
    assertMinor(request.amountMinor);
    if (request.amountMinor === 0) throw new DomainError('invalid_amount', 'Nothing to pay.');
    if (!this.provider.supportedCurrencies.includes(request.currency)) {
      throw new DomainError('unsupported_currency', `${request.currency} is not enabled for this merchant account`);
    }

    const existing = db.byUnique('payments', 'idempotencyKey', request.idempotencyKey);
    if (existing) {
      if (existing.amountMinor !== request.amountMinor || existing.referenceId !== request.referenceId) {
        throw new DomainError('idempotency_conflict', 'This payment key was already used for a different payment.');
      }
      return existing;
    }

    const now = clock.now();
    const payment = db.transaction(() => {
      const row = db.insert('payments', {
        id: ids.id('pay'),
        provider: this.provider.name,
        providerPaymentId: null,
        purpose: request.purpose,
        referenceId: request.referenceId,
        bookingAttemptId: request.bookingAttemptId ?? null,
        guestId: request.guestId ?? null,
        amountMinor: request.amountMinor,
        currency: request.currency,
        status: 'created',
        refundedMinor: 0,
        idempotencyKey: request.idempotencyKey,
        gatewayReference: null,
        checkoutUrl: null,
        description: request.description,
        metadata: request.metadata ?? {},
        history: [{ status: 'created', at: now, source: 'service' }],
        createdAt: now,
        updatedAt: now,
      });
      audit(this.ctx, SYSTEM, 'payment.created', 'payment', row.id, {
        purpose: row.purpose,
        amountMinor: row.amountMinor,
        referenceId: row.referenceId,
      });
      return row;
    });

    try {
      const { payment: record, checkoutUrl } = await this.provider.createCheckout({
        ...request,
        metadata: { ...(request.metadata ?? {}), internalPaymentId: payment.id },
      });
      return db.transaction(() => {
        const updated = db.update('payments', payment.id, {
          providerPaymentId: record.providerPaymentId ?? record.id,
          gatewayReference: record.id,
          checkoutUrl: checkoutUrl ?? null,
          updatedAt: clock.now(),
        });
        return this.applyStatus(updated, record, 'checkout-created');
      });
    } catch (err) {
      db.update('payments', payment.id, (p) => ({
        ...p,
        status: 'failed',
        history: [...p.history, { status: 'failed', at: clock.now(), source: 'checkout-error' }],
        updatedAt: clock.now(),
      }));
      throw err;
    }
  }

  /**
   * Applies a gateway-reported status through the state machine, emitting the
   * matching domain event. Stale or out-of-order reports are ignored.
   */
  private applyStatus(payment: Payment, record: PaymentRecord, source: string): Payment {
    const { db, clock } = this.ctx;
    const reportedRefunded = refundedOf(record);
    let next: PaymentStatus = record.status;
    if (next === 'refund-pending' && reportedRefunded >= payment.amountMinor) next = 'refunded';

    const refundedDelta = Math.max(0, reportedRefunded - payment.refundedMinor);
    if (next === payment.status && refundedDelta === 0) return payment;
    if (next !== payment.status && !canTransition(payment.status, next)) return payment;

    const now = clock.now();
    const updated = db.update('payments', payment.id, (p) => ({
      ...p,
      status: next,
      refundedMinor: Math.max(p.refundedMinor, reportedRefunded),
      history: next !== p.status ? [...p.history, { status: next, at: now, source }] : p.history,
      updatedAt: now,
    }));

    const base = { paymentId: updated.id, referenceId: updated.referenceId };
    const guest = updated.guestId ? { guestId: updated.guestId } : {};
    const correlation = updated.bookingAttemptId ?? updated.referenceId;
    if (next !== payment.status) {
      if (next === 'succeeded') {
        this.outbox.publish({ type: 'payment.succeeded', ...base, ...guest, amountMinor: updated.amountMinor }, correlation);
      } else if (next === 'failed') {
        this.outbox.publish({ type: 'payment.failed', ...base, ...guest }, correlation);
      } else if (next === 'cancelled') {
        this.outbox.publish({ type: 'payment.cancelled', ...base, ...guest }, correlation);
      }
    }
    if (refundedDelta > 0) {
      this.settleRefunds(updated, reportedRefunded);
      this.outbox.publish({ type: 'payment.refunded', ...base, amountMinor: refundedDelta }, correlation);
    }
    audit(this.ctx, { kind: 'provider', id: this.provider.name }, 'payment.status', 'payment', updated.id, {
      from: payment.status,
      to: next,
      source,
    });
    return updated;
  }

  /** Marks pending refunds succeeded, oldest first, up to the refunded total the gateway reports. */
  private settleRefunds(payment: Payment, reportedRefunded: number): void {
    const { db, clock } = this.ctx;
    let settled = db
      .where('refunds', (r) => r.paymentId === payment.id && r.status === 'succeeded')
      .reduce((n, r) => n + r.amountMinor, 0);
    const pending = db
      .where('refunds', (r) => r.paymentId === payment.id && r.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const r of pending) {
      if (settled + r.amountMinor > reportedRefunded) break;
      settled += r.amountMinor;
      db.update('refunds', r.id, { status: 'succeeded', updatedAt: clock.now() });
    }
  }

  async handleWebhook(rawBody: Uint8Array, headers: Record<string, string>): Promise<WebhookResult> {
    const { db, ids, clock } = this.ctx;
    let verified: { eventId: string; payment: PaymentRecord; eventType: string };
    try {
      verified = await this.provider.verifyWebhook(rawBody, headers);
    } catch (err) {
      db.insert('paymentEvents', {
        id: ids.id('pevt'),
        providerEventId: null,
        paymentId: null,
        eventType: 'unverified',
        rawPayloadRedacted: { bytes: rawBody.length, error: err instanceof Error ? err.message : 'invalid' },
        signatureVerified: false,
        receivedAt: clock.now(),
        processedAt: null,
        outcome: 'rejected',
      });
      return { httpStatus: 401, outcome: 'rejected' };
    }

    if (db.byUnique('paymentEvents', 'providerEventId', verified.eventId)) {
      return { httpStatus: 200, outcome: 'duplicate' };
    }

    const providerId = verified.payment.providerPaymentId ?? verified.payment.id;
    const payment = db.byUnique('payments', 'providerPaymentId', providerId);

    try {
      return this.recordAndApply(verified, payment);
    } catch (err) {
      // Two copies raced past the check above; the UNIQUE constraint decides.
      if (err instanceof UniqueViolation && err.field === 'providerEventId') {
        return { httpStatus: 200, outcome: 'duplicate' };
      }
      throw err;
    }
  }

  private recordAndApply(
    verified: { eventId: string; payment: PaymentRecord; eventType: string },
    payment: Payment | undefined,
  ): WebhookResult {
    const { db, ids, clock } = this.ctx;
    return db.transaction(() => {
      const event = db.insert('paymentEvents', {
        id: ids.id('pevt'),
        providerEventId: verified.eventId,
        paymentId: payment?.id ?? null,
        eventType: verified.eventType,
        rawPayloadRedacted: {
          status: verified.payment.status,
          amountMinor: verified.payment.amountMinor,
          referenceId: verified.payment.referenceId,
        },
        signatureVerified: true,
        receivedAt: clock.now(),
        processedAt: null,
        outcome: 'processed',
      });
      if (!payment) {
        db.update('paymentEvents', event.id, { outcome: 'ignored-stale', processedAt: clock.now() });
        return { httpStatus: 200 as const, outcome: 'unknown-payment' as const };
      }
      const before = payment.status;
      const beforeRefunded = payment.refundedMinor;
      const after = this.applyStatus(payment, verified.payment, 'webhook');
      const changed = after.status !== before || after.refundedMinor !== beforeRefunded;
      db.update('paymentEvents', event.id, {
        outcome: changed ? 'processed' : 'ignored-stale',
        processedAt: clock.now(),
      });
      return {
        httpStatus: 200 as const,
        outcome: changed ? ('processed' as const) : ('ignored-stale' as const),
        paymentId: payment.id,
      };
    });
  }

  /** Authenticated status API: the fallback when a webhook is late or lost. */
  async syncStatus(paymentId: string): Promise<Payment> {
    const payment = this.get(paymentId);
    if (!payment.providerPaymentId) return payment;
    const record = await this.provider.getStatus(payment.providerPaymentId);
    return this.ctx.db.transaction(() => this.applyStatus(this.get(paymentId), record, 'status-api'));
  }

  /**
   * The guest has come back from hosted checkout. Whatever the query string
   * claims, the answer comes from the gateway.
   */
  async handleReturn(paymentId: string, _query: Record<string, string>): Promise<Payment> {
    return this.syncStatus(paymentId);
  }

  refundable(payment: Payment): number {
    const pending = this.ctx.db
      .where('refunds', (r) => r.paymentId === payment.id && r.status === 'pending')
      .reduce((n, r) => n + r.amountMinor, 0);
    return Math.max(0, payment.amountMinor - payment.refundedMinor - pending);
  }

  async refund(input: {
    paymentId: string;
    amountMinor?: number;
    reason: string;
    actor: Actor;
    idempotencyKey: string;
  }): Promise<Refund> {
    const { db, ids, clock } = this.ctx;
    const existing = db.byUnique('refunds', 'idempotencyKey', input.idempotencyKey);
    if (existing) return existing;

    const payment = this.get(input.paymentId);
    if (!['succeeded', 'partially-refunded', 'refund-pending'].includes(payment.status)) {
      throw new DomainError('not_refundable', `A ${payment.status} payment cannot be refunded.`);
    }
    const refundable = this.refundable(payment);
    const amount = input.amountMinor ?? refundable;
    assertMinor(amount, 'refund');
    if (amount === 0 || amount > refundable) {
      throw new DomainError('refund_exceeds_balance', 'That is more than is left to refund on this payment.');
    }
    if (!input.reason.trim()) throw new DomainError('reason_required', 'Give a reason for the refund.');
    authorize(input.actor, 'payment.refund', amount);

    const now = clock.now();
    const refund = db.transaction(() => {
      const row = db.insert('refunds', {
        id: ids.id('rfd'),
        paymentId: payment.id,
        amountMinor: amount,
        reason: input.reason.trim(),
        status: 'pending',
        approvedBy: input.actor.id,
        providerReference: null,
        idempotencyKey: input.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      });
      if (payment.status !== 'refund-pending') {
        db.update('payments', payment.id, (p) => ({
          ...p,
          status: 'refund-pending',
          history: [...p.history, { status: 'refund-pending', at: now, source: 'refund-requested' }],
          updatedAt: now,
        }));
      }
      audit(this.ctx, input.actor, 'payment.refund-requested', 'payment', payment.id, {
        amountMinor: amount,
        reason: row.reason,
      });
      return row;
    });

    try {
      const record = await this.provider.refund({
        paymentId: payment.providerPaymentId!,
        amountMinor: amount,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      });
      return db.update('refunds', refund.id, { providerReference: record.id, updatedAt: clock.now() });
    } catch (err) {
      db.transaction(() => {
        db.update('refunds', refund.id, { status: 'failed', updatedAt: clock.now() });
        const p = this.get(payment.id);
        if (p.status === 'refund-pending') {
          const back: PaymentStatus = p.refundedMinor > 0 ? 'partially-refunded' : 'succeeded';
          db.update('payments', p.id, {
            status: back,
            history: [...p.history, { status: back, at: clock.now(), source: 'refund-failed' }],
          });
        }
        raiseAlert(this.ctx, {
          severity: 'critical',
          title: 'Refund failed at the gateway',
          body: `Refund of ${amount} on ${payment.id} failed: ${err instanceof Error ? err.message : String(err)}`,
          entityType: 'payment',
          entityId: payment.id,
        });
      });
      throw err;
    }
  }

  /** Background work: chase payments whose webhooks are overdue. */
  async work(): Promise<void> {
    const now = this.ctx.clock.now();
    const stale = this.ctx.db.where(
      'payments',
      (p) =>
        p.providerPaymentId !== null &&
        ['pending', 'requires-action', 'refund-pending'].includes(p.status) &&
        now - p.updatedAt > WEBHOOK_GRACE_MS,
    );
    for (const p of stale) {
      try {
        await this.syncStatus(p.id);
      } catch (err) {
        if (!isDomainError(err)) throw err;
      }
    }
  }

  resolveIncident(paymentId: string, by: string): void {
    resolveAlerts(this.ctx, paymentId, by);
  }
}
