import { createHash } from 'node:crypto';
import { promises as dns } from 'node:dns';
import type { CheckoutForm } from '../../shared/types';
import { PaymentVerificationError, type CheckoutRequest, type NotificationRequest, type PaymentProvider, type VerifiedNotification } from './types';

/**
 * PayFast — hosted checkout for South Africa.
 * Docs: https://developers.payfast.co.za/docs#step_1_form_fields
 *
 * PROVIDER-SPECIFIC. Everything PayFast-shaped lives in this file:
 *  - checkout: an HTML form POSTed to PayFast's process URL, signed with an
 *    MD5 over the fields in PayFast's documented order plus the passphrase.
 *    The signature is computed here, server-side, so the passphrase never
 *    reaches the browser.
 *  - ITN (Instant Transaction Notification): PayFast POSTs to notify_url. We
 *    accept it only if (1) the signature matches, (2) it came from a PayFast
 *    host, and (3) PayFast's own validate endpoint says VALID. The booking
 *    service then (4) checks the amount against what we charged.
 */

type PayfastConfig = {
  merchantId: string;
  merchantKey: string;
  passphrase?: string | undefined;
  sandbox: boolean;
  verifySourceIp: boolean;
};

const HOSTS = {
  live: 'https://www.payfast.co.za',
  sandbox: 'https://sandbox.payfast.co.za',
};

/** Hosts PayFast sends ITNs from, per their docs. Resolved at check time as the IPs change. */
const ITN_HOSTNAMES = ['www.payfast.co.za', 'sandbox.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za'];

/** PHP's urlencode(), which PayFast's signature is defined against. */
export function phpUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
}

export function payfastSignature(pairs: [string, string][], passphrase?: string): string {
  let s = pairs.map(([k, v]) => `${k}=${phpUrlencode(v.trim())}`).join('&');
  if (passphrase) s += `&passphrase=${phpUrlencode(passphrase.trim())}`;
  return createHash('md5').update(s).digest('hex');
}

export function createPayfastProvider(cfg: PayfastConfig, fetchImpl: typeof fetch = fetch): PaymentProvider {
  const base = cfg.sandbox ? HOSTS.sandbox : HOSTS.live;

  return {
    name: 'payfast',

    createCheckout(req: CheckoutRequest): CheckoutForm {
      // Order matters: it is the order PayFast signs in. Empty values are omitted.
      const ordered: [string, string][] = [
        ['merchant_id', cfg.merchantId],
        ['merchant_key', cfg.merchantKey],
        ['return_url', req.returnUrl],
        ['cancel_url', req.cancelUrl],
        ['notify_url', req.notifyUrl],
        ['name_first', req.customer.firstName],
        ['name_last', req.customer.lastName],
        ['email_address', req.customer.email],
        ['cell_number', req.customer.phone.replace(/[^\d]/g, '').replace(/^27/, '0')],
        ['m_payment_id', req.reference],
        ['amount', (req.amountCents / 100).toFixed(2)],
        ['item_name', req.itemName.slice(0, 100)],
        ['item_description', req.itemDescription.slice(0, 255)],
      ];
      const pairs = ordered.filter(([, v]) => v !== '');
      const fields = Object.fromEntries(pairs);
      fields.signature = payfastSignature(pairs, cfg.passphrase);
      return { provider: 'payfast', action: `${base}/eng/process`, method: 'POST', fields };
    },

    async verifyNotification(req: NotificationRequest): Promise<VerifiedNotification> {
      const params = [...new URLSearchParams(req.rawBody).entries()];
      const data = Object.fromEntries(params);

      // 1. Signature, over every field as received except the signature itself.
      const unsigned = params.filter(([k]) => k !== 'signature');
      if (!data.signature || payfastSignature(unsigned, cfg.passphrase) !== data.signature) {
        throw new PaymentVerificationError('PayFast ITN: signature mismatch');
      }
      if (data.merchant_id !== cfg.merchantId) throw new PaymentVerificationError('PayFast ITN: merchant mismatch');

      // 2. Source host.
      if (cfg.verifySourceIp) {
        if (!req.ip) throw new PaymentVerificationError('PayFast ITN: no source IP');
        const valid = new Set<string>();
        for (const host of ITN_HOSTNAMES) {
          for (const ip of await dns.resolve4(host).catch(() => [] as string[])) valid.add(ip);
        }
        if (!valid.has(req.ip.replace(/^::ffff:/, ''))) throw new PaymentVerificationError(`PayFast ITN: unexpected source ${req.ip}`);
      }

      // 3. Ask PayFast to confirm it sent this.
      const paramString = unsigned.map(([k, v]) => `${k}=${phpUrlencode(v)}`).join('&');
      const res = await fetchImpl(`${base}/eng/query/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: paramString,
      });
      const text = (await res.text()).trim();
      if (text !== 'VALID') throw new PaymentVerificationError(`PayFast ITN: validate returned ${text.slice(0, 40)}`);

      const status = (data.payment_status ?? '').toUpperCase();
      return {
        reference: data.m_payment_id ?? '',
        providerReference: data.pf_payment_id ?? '',
        outcome: status === 'COMPLETE' ? 'paid' : status === 'CANCELLED' ? 'cancelled' : status === 'FAILED' ? 'failed' : 'pending',
        amountCents: Math.round(Number(data.amount_gross ?? '0') * 100),
      };
    },
  };
}
