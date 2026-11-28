import 'server-only';
import { createHash } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { absoluteUrl } from '@/content/site';
import type { PayableBooking, PaymentInit } from './index';

/**
 * PayFast (Network International) redirect checkout and ITN verification.
 * Follows PayFast's published integration: an MD5 signature over the fields in
 * their documented order, and four ITN checks (signature, source host, amount,
 * server-side validate). Test against sandbox.payfast.co.za before going live.
 */

const env = () => ({
  merchantId: process.env.PAYFAST_MERCHANT_ID ?? '',
  merchantKey: process.env.PAYFAST_MERCHANT_KEY ?? '',
  passphrase: process.env.PAYFAST_PASSPHRASE ?? '',
  sandbox: process.env.PAYFAST_SANDBOX !== '0',
  checkIp: process.env.PAYFAST_CHECK_IP !== '0',
});

export function payfastConfigured(): boolean {
  const e = env();
  return !!(e.merchantId && e.merchantKey);
}

const host = () => (env().sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za');

/** PHP urlencode(): spaces as "+", and the characters encodeURIComponent leaves alone. */
export function phpUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function signature(pairs: [string, string][], passphrase: string): string {
  const base = pairs
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${phpUrlencode(v.trim())}`)
    .join('&');
  const withPass = passphrase ? `${base}&passphrase=${phpUrlencode(passphrase.trim())}` : base;
  return createHash('md5').update(withPass).digest('hex');
}

export function payfastCheckout(b: PayableBooking): PaymentInit {
  const e = env();
  const [first, ...rest] = b.name.trim().split(/\s+/);
  const cell = b.phone.replace(/[^\d]/g, '').replace(/^27/, '0');
  // Order matters: PayFast signs the fields in the order its documentation lists them.
  const pairs: [string, string][] = [
    ['merchant_id', e.merchantId],
    ['merchant_key', e.merchantKey],
    ['return_url', absoluteUrl(`/booking/${b.id}/return`)],
    ['cancel_url', absoluteUrl(`/booking/${b.id}/return?cancelled=1`)],
    ['notify_url', absoluteUrl('/api/payments/payfast/notify')],
    ['name_first', (first ?? '').slice(0, 100)],
    ['name_last', rest.join(' ').slice(0, 100)],
    ['email_address', b.email.slice(0, 100)],
    ['cell_number', /^0\d{9}$/.test(cell) ? cell : ''],
    ['m_payment_id', b.id],
    ['amount', b.amount.toFixed(2)],
    ['item_name', `${b.ref} ${b.itemName}`.slice(0, 100)],
    ['custom_str1', b.ref],
  ];
  const fields = Object.fromEntries(pairs.filter(([, v]) => v !== ''));
  fields.signature = signature(pairs, e.passphrase);
  return { kind: 'form', action: `https://${host()}/eng/process`, fields };
}

const PAYFAST_HOSTS = ['www.payfast.co.za', 'sandbox.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za'];

async function payfastIps(): Promise<Set<string>> {
  const ips = new Set<string>();
  await Promise.all(
    PAYFAST_HOSTS.map(async (h) => {
      try {
        for (const ip of await dns.resolve4(h)) ips.add(ip);
      } catch {
        /* host may not resolve from every network */
      }
    }),
  );
  return ips;
}

export type ItnResult = {
  valid: boolean;
  reasons: string[];
  bookingId: string | null;
  status: string | null;
  amount: number | null;
  pfPaymentId: string | null;
};

/**
 * Verify an Instant Transaction Notification. `raw` is the urlencoded body as
 * received, so the signature is checked over the exact field order PayFast sent.
 */
export async function verifyItn(raw: string, remoteIp: string | null, expectedAmount: (bookingId: string) => Promise<number | null>): Promise<ItnResult> {
  const e = env();
  const reasons: string[] = [];
  const pairs: [string, string][] = raw
    .split('&')
    .filter(Boolean)
    .map((kv) => {
      const [k, v = ''] = kv.split('=');
      return [decodeURIComponent(k!.replace(/\+/g, ' ')), decodeURIComponent(v.replace(/\+/g, ' '))];
    });
  const params = Object.fromEntries(pairs);
  const received = params.signature ?? '';
  const withoutSig = pairs.filter(([k]) => k !== 'signature');

  // 1. Signature
  const base = withoutSig.map(([k, v]) => `${k}=${phpUrlencode(v)}`).join('&');
  const check = createHash('md5')
    .update(e.passphrase ? `${base}&passphrase=${phpUrlencode(e.passphrase.trim())}` : base)
    .digest('hex');
  if (check !== received) reasons.push('signature mismatch');

  // 2. Source host
  if (e.checkIp && remoteIp) {
    const ips = await payfastIps();
    if (ips.size > 0 && !ips.has(remoteIp)) reasons.push(`unexpected source ${remoteIp}`);
  }

  // 3. Amount
  const bookingId = params.m_payment_id ?? null;
  const amount = params.amount_gross ? Number(params.amount_gross) : null;
  const expected = bookingId ? await expectedAmount(bookingId) : null;
  if (expected == null) reasons.push('unknown booking');
  else if (amount == null || Math.abs(amount - expected) > 0.01) reasons.push(`amount ${amount} != ${expected}`);

  // 4. Ask PayFast to confirm it sent this
  if (reasons.length === 0) {
    try {
      const res = await fetch(`https://${host()}/eng/query/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: base,
      });
      const text = (await res.text()).trim();
      if (text !== 'VALID') reasons.push(`validate returned ${text.slice(0, 40)}`);
    } catch (err) {
      reasons.push(`validate unreachable: ${(err as Error).message}`);
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
    bookingId,
    status: params.payment_status ?? null,
    amount,
    pfPaymentId: params.pf_payment_id ?? null,
  };
}
