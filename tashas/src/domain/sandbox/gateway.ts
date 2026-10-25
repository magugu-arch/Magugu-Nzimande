/**
 * SANDBOX payment gateway. No card data, no real money.
 *
 * It plays the part of a gateway with hosted checkout: the app is handed a
 * checkout URL, the guest chooses a test outcome on the gateway's own page,
 * and the result reaches the app only through a signed webhook or the status
 * API. That is the shape the brief requires of the real gateway (§13.3) and it
 * means the same PaymentService code runs against either.
 */

import type { Ctx } from '../context.ts';
import type {
  CreatePaymentRequest,
  PaymentProvider,
  PaymentRecord,
  PaymentStatus,
  SandboxGatewayPayment,
} from '../types.ts';
import { DomainError } from '../util/core.ts';
import { INVALID_SIGNATURE } from '../booking/provider.ts';
import { SANDBOX_PAYMENTS_SIGNING_KEY, SIGNATURE_HEADER, queueWebhook, verifySignature } from './webhooks.ts';

export const SANDBOX_CHECKOUT_SCHEME = 'sandbox-checkout:';

export type CheckoutOutcome = 'succeed' | 'decline' | 'require-action' | 'cancel';

export interface NamedPaymentProvider extends PaymentProvider {
  readonly name: string;
  readonly label: string;
  readonly isSandbox: boolean;
  readonly supportedCurrencies: string[];
  readonly methods: string[];
}

export class SandboxPaymentGateway implements NamedPaymentProvider {
  readonly name = 'sandbox-gateway';
  readonly label = 'Sandbox payment gateway';
  readonly isSandbox = true;
  readonly supportedCurrencies = ['ZAR'];
  /** Capability-discovered methods (brief §13.3); the sandbox offers only test cards. */
  readonly methods = ['Test card'];
  private ctx: Ctx;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  private emit(type: string, p: SandboxGatewayPayment, latencyMs = 600): void {
    const scenario = this.ctx.db.require('settings', 'global').sandbox;
    if (scenario.dropWebhooks) return;
    queueWebhook(
      this.ctx,
      'payments',
      SANDBOX_PAYMENTS_SIGNING_KEY,
      { id: this.ctx.ids.id('pev'), type, created: this.ctx.clock.now(), data: { payment: wire(p) } },
      { duplicate: scenario.duplicateWebhooks, latencyMs },
    );
  }

  async createCheckout(request: CreatePaymentRequest): Promise<{ payment: PaymentRecord; checkoutUrl?: string }> {
    if (!this.supportedCurrencies.includes(request.currency)) {
      throw new DomainError('unsupported_currency', `${request.currency} is not enabled on this account`);
    }
    const existing = this.ctx.db.byUnique('sandboxPayments', 'idempotencyKey', request.idempotencyKey);
    const now = this.ctx.clock.now();
    const p =
      existing ??
      this.ctx.db.insert('sandboxPayments', {
        id: this.ctx.ids.id('sbpay'),
        merchantReference: request.referenceId,
        purpose: request.purpose,
        amountMinor: request.amountMinor,
        currency: request.currency,
        status: 'pending',
        refundedMinor: 0,
        idempotencyKey: request.idempotencyKey,
        refundKeys: [],
        description: request.description,
        createdAt: now,
        updatedAt: now,
      });
    return { payment: wire(p), checkoutUrl: `${SANDBOX_CHECKOUT_SCHEME}${p.id}` };
  }

  async getStatus(paymentId: string): Promise<PaymentRecord> {
    return wire(this.ctx.db.require('sandboxPayments', paymentId));
  }

  async refund(request: {
    paymentId: string;
    amountMinor?: number;
    reason: string;
    idempotencyKey: string;
  }): Promise<PaymentRecord> {
    const p = this.ctx.db.require('sandboxPayments', request.paymentId);
    if (p.refundKeys.includes(request.idempotencyKey)) return wire(p);
    const refundable = p.amountMinor - p.refundedMinor;
    const amount = request.amountMinor ?? refundable;
    if (amount <= 0 || amount > refundable) {
      throw new DomainError('refund_exceeds_balance', 'Refund is larger than the amount left to refund.');
    }
    const refundedMinor = p.refundedMinor + amount;
    const status: PaymentStatus = refundedMinor === p.amountMinor ? 'refunded' : 'partially-refunded';
    const updated = this.ctx.db.update('sandboxPayments', p.id, {
      refundedMinor,
      status,
      refundKeys: [...p.refundKeys, request.idempotencyKey],
      updatedAt: this.ctx.clock.now(),
    });
    this.emit('refund.succeeded', updated, 900);
    // The caller sees the refund as pending until the webhook or status API says otherwise.
    return { ...wire(updated), status: 'refund-pending' };
  }

  async verifyWebhook(
    rawBody: Uint8Array,
    headers: Record<string, string>,
  ): Promise<{ eventId: string; payment: PaymentRecord; eventType: string }> {
    const body = new TextDecoder().decode(rawBody);
    if (!verifySignature(SANDBOX_PAYMENTS_SIGNING_KEY, body, headers[SIGNATURE_HEADER], this.ctx.clock.now())) {
      throw new DomainError(INVALID_SIGNATURE, 'Webhook signature did not verify.');
    }
    const parsed = JSON.parse(body) as { id: string; type: string; data: { payment: PaymentRecord } };
    return { eventId: parsed.id, payment: parsed.data.payment, eventType: parsed.type };
  }

  // ---- what the gateway's hosted checkout page does, not the Tashas app

  session(paymentId: string): SandboxGatewayPayment {
    return this.ctx.db.require('sandboxPayments', paymentId);
  }

  completeCheckout(paymentId: string, outcome: CheckoutOutcome): SandboxGatewayPayment {
    const p = this.ctx.db.require('sandboxPayments', paymentId);
    if (p.status !== 'pending' && p.status !== 'requires-action') return p;
    const status: PaymentStatus =
      outcome === 'succeed'
        ? 'succeeded'
        : outcome === 'decline'
          ? 'failed'
          : outcome === 'cancel'
            ? 'cancelled'
            : 'requires-action';
    const updated = this.ctx.db.update('sandboxPayments', p.id, { status, updatedAt: this.ctx.clock.now() });
    const type =
      status === 'succeeded'
        ? 'payment.succeeded'
        : status === 'failed'
          ? 'payment.failed'
          : status === 'cancelled'
            ? 'payment.cancelled'
            : 'payment.requires_action';
    this.emit(type, updated);
    return updated;
  }

  authenticate(paymentId: string, passed: boolean): SandboxGatewayPayment {
    const p = this.ctx.db.require('sandboxPayments', paymentId);
    if (p.status !== 'requires-action') return p;
    return this.completeCheckout(paymentId, passed ? 'succeed' : 'decline');
  }
}

/** The brief's wire record plus the refunded total, which refunds reconcile against. */
export type GatewayRecord = PaymentRecord & { refundedMinor: number };

function wire(p: SandboxGatewayPayment): GatewayRecord {
  return {
    id: p.id,
    provider: 'sandbox-gateway',
    providerPaymentId: p.id,
    referenceId: p.merchantReference,
    status: p.status,
    amountMinor: p.amountMinor,
    currency: p.currency,
    purpose: p.purpose,
    createdAt: new Date(p.createdAt).toISOString(),
    updatedAt: new Date(p.updatedAt).toISOString(),
    refundedMinor: p.refundedMinor,
  };
}

export function refundedOf(record: PaymentRecord): number {
  return (record as Partial<GatewayRecord>).refundedMinor ?? 0;
}
