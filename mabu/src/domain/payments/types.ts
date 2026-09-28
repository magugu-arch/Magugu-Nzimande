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
  /** Hosted checkout page the guest is sent to, when the gateway uses one. */
  checkoutUrl?: string;
  failureReason?: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChargeRequest {
  /** The payment intent's id — the gateway's merchant reference. */
  reference: string;
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
    /** Redirect gateways answer `pending` with the page to send the guest to. */
    checkoutUrl?: string;
  }>;
  refund(providerRef: string, amountCents: number): Promise<void>;
}
