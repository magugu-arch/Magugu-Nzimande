import 'server-only';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import type { Checkout, CheckoutInput, ExpectedPayment, IncomingNotification, PaymentProvider, VerifiedNotification } from './types';

/**
 * PHP-style urlencode, which PayFast's signature is defined over: spaces as
 * "+", and !'()*~ percent-encoded (encodeURIComponent leaves those alone).
 */
export function pfEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** MD5 over `key=value&…` (+ passphrase), in the order the fields are given. */
export function pfSignature(fields: [string, string][], passphrase?: string): string {
  let s = fields.map(([k, v]) => `${k}=${pfEncode(v)}`).join('&');
  if (passphrase) s += `&passphrase=${pfEncode(passphrase)}`;
  return createHash('md5').update(s).digest('hex');
}

/** PayFast's documented checkout field order; the signature depends on it. */
const FIELD_ORDER = [
  'merchant_id',
  'merchant_key',
  'return_url',
  'cancel_url',
  'notify_url',
  'name_first',
  'name_last',
  'email_address',
  'cell_number',
  'm_payment_id',
  'amount',
  'item_name',
  'item_description',
  'custom_str1',
  'custom_str2',
] as const;

const VALID_HOSTS = ['www.payfast.co.za', 'sandbox.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za'];

export type PayFastConfig = { merchantId: string; merchantKey: string; passphrase?: string; sandbox: boolean };

export class PayFast implements PaymentProvider {
  readonly id = 'payfast' as const;
  readonly label = 'PayFast';

  constructor(private readonly config: PayFastConfig) {}

  private get host() {
    return this.config.sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
  }

  async createCheckout(input: CheckoutInput): Promise<Checkout> {
    const [first, ...rest] = input.customer.fullName.trim().split(/\s+/);
    const values: Record<(typeof FIELD_ORDER)[number], string> = {
      merchant_id: this.config.merchantId,
      merchant_key: this.config.merchantKey,
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      notify_url: input.notifyUrl,
      name_first: (first ?? '').slice(0, 100),
      name_last: rest.join(' ').slice(0, 100),
      email_address: input.customer.email,
      cell_number: input.customer.phone.replace(/[^\d]/g, '').replace(/^27/, '0').slice(0, 10),
      m_payment_id: input.payment.merchantReference,
      amount: (input.payment.amountCents / 100).toFixed(2),
      item_name: input.itemName.slice(0, 100),
      item_description: `Booking ${input.booking.reference}`.slice(0, 255),
      custom_str1: input.booking.reference,
      custom_str2: input.payment.kind,
    };
    const ordered = FIELD_ORDER.map((k) => [k, values[k].trim()] as [string, string]).filter(([, v]) => v !== '');
    const signature = pfSignature(ordered, this.config.passphrase);
    return {
      method: 'POST',
      action: `https://${this.host}/eng/process`,
      fields: { ...Object.fromEntries(ordered), signature },
    };
  }

  /**
   * ITN validation, all four of PayFast's checks:
   * 1. signature over the posted fields (in order, minus `signature`) + passphrase
   * 2. the request came from a PayFast server
   * 3. the amount matches what we asked for
   * 4. PayFast confirms the data server-to-server (/eng/query/validate → VALID)
   */
  async verifyNotification(incoming: IncomingNotification, expected: ExpectedPayment): Promise<VerifiedNotification> {
    const pairs = [...new URLSearchParams(incoming.body)];
    const data = Object.fromEntries(pairs);
    const unsigned = pairs.filter(([k]) => k !== 'signature');

    if (pfSignature(unsigned, this.config.passphrase) !== data.signature) return { ok: false, reason: 'signature mismatch' };

    if (process.env.PAYFAST_SKIP_IP_CHECK !== 'true' && !(await this.fromPayFast(incoming.ip))) {
      return { ok: false, reason: `source ${incoming.ip} is not a PayFast server` };
    }

    if (data.merchant_id !== this.config.merchantId) return { ok: false, reason: 'merchant mismatch' };

    const merchantReference = data.m_payment_id ?? '';
    const want = await expected(merchantReference);
    if (!want) return { ok: false, reason: `unknown payment ${merchantReference}` };
    const gross = Math.round(Number(data.amount_gross) * 100);
    if (!Number.isFinite(gross) || Math.abs(gross - want.amountCents) > 1) return { ok: false, reason: 'amount mismatch' };

    const paramString = unsigned.map(([k, v]) => `${k}=${pfEncode(v)}`).join('&');
    const confirm = await fetch(`https://${this.host}/eng/query/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: paramString,
      signal: AbortSignal.timeout(10_000),
    });
    if ((await confirm.text()).trim() !== 'VALID') return { ok: false, reason: 'server confirmation failed' };

    const status = data.payment_status === 'COMPLETE' ? 'complete' : data.payment_status === 'CANCELLED' ? 'cancelled' : 'failed';
    return { ok: true, merchantReference, providerReference: data.pf_payment_id ?? null, status, amountCents: gross };
  }

  private async fromPayFast(ip: string): Promise<boolean> {
    const addresses = await Promise.all(
      VALID_HOSTS.map((h) =>
        lookup(h, { all: true })
          .then((r) => r.map((a) => a.address))
          .catch(() => [] as string[]),
      ),
    );
    return addresses.flat().includes(ip.replace(/^::ffff:/, ''));
  }
}
