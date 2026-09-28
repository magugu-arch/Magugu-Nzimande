/**
 * PayFast hosted checkout (brief §20, §23), written to PayFast's published
 * "custom integration" specification:
 *
 *   1. The app asks for a payment; the intent is created `pending` and its
 *      checkout URL points at this server's /pay/<intent id>.
 *   2. That page posts a signed form to PayFast, where the guest pays. Mábu
 *      never sees a card.
 *   3. PayFast posts an ITN (instant transaction notification) to
 *      /webhooks/payfast. It is trusted only when the signature matches, the
 *      merchant id is ours, PayFast confirms it through its validate endpoint,
 *      and the amount equals the intent's. Then the intent settles and the
 *      voucher, ticket or deposit completes.
 *
 * Refunds are made in the PayFast dashboard; the refund API needs its own
 * credentials and is left for when Mábu has an account.
 *
 * Not yet run against PayFast's sandbox from this build environment (its
 * network blocks PayFast). Run one sandbox payment before going live.
 */
import { createHash } from 'node:crypto';
import type { ChargeRequest, PaymentProvider } from '../../src/domain/payments/types';
import { DomainError } from '../../src/domain/shared/errors';

export interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  /** The "salt passphrase" set in the PayFast dashboard; optional but recommended. */
  passphrase?: string;
  sandbox: boolean;
  /** This server's public https origin, e.g. https://api.maburestaurant.com */
  publicUrl: string;
}

export const payfastHost = (sandbox: boolean) =>
  sandbox ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za';

/** PHP's urlencode, which PayFast signs with: spaces as '+', every reserved character escaped. */
export function phpUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * MD5 of the non-empty fields in the order given, as key=urlencoded value
 * joined by '&', with the passphrase appended when there is one.
 */
export function payfastSignature(fields: [string, string][], passphrase?: string): string {
  const parts = fields
    .filter(([key, value]) => key !== 'signature' && value !== '')
    .map(([key, value]) => `${key}=${phpUrlencode(value.trim())}`);
  if (passphrase) parts.push(`passphrase=${phpUrlencode(passphrase.trim())}`);
  return createHash('md5').update(parts.join('&')).digest('hex');
}

const rands = (cents: number) => (cents / 100).toFixed(2);

export class PayFastProvider implements PaymentProvider {
  readonly id = 'payfast';
  constructor(private readonly config: PayFastConfig) {}

  async charge(request: ChargeRequest) {
    // Nothing is taken here: the guest pays on PayFast's page, and the ITN settles it.
    return {
      status: 'pending' as const,
      checkoutUrl: `${this.config.publicUrl}/pay/${encodeURIComponent(request.reference)}`,
    };
  }

  async refund(): Promise<never> {
    throw new DomainError(
      'NOT_CONFIGURED',
      'Refunds are made in the PayFast dashboard for now.',
      'payfast refund api not configured',
    );
  }

  /**
   * The fields for the checkout form, in PayFast's documented order (the
   * signature depends on the order).
   */
  checkoutFields(input: {
    intentId: string;
    amountCents: number;
    itemName: string;
    email?: string;
    firstName?: string;
  }): [string, string][] {
    const base = this.config.publicUrl;
    const fields: [string, string][] = [
      ['merchant_id', this.config.merchantId],
      ['merchant_key', this.config.merchantKey],
      ['return_url', `${base}/pay/${input.intentId}/done`],
      ['cancel_url', `${base}/pay/${input.intentId}/cancelled`],
      ['notify_url', `${base}/webhooks/payfast`],
      ['name_first', input.firstName ?? ''],
      ['email_address', input.email ?? ''],
      ['m_payment_id', input.intentId],
      ['amount', rands(input.amountCents)],
      ['item_name', input.itemName.slice(0, 100)],
    ];
    const kept = fields.filter(([, v]) => v !== '');
    kept.push(['signature', payfastSignature(kept, this.config.passphrase)]);
    return kept;
  }

  checkoutPage(fields: [string, string][]): string {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inputs = fields
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
      .join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mábu · Secure payment</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0B0B;color:#E8E1D6;font-family:Helvetica,Arial,sans-serif;text-align:center;padding:24px}button{margin-top:20px;background:#C9A35B;color:#0B0B0B;border:0;border-radius:999px;padding:14px 28px;font-weight:600;letter-spacing:.12em;text-transform:uppercase}</style></head>
<body><form method="post" action="${payfastHost(this.config.sandbox)}/eng/process" id="pf">${inputs}
<div><div style="font-family:Georgia,serif;letter-spacing:6px;color:#C9A35B;font-size:24px">MÁBU</div>
<p>Taking you to PayFast to pay securely…</p><noscript><button type="submit">Continue to PayFast</button></noscript></div></form>
<script>document.getElementById('pf').submit()</script></body></html>`;
  }

  /**
   * Checks an ITN. `validate` posts the parameter string back to PayFast and
   * resolves true when PayFast answers VALID.
   */
  async verifyNotification(
    fields: [string, string][],
    validate: (host: string, body: string) => Promise<boolean>,
  ): Promise<
    | {
        ok: true;
        intentId: string;
        status: 'succeeded' | 'failed' | 'pending';
        amountCents: number;
        providerRef?: string;
      }
    | { ok: false; reason: string }
  > {
    const get = (k: string) => fields.find(([key]) => key === k)?.[1] ?? '';
    const signature = get('signature');
    // ITN signatures cover every posted field except the signature, in the posted order,
    // including empty ones.
    const parts = fields
      .filter(([k]) => k !== 'signature')
      .map(([k, v]) => `${k}=${phpUrlencode(v.trim())}`);
    if (this.config.passphrase) parts.push(`passphrase=${phpUrlencode(this.config.passphrase)}`);
    const expected = createHash('md5').update(parts.join('&')).digest('hex');
    if (!signature || signature !== expected) return { ok: false, reason: 'bad signature' };
    if (get('merchant_id') !== this.config.merchantId)
      return { ok: false, reason: 'wrong merchant' };
    const body = fields
      .filter(([k]) => k !== 'signature')
      .map(([k, v]) => `${k}=${phpUrlencode(v)}`)
      .join('&');
    if (!(await validate(payfastHost(this.config.sandbox), body)))
      return { ok: false, reason: 'not confirmed by PayFast' };
    const statusText = get('payment_status').toUpperCase();
    const status =
      statusText === 'COMPLETE' ? 'succeeded' : statusText === 'PENDING' ? 'pending' : 'failed';
    return {
      ok: true,
      intentId: get('m_payment_id'),
      status,
      amountCents: Math.round(Number(get('amount_gross')) * 100),
      providerRef: get('pf_payment_id') || undefined,
    };
  }
}

/** PayFast's validate endpoint, used in production. */
export async function payfastValidate(host: string, body: string): Promise<boolean> {
  const res = await fetch(`${host}/eng/query/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return (await res.text()).trim() === 'VALID';
}
