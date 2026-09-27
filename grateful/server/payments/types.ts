import type { CheckoutForm } from '../../shared/types';

export type CheckoutRequest = {
  /** Our payment reference; comes back in the notification. */
  reference: string;
  amountCents: number;
  itemName: string;
  itemDescription: string;
  customer: { firstName: string; lastName: string; email: string; phone: string };
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
};

export type NotificationRequest = {
  /** The raw form-encoded body, exactly as received — signatures are computed over it. */
  rawBody: string;
  ip: string | null;
};

export type VerifiedNotification = {
  reference: string;
  providerReference: string;
  outcome: 'paid' | 'failed' | 'cancelled' | 'pending';
  amountCents: number;
};

/**
 * A payment gateway. The front end only ever sees a CheckoutForm (where to
 * send the customer and with which fields), so swapping PayFast for another
 * hosted checkout means writing one of these and changing PAYMENT_PROVIDER.
 *
 * Card details never touch this server: every provider must be a hosted or
 * tokenised checkout.
 */
export interface PaymentProvider {
  readonly name: string;
  createCheckout(req: CheckoutRequest): CheckoutForm;
  /**
   * Prove a notification came from the gateway and is about a real payment.
   * Throws if it cannot be verified; the caller must then change nothing.
   * The amount is returned for the caller to compare with what it charged.
   */
  verifyNotification(req: NotificationRequest): Promise<VerifiedNotification>;
}

export class PaymentVerificationError extends Error {}
