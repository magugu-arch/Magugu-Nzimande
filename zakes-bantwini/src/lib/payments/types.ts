import type { Booking, Customer, Payment } from '@/lib/booking/types';

export type CheckoutInput = {
  payment: Payment;
  booking: Booking;
  customer: Customer;
  itemName: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
};

/** Where to send the buyer: a form POST (PayFast) or a plain redirect. */
export type Checkout = { method: 'POST' | 'GET'; action: string; fields: Record<string, string> };

export type IncomingNotification = {
  /** Raw request body exactly as received — signatures are computed over it. */
  body: string;
  contentType: string;
  ip: string;
};

export type VerifiedNotification =
  | {
      ok: true;
      merchantReference: string;
      providerReference: string | null;
      status: 'complete' | 'failed' | 'cancelled';
      amountCents: number;
    }
  | { ok: false; reason: string };

/** Looks up what we expect to be paid for a merchant reference, so the provider can check the amount. */
export type ExpectedPayment = (merchantReference: string) => Promise<{ amountCents: number } | null>;

/**
 * A payment provider. The UX only ever sees `createCheckout`; swapping
 * PayFast for Peach Payments (or anything else) is a configuration change.
 * Secret keys stay on the server — nothing here runs in the browser.
 */
export interface PaymentProvider {
  readonly id: 'payfast' | 'peach' | 'sandbox';
  readonly label: string;
  createCheckout(input: CheckoutInput): Promise<Checkout>;
  verifyNotification(incoming: IncomingNotification, expected: ExpectedPayment): Promise<VerifiedNotification>;
}

export class PaymentsNotConfigured extends Error {
  constructor(detail: string) {
    super(`Payments are not configured: ${detail}`);
    this.name = 'PaymentsNotConfigured';
  }
}
