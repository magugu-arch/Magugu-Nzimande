import type { ServiceContext } from '../context';
import { nowIso } from '../context';
import { DomainError, notConfigured } from '../shared/errors';
import { idempotent } from '../shared/idempotency';
import type { PaymentIntent, PaymentProvider, PaymentPurpose } from './types';

/**
 * Deterministic stand-in for a hosted gateway. The token is what the hosted
 * page would return; these three let every outcome be exercised.
 */
export const MOCK_PAYMENT_TOKENS = {
  success: 'tok_mock_success',
  decline: 'tok_mock_decline',
  pending: 'tok_mock_pending',
} as const;

export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock-gateway';
  private n = 0;

  async charge(request: { methodToken: string }) {
    this.n += 1;
    const providerRef = `mockpay_${Date.now().toString(36)}_${this.n}`;
    switch (request.methodToken) {
      case MOCK_PAYMENT_TOKENS.decline:
        return {
          status: 'failed' as const,
          providerRef,
          reason: 'The card was declined by the bank.',
        };
      case MOCK_PAYMENT_TOKENS.pending:
        return { status: 'pending' as const, providerRef };
      default:
        return { status: 'succeeded' as const, providerRef };
    }
  }

  async refund(): Promise<void> {}
}

/** Used in live mode until Mábu's merchant gateway and credentials are supplied. */
export class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly id = 'unconfigured';
  async charge(): Promise<never> {
    throw notConfigured('payment-gateway');
  }
  async refund(): Promise<never> {
    throw notConfigured('payment-gateway');
  }
}

type SettledHandler = (intent: PaymentIntent) => Promise<void> | void;

/**
 * Payment state is tracked on its own intent, independent of what it pays for
 * (§33: "deposit/payment state must reconcile independently from reservation
 * state"). Owners subscribe to settlement rather than being called directly.
 */
export class PaymentsService {
  private handlers = new Map<PaymentPurpose, SettledHandler>();

  constructor(
    private readonly ctx: ServiceContext,
    private readonly provider: PaymentProvider,
  ) {}

  onSettled(purpose: PaymentPurpose, handler: SettledHandler): void {
    this.handlers.set(purpose, handler);
  }

  async charge(input: {
    purpose: PaymentPurpose;
    referenceId: string;
    amountCents: number;
    description: string;
    methodToken: string;
    idempotencyKey: string;
  }): Promise<PaymentIntent> {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new DomainError(
        'VALIDATION',
        'That amount is not valid.',
        `amount ${input.amountCents}`,
      );
    }
    return idempotent(
      this.ctx.db,
      'payment.charge',
      input.idempotencyKey,
      { ...input, methodToken: undefined },
      nowIso(this.ctx),
      async () => {
        const now = nowIso(this.ctx);
        const intent = this.ctx.db.payments.insert({
          id: this.ctx.ids.id('pay'),
          purpose: input.purpose,
          referenceId: input.referenceId,
          amountCents: input.amountCents,
          currency: 'ZAR',
          status: 'pending',
          provider: this.provider.id,
          idempotencyKey: input.idempotencyKey,
          createdAt: now,
          updatedAt: now,
        });
        let outcome: Awaited<ReturnType<PaymentProvider['charge']>>;
        try {
          outcome = await this.provider.charge({
            amountCents: input.amountCents,
            currency: 'ZAR',
            description: input.description,
            methodToken: input.methodToken,
            idempotencyKey: input.idempotencyKey,
          });
        } catch (error) {
          // A gateway that errors has not taken money we know of. Leave the
          // intent pending for reconciliation rather than guessing either way.
          this.ctx.db.payments.update(intent.id, {
            failureReason: error instanceof Error ? error.message : 'gateway error',
            updatedAt: nowIso(this.ctx),
          });
          throw error;
        }
        const updated = this.ctx.db.payments.update(intent.id, {
          status: outcome.status,
          providerRef: outcome.providerRef,
          failureReason: outcome.reason,
          updatedAt: nowIso(this.ctx),
        });
        return updated;
      },
    );
  }

  /**
   * Server-side reconciliation (§23). In production a gateway webhook calls
   * this; in the mock back end the admin screen does.
   */
  async settle(intentId: string, status: 'succeeded' | 'failed'): Promise<PaymentIntent> {
    const intent = this.ctx.db.payments.require(intentId, 'payment');
    if (intent.status !== 'pending') return intent;
    const updated = this.ctx.db.payments.update(intentId, { status, updatedAt: nowIso(this.ctx) });
    await this.handlers.get(updated.purpose)?.(updated);
    return updated;
  }

  async refund(intentId: string): Promise<PaymentIntent> {
    const intent = this.ctx.db.payments.require(intentId, 'payment');
    if (intent.status !== 'succeeded') return intent;
    if (intent.providerRef) await this.provider.refund(intent.providerRef, intent.amountCents);
    return this.ctx.db.payments.update(intentId, {
      status: 'refunded',
      updatedAt: nowIso(this.ctx),
    });
  }

  pending(): PaymentIntent[] {
    return this.ctx.db.payments.filter((p) => p.status === 'pending');
  }
}
