import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CheckoutForm } from '../../shared/types';
import { PaymentVerificationError, type CheckoutRequest, type NotificationRequest, type PaymentProvider, type VerifiedNotification } from './types';

/**
 * A stand-in gateway for development and tests. Its "hosted checkout" is the
 * /payment/mock page in this app, which posts back a notification signed
 * with a per-process secret — so the booking service goes through exactly the
 * same verify → confirm path it does with PayFast.
 *
 * Refused in production unless ALLOW_MOCK_PAYMENTS=true (see payments/index.ts).
 */

const secret = randomBytes(32);

export const mockSign = (reference: string, outcome: string, amountCents: number) =>
  createHmac('sha256', secret).update(`${reference}|${outcome}|${amountCents}`).digest('hex');

export function createMockProvider(): PaymentProvider {
  return {
    name: 'mock',

    createCheckout(req: CheckoutRequest): CheckoutForm {
      return {
        provider: 'mock',
        action: '/payment/mock',
        method: 'GET',
        fields: {
          reference: req.reference,
          amount: String(req.amountCents),
          item: req.itemName,
          return_url: req.returnUrl,
          cancel_url: req.cancelUrl,
          // Pre-signed for both outcomes so the page can only report what we allowed.
          sig_paid: mockSign(req.reference, 'paid', req.amountCents),
          sig_failed: mockSign(req.reference, 'failed', req.amountCents),
        },
      };
    },

    async verifyNotification(req: NotificationRequest): Promise<VerifiedNotification> {
      const p = new URLSearchParams(req.rawBody);
      const reference = p.get('reference') ?? '';
      const outcome = p.get('outcome') === 'paid' ? 'paid' : 'failed';
      const amountCents = Number(p.get('amount') ?? 0);
      const given = Buffer.from(p.get('signature') ?? '', 'hex');
      const expected = Buffer.from(mockSign(reference, outcome, amountCents), 'hex');
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        throw new PaymentVerificationError('Mock notification: bad signature');
      }
      return { reference, providerReference: `mock_${reference}`, outcome, amountCents };
    },
  };
}
