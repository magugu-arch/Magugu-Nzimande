/**
 * Payment-provider abstraction — brief §20 and §28 PAYMENTS.
 *
 * The app never sees a card number and never holds a secret key. A real
 * gateway (Peach, PayFast, Yoco, Stitch … — whichever Mábu's merchant account
 * approves) runs a hosted checkout; the server creates the intent, the guest
 * completes it on the gateway's page, and the server reconciles the result.
 * `methodToken` stands for what the hosted page hands back.
 */
export type PaymentPurpose = 'voucher' | 'event' | 'deposit';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface PaymentIntent {
  id: string;
  purpose: PaymentPurpose;
  referenceId: string;
  amountCents: number;
  currency: 'ZAR';
  status: PaymentStatus;
  provider: string;
  providerRef?: string;
  failureReason?: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChargeRequest {
  amountCents: number;
  currency: 'ZAR';
  description: string;
  methodToken: string;
  idempotencyKey: string;
}

export interface PaymentProvider {
  id: string;
  charge(request: ChargeRequest): Promise<{
    status: 'succeeded' | 'failed' | 'pending';
    providerRef?: string;
    reason?: string;
  }>;
  refund(providerRef: string, amountCents: number): Promise<void>;
}
