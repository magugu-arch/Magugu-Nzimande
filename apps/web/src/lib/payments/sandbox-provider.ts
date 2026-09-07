import { PaymentEventSchema } from '@bbq/types';
import type { PaymentProvider } from './provider';
import { signatureMatches } from './provider';

/**
 * A provider that signs and settles the way a real one does, and moves no
 * money.
 *
 * It exists so the whole path — open an intent, receive a signed callback,
 * settle the order once — can be driven and tested before a merchant account
 * exists, and so the day one does exist the only new code is one adapter.
 *
 * It is not a stand-in that gets quietly promoted: it is selected by name, it
 * says what it is in `name`, and `BBQ_PAYMENT_PROVIDER=sandbox` in a production
 * environment is the sort of thing a deployment checklist can grep for.
 */

const SIGNATURE_HEADER = 'x-bbq-signature';

export function sandboxProvider(secret: string): PaymentProvider {
  return {
    name: 'sandbox',

    async createIntent(request) {
      // A real adapter posts to the gateway here. The reference is echoed back
      // rather than invented, because that is what the settlement is matched on
      // and a provider that loses it cannot be reconciled.
      return {
        ok: true,
        providerRef: `sandbox_${request.reference}`,
        redirectUrl: null,
      };
    },

    verify(rawBody, headers) {
      const claimed = headers.get(SIGNATURE_HEADER);
      if (!claimed) return false;
      return signatureMatches(rawBody, secret, claimed);
    },

    parse(rawBody) {
      try {
        const parsed = PaymentEventSchema.safeParse(JSON.parse(rawBody));
        return parsed.success ? parsed.data : null;
      } catch {
        // Verified bytes that are not JSON. Refused rather than thrown, so a
        // malformed callback is a 400 and not a stack trace in the logs.
        return null;
      }
    },

    async refund(providerRef) {
      /**
       * Refuses when the environment says to.
       *
       * Every real gateway's sandbox has a way to make a call fail on purpose —
       * a card number that always declines, an amount that always errors —
       * because the failure paths are the ones worth rehearsing and the ones a
       * happy-path sandbox never reaches. Ours has this.
       *
       * Namespaced to the sandbox, so it cannot affect a deployment talking to
       * a real gateway: the only provider that reads it is the one that moves
       * no money in the first place.
       */
      if (process.env.BBQ_SANDBOX_REFUSE_REFUND === 'true') {
        return { ok: false, error: 'the sandbox was told to refuse this refund' };
      }

      // A real adapter posts a refund instruction here and returns the
      // provider's reference for it. This one moves no money, like the rest of
      // it, so the whole refund path can be driven before a merchant account
      // exists — which is the only reason this provider is here at all.
      return { ok: true, providerRef: `refund_${providerRef}` };
    },
  };
}

export const SANDBOX_SIGNATURE_HEADER = SIGNATURE_HEADER;
