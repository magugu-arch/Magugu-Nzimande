import { promises as dns } from 'node:dns';
import type { PaymentEvent, PaymentStatus } from '@bbq/types';
import type { PaymentProvider } from '../provider';
import { centsToRands, sign } from './encoding';
import {
  PAYFAST_HOSTS,
  entriesOf,
  fromPayfast,
  grossCents,
  postbackValid,
  signatureMatches,
  type Resolver,
} from './itn';

/**
 * PayFast.
 *
 * A redirect gateway rather than an API: there is no server-to-server call that
 * opens a payment. The merchant signs a set of fields, sends the customer to
 * PayFast with them, and hears the outcome on a notification URL. So
 * `createIntent` builds and signs that redirect, and all the real work is in
 * believing the notification when it arrives.
 *
 * Credentials come from the environment and appear nowhere in this file. The
 * merchant id and key are not secrets in the way the passphrase is — they
 * travel in the redirect the customer can read — but the passphrase is what
 * makes a signature mean anything, and it is never logged, echoed or returned.
 */

export type PayfastConfig = {
  merchantId: string;
  merchantKey: string;
  /** Optional at PayFast; required by us. See `payfastProvider` below. */
  passphrase: string;
  sandbox: boolean;
  /** Where PayFast sends the customer and the notification. */
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  /** Injected so the checks can be driven in a test without DNS or a network. */
  resolver?: Resolver;
  fetcher?: typeof fetch;
};

/**
 * PayFast's payment status, mapped onto ours.
 *
 * Their vocabulary is smaller than it looks: a payment is complete, it failed,
 * the customer abandoned it, or it is still moving. `CANCELLED` maps to failed
 * rather than to a state of its own, because from the order's point of view an
 * abandoned payment and a declined one need the same thing to happen next.
 */
function statusOf(payfastStatus: string): PaymentStatus | null {
  switch (payfastStatus.toUpperCase()) {
    case 'COMPLETE':
      return 'captured';
    case 'FAILED':
    case 'CANCELLED':
      return 'failed';
    case 'PENDING':
      return 'pending';
    default:
      // A status they have added since this was written. Not guessed at:
      // returning null makes the route answer 400 and leaves the order alone,
      // which is recoverable, rather than settling it on a word we invented a
      // meaning for.
      return null;
  }
}

export function payfastProvider(config: PayfastConfig): PaymentProvider {
  const host = config.sandbox ? PAYFAST_HOSTS.sandbox : PAYFAST_HOSTS.live;
  const resolve: Resolver = config.resolver ?? ((name) => dns.resolve4(name));

  return {
    name: config.sandbox ? 'payfast-sandbox' : 'payfast',

    async createIntent(request) {
      /**
       * Field order is the signature. PayFast signs these in the order they are
       * sent, so this array is the specification and not a convenience — sorting
       * it, or building it from an object whose key order anyone might change,
       * produces a signature PayFast rejects for reasons that look like a
       * credential problem.
       */
      const fields: [string, string][] = [
        ['merchant_id', config.merchantId],
        ['merchant_key', config.merchantKey],
        // The caller's return URL when it named one, so the customer comes back
        // to their own order rather than to a page that has to guess.
        ['return_url', request.returnUrl ?? config.returnUrl],
        ['cancel_url', request.cancelUrl ?? config.cancelUrl],
        ['notify_url', config.notifyUrl],
        // Our reference, echoed back on the notification. This is what ties a
        // settlement to an intent, so it is the intent id and nothing else.
        ['m_payment_id', request.reference],
        ['amount', centsToRands(request.amountCents)],
        ['item_name', request.description],
      ];

      const query = fields
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');

      return {
        ok: true,
        // PayFast has not been asked anything yet, so there is no reference of
        // theirs to record. Ours stands in until the notification brings back a
        // pf_payment_id, and reconciliation uses it in the meantime.
        providerRef: request.reference,
        redirectUrl: `https://${host}/eng/process?${query}&signature=${sign(fields, config.passphrase)}`,
      };
    },

    /**
     * All four of PayFast's checks, in the order that spends the least on a
     * notification that was never going to be believed.
     *
     * The signature is free and rejects anything from someone without the
     * passphrase. The source check costs a DNS lookup. The postback costs a
     * round trip to PayFast and is the only one that catches a replay of a
     * genuine notification, so it is last and it is not optional.
     */
    async verify(rawBody, headers) {
      if (!signatureMatches(rawBody, config.passphrase)) return false;

      const sourceIp = clientIpFrom(headers);
      if (!(await fromPayfast(sourceIp, resolve))) return false;

      return postbackValid(rawBody, { sandbox: config.sandbox, fetcher: config.fetcher });
    },

    parse(rawBody) {
      const entries = entriesOf(rawBody);
      const field = (name: string) => entries.find(([key]) => key === name)?.[1];

      const intentId = field('m_payment_id');
      const pfPaymentId = field('pf_payment_id');
      const rawStatus = field('payment_status');
      if (!intentId || !pfPaymentId || !rawStatus) return null;

      const status = statusOf(rawStatus);
      if (!status) return null;

      const amountCents = grossCents(entries);
      if (amountCents === null) return null;

      const event: PaymentEvent = {
        /**
         * The idempotency key, and the one decision here worth arguing about.
         *
         * PayFast reuses `pf_payment_id` across every notification for one
         * payment, so keying on it alone would settle the first — usually
         * PENDING — and silently drop the COMPLETE that follows. Keyed on the
         * pair, each distinct outcome applies once and a redelivery of any of
         * them is a replay.
         */
        id: `${pfPaymentId}:${status}`,
        intentId,
        status,
        providerRef: pfPaymentId,
        amountCents,
        failureReason: status === 'failed' ? `PayFast reported ${rawStatus}` : null,
      };

      return event;
    },
  };
}

/**
 * The address the notification came from.
 *
 * `x-forwarded-for` is a list, and only the last entry is added by a proxy we
 * control — the earlier ones are whatever the client sent and can say anything.
 * Taking the first would let a caller name its own source address, which is the
 * check being made here, so the last is used.
 */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map((hop) => hop.trim()).filter(Boolean);
    return hops[hops.length - 1] ?? null;
  }
  return headers.get('x-real-ip');
}
