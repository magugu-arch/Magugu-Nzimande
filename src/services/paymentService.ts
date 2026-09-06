import { config } from '@/constants/config';
import type { PaymentMethodType } from '@/types';
import { delay, request } from './apiClient';
import { checkedPaymentIntent, checkedPaymentResult } from './wireChecks';

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

export async function createPaymentIntent(input: AuthorisePaymentInput): Promise<PaymentIntent> {
  if (!config.useMockApi) {
    return request<PaymentIntent>('/v1/payments/intents', {
      method: 'POST',
      body: input,
      parse: checkedPaymentIntent<PaymentIntent>,
    });
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
    return request<PaymentResult>('/v1/payments/authorise', {
      method: 'POST',
      body: input,
      parse: checkedPaymentResult<PaymentResult>,
    });
  }

  const intent = await createPaymentIntent(input);
  await delay(null, 700);

  return { success: true, intentId: intent.intentId };
}

/**
 * Release an authorisation that was taken for an order which never existed.
 *
 * Checkout authorises the card and then creates the order. Anything between
 * those two calls — a dropped connection, a 500, an expired session — used to
 * leave the customer holding an authorisation with no order against it, and
 * the error they were shown invited them to try again, which would authorise a
 * second time.
 *
 * Cash needs no void because nothing was ever authorised.
 *
 * @returns whether the release was confirmed. False is not a crash: the money
 * is the gateway's to release either way, and most will drop an uncaptured
 * authorisation on their own. It decides what the customer is told.
 */
export async function voidPayment(intentId: string): Promise<boolean> {
  if (intentId === 'cash') return true;

  if (!config.useMockApi) {
    try {
      await request<void>(`/v1/payments/${encodeURIComponent(intentId)}/void`, { method: 'POST' });
      return true;
    } catch {
      return false;
    }
  }

  await delay(null, 300);
  return true;
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
