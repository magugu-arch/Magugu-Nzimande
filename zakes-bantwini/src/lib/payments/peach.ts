import 'server-only';
import { PaymentsNotConfigured, type Checkout, type PaymentProvider, type VerifiedNotification } from './types';

/**
 * Peach Payments — the integration seam, not an integration. Peach's hosted
 * Checkout needs an entity id, a secret token and webhook decryption keys
 * issued per merchant; implement `createCheckout` and `verifyNotification`
 * against Peach's current API docs once management has an account. Until
 * then selecting it fails loudly rather than pretending to take money.
 */
export class PeachPayments implements PaymentProvider {
  readonly id = 'peach' as const;
  readonly label = 'Peach Payments';

  async createCheckout(): Promise<Checkout> {
    throw new PaymentsNotConfigured('the Peach Payments adapter is a stub — see src/lib/payments/peach.ts');
  }

  async verifyNotification(): Promise<VerifiedNotification> {
    return { ok: false, reason: 'Peach Payments adapter not implemented' };
  }
}
