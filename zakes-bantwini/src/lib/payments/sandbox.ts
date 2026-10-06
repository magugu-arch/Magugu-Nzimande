import 'server-only';
import { safeEqual, sign } from '@/lib/security/crypto';
import type { Checkout, CheckoutInput, ExpectedPayment, IncomingNotification, PaymentProvider, VerifiedNotification } from './types';

/**
 * A local stand-in for a real gateway so the whole deposit journey can be
 * exercised end to end in development and in the smoke test. It takes no
 * money: the "checkout" is a page on this site with Pay and Fail buttons,
 * and its notifications are HMAC-signed with APP_SECRET. `getPaymentProvider`
 * refuses it in production unless ALLOW_SANDBOX_PAYMENTS=true.
 */
export class SandboxPayments implements PaymentProvider {
  readonly id = 'sandbox' as const;
  readonly label = 'Sandbox (no money moves)';

  async createCheckout(input: CheckoutInput): Promise<Checkout> {
    const fields = {
      ref: input.payment.merchantReference,
      amount: String(input.payment.amountCents),
      booking: input.booking.reference,
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
    };
    return { method: 'GET', action: '/book/pay/sandbox', fields: { ...fields, sig: sandboxSignature(fields.ref, fields.amount) } };
  }

  async verifyNotification(incoming: IncomingNotification, expected: ExpectedPayment): Promise<VerifiedNotification> {
    const data = Object.fromEntries(new URLSearchParams(incoming.body));
    const ref = data.ref ?? '';
    const amount = data.amount ?? '';
    if (!data.sig || !safeEqual(data.sig, sandboxSignature(ref, amount, data.outcome))) return { ok: false, reason: 'signature mismatch' };
    const want = await expected(ref);
    if (!want) return { ok: false, reason: `unknown payment ${ref}` };
    if (Number(amount) !== want.amountCents) return { ok: false, reason: 'amount mismatch' };
    return {
      ok: true,
      merchantReference: ref,
      providerReference: `sandbox-${ref}`,
      status: data.outcome === 'complete' ? 'complete' : 'failed',
      amountCents: want.amountCents,
    };
  }
}

export function sandboxSignature(ref: string, amount: string, outcome?: string): string {
  return sign([ref, amount, outcome ?? ''].join('|'), 'sandbox-payments');
}
