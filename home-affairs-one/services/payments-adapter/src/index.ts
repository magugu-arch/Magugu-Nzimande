/**
 * Payment sandbox stub.
 *
 * Stands in for a hosted payment page. No money moves, no card or bank detail
 * is ever requested or stored, and every record is flagged `sandbox: true`.
 * Amounts are sample values from the catalogue, never real fees.
 */
import {
  DEMO,
  type PaymentRecord,
  type PaymentsPort,
  type SandboxOutcome,
} from '@hao/api-contracts';
import { createCollection, DAY, MINUTE, type Platform } from '@hao/local-platform';
import { GatewayError, type MutationOptions } from '@hao/shared-types';

/** The seeded, approved sandbox payment for Thandi's passport application. */
export const DEMO_SEED_PAYMENT_REF = 'PAY-DEMO-1001';

const STATUS_FOR_OUTCOME: Record<SandboxOutcome, PaymentRecord['status']> = {
  APPROVE: 'APPROVED',
  DECLINE: 'DECLINED',
  TIMEOUT: 'TIMED_OUT',
};

function seedPayments(platform: Platform): PaymentRecord[] {
  // The workflow mock submits this application 16 days ago; payment comes just before that.
  const created = platform.clock.now().getTime() - 16 * DAY - 6 * MINUTE;
  return [
    {
      paymentRef: DEMO_SEED_PAYMENT_REF,
      personToken: DEMO.persons.thandi,
      draftId: null,
      caseId: DEMO.cases.passportInProduction,
      description: 'Adult passport — sample amount',
      amountCents: 100,
      currency: 'ZAR',
      status: 'APPROVED',
      providerToken: 'tok_demo_seed1001',
      receiptNumber: 'RCPT-DEMO-1001',
      createdAt: platform.clock.iso(new Date(created)),
      updatedAt: platform.clock.iso(new Date(created + 2 * MINUTE)),
      sandbox: true,
    },
  ];
}

/** An opaque token that looks like what a provider would hand back. It encodes nothing. */
function providerToken(paymentRef: string, createdAt: string): string {
  let value = 0x811c9dc5;
  for (const char of `${paymentRef}|${createdAt}`) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 0x01000193);
  }
  return `tok_demo_${(value >>> 0).toString(36).padStart(7, '0')}`;
}

export function createPaymentsService(platform: Platform): PaymentsPort {
  const payments = createCollection<PaymentRecord>(
    platform,
    'payments.payments',
    (payment) => payment.paymentRef,
  );

  function ensureSeeded(): void {
    if (!payments.exists()) payments.replaceAll(seedPayments(platform));
  }

  function requirePayment(paymentRef: string): PaymentRecord {
    ensureSeeded();
    const payment = payments.get(paymentRef);
    if (!payment) {
      throw new GatewayError('NOT_FOUND', { safeMessage: 'We could not find that payment.' });
    }
    return payment;
  }

  function nextPaymentRef(): string {
    let ref = platform.ids.next('PAY-DEMO');
    while (payments.get(ref)) ref = platform.ids.next('PAY-DEMO');
    return ref;
  }

  function nextReceiptNumber(): string {
    const used = new Set(payments.all().map((payment) => payment.receiptNumber));
    let receipt = platform.ids.next('RCPT-DEMO');
    while (used.has(receipt)) receipt = platform.ids.next('RCPT-DEMO');
    return receipt;
  }

  return {
    async createPayment(input, _options: MutationOptions) {
      ensureSeeded();
      const description = input.description.trim();
      if (description.length === 0) {
        throw new GatewayError('VALIDATION', {
          safeMessage: 'We could not start the payment because it has no description.',
        });
      }
      if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
        throw new GatewayError('VALIDATION', {
          safeMessage: 'We could not start the payment because the amount is not valid.',
        });
      }
      const paymentRef = nextPaymentRef();
      const now = platform.clock.iso();
      return payments.put({
        paymentRef,
        personToken: input.personToken,
        draftId: input.draftId,
        caseId: input.caseId,
        description,
        amountCents: input.amountCents,
        currency: 'ZAR',
        status: 'PENDING',
        providerToken: providerToken(paymentRef, now),
        receiptNumber: null,
        createdAt: now,
        updatedAt: now,
        sandbox: true,
      });
    },

    async completeSandboxPayment(paymentRef, outcome, _options: MutationOptions) {
      const payment = requirePayment(paymentRef);
      if (payment.status === 'APPROVED') {
        throw new GatewayError('CONFLICT', {
          safeMessage: 'This payment has already been approved. You have not been charged twice.',
        });
      }
      // The outcome comes from a sandbox control, so it is checked at run time too.
      const status: PaymentRecord['status'] | undefined = STATUS_FOR_OUTCOME[outcome];
      if (status === undefined) {
        throw new GatewayError('VALIDATION', {
          safeMessage: 'That is not a sandbox outcome we recognise.',
        });
      }
      // A declined or timed-out payment stays open, so the person can try again.
      return payments.put({
        ...payment,
        status,
        receiptNumber: status === 'APPROVED' ? nextReceiptNumber() : null,
        updatedAt: platform.clock.iso(),
      });
    },

    async getPayment(paymentRef) {
      return requirePayment(paymentRef);
    },

    async listPayments(personToken) {
      ensureSeeded();
      // Stored oldest first; returned newest first.
      return payments.find((payment) => payment.personToken === personToken).reverse();
    },
  };
}
