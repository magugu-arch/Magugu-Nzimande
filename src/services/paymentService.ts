import { config } from '@/constants/config';
import type { PaymentMethodType } from '@/types';
import { delay, request } from './apiClient';

/**
 * Payment-gateway abstraction (brief §3).
 *
 * Screens ask for an authorisation and get back a result. Which South African
 * provider sits behind this — Peach Payments, Paystack, Yoco, Ozow — is a
 * configuration detail resolved here, never in checkout code.
 */

export interface PaymentIntent {
  intentId: string;
  amount: number;
  currency: string;
  /** Provider-hosted page for redirect rails (EFT, SnapScan). */
  redirectUrl?: string;
  status: 'requires_action' | 'authorised' | 'failed';
}

export interface AuthorisePaymentInput {
  amount: number;
  paymentMethodId: string;
  methodType: PaymentMethodType;
  orderReference: string;
}

export interface PaymentResult {
  success: boolean;
  intentId: string;
  /** Customer-facing reason when `success` is false. */
  message?: string;
}

/** Rails that hand off to a provider-hosted page rather than charging inline. */
const REDIRECT_METHODS: PaymentMethodType[] = ['eft', 'snapscan'];

export function requiresRedirect(methodType: PaymentMethodType): boolean {
  return REDIRECT_METHODS.includes(methodType);
}

/** Cash is settled at handover, so there is nothing to authorise up front. */
export function isSettledOnDelivery(methodType: PaymentMethodType): boolean {
  return methodType === 'cash';
}

export async function createPaymentIntent(
  input: AuthorisePaymentInput,
): Promise<PaymentIntent> {
  if (!config.useMockApi) {
    return request<PaymentIntent>('/v1/payments/intents', { method: 'POST', body: input });
  }

  return delay(
    {
      intentId: `pi_${Date.now().toString(36)}`,
      amount: input.amount,
      currency: 'ZAR',
      status: requiresRedirect(input.methodType) ? 'requires_action' : 'authorised',
    } satisfies PaymentIntent,
    500,
  );
}

export async function authorisePayment(input: AuthorisePaymentInput): Promise<PaymentResult> {
  if (isSettledOnDelivery(input.methodType)) {
    return { success: true, intentId: 'cash' };
  }

  if (!config.useMockApi) {
    return request<PaymentResult>('/v1/payments/authorise', { method: 'POST', body: input });
  }

  const intent = await createPaymentIntent(input);
  await delay(null, 700);

  return { success: true, intentId: intent.intentId };
}

/** Human label for a payment rail, used on checkout and order summaries. */
export function describePaymentMethod(methodType: PaymentMethodType): string {
  switch (methodType) {
    case 'card':
      return 'Credit or debit card';
    case 'eft':
      return 'Instant EFT';
    case 'snapscan':
      return 'SnapScan';
    case 'cash':
      return 'Cash on delivery';
    case 'applepay':
      return 'Apple Pay';
    case 'googlepay':
      return 'Google Pay';
  }
}
