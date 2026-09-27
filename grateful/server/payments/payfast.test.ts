import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createPayfastProvider, payfastSignature, phpUrlencode } from './payfast';
import { PaymentVerificationError } from './types';

const cfg = { merchantId: '10000100', merchantKey: '46f0cd694581a', passphrase: 'jt7NOE43FZPn', sandbox: true, verifySourceIp: false };

describe('phpUrlencode', () => {
  it('matches PHP urlencode, which PayFast signs against', () => {
    expect(phpUrlencode('Grateful — Custom Fashion Design')).toBe('Grateful+%E2%80%94+Custom+Fashion+Design');
    expect(phpUrlencode("it's (~*!)")).toBe('it%27s+%28%7E%2A%21%29');
    expect(phpUrlencode('a@b.co.za')).toBe('a%40b.co.za');
  });
});

describe('PayFast checkout', () => {
  const provider = createPayfastProvider(cfg);
  const checkout = provider.createCheckout({
    reference: 'GR-ABC',
    amountCents: 50000,
    itemName: 'Grateful — Custom Fashion Design',
    itemDescription: 'Deposit',
    customer: { firstName: 'Thandi', lastName: '', email: 'thandi@example.com', phone: '+27 82 123 4567' },
    returnUrl: 'https://grateful.example/confirmation?booking=1',
    cancelUrl: 'https://grateful.example/payment?booking=1&cancelled=1',
    notifyUrl: 'https://grateful.example/api/webhooks/payfast',
  });

  it('posts to the sandbox process URL with the amount in rands', () => {
    expect(checkout.action).toBe('https://sandbox.payfast.co.za/eng/process');
    expect(checkout.fields.amount).toBe('500.00');
    expect(checkout.fields.cell_number).toBe('0821234567');
  });

  it('omits empty fields and signs the rest in documented order with the passphrase', () => {
    expect(checkout.fields).not.toHaveProperty('name_last');
    const { signature, ...rest } = checkout.fields;
    const expected = createHash('md5')
      .update(
        Object.entries(rest)
          .map(([k, v]) => `${k}=${phpUrlencode(v)}`)
          .join('&') + `&passphrase=${cfg.passphrase}`,
      )
      .digest('hex');
    expect(signature).toBe(expected);
    expect(Object.keys(rest).slice(0, 3)).toEqual(['merchant_id', 'merchant_key', 'return_url']);
  });

  it('never exposes the passphrase to the browser', () => {
    expect(JSON.stringify(checkout)).not.toContain(cfg.passphrase);
  });
});

describe('PayFast ITN verification', () => {
  const itn = (overrides: Record<string, string> = {}) => {
    const pairs: [string, string][] = Object.entries({
      m_payment_id: 'GR-ABC',
      pf_payment_id: '1089250',
      payment_status: 'COMPLETE',
      item_name: 'Grateful — Custom Fashion Design',
      amount_gross: '500.00',
      merchant_id: cfg.merchantId,
      ...overrides,
    });
    const signature = payfastSignature(pairs, cfg.passphrase);
    return new URLSearchParams([...pairs, ['signature', signature]]).toString();
  };

  it('accepts a correctly signed notification that PayFast validates', async () => {
    const fetchImpl = vi.fn(async () => new Response('VALID')) as unknown as typeof fetch;
    const n = await createPayfastProvider(cfg, fetchImpl).verifyNotification({ rawBody: itn(), ip: null });
    expect(n).toEqual({ reference: 'GR-ABC', providerReference: '1089250', outcome: 'paid', amountCents: 50000 });
    expect(fetchImpl).toHaveBeenCalledWith('https://sandbox.payfast.co.za/eng/query/validate', expect.anything());
  });

  it('rejects a tampered amount (signature no longer matches)', async () => {
    const body = itn().replace('amount_gross=500.00', 'amount_gross=5.00');
    await expect(createPayfastProvider(cfg, vi.fn() as unknown as typeof fetch).verifyNotification({ rawBody: body, ip: null })).rejects.toBeInstanceOf(PaymentVerificationError);
  });

  it('rejects when PayFast does not confirm it', async () => {
    const fetchImpl = vi.fn(async () => new Response('INVALID')) as unknown as typeof fetch;
    await expect(createPayfastProvider(cfg, fetchImpl).verifyNotification({ rawBody: itn(), ip: null })).rejects.toThrow(/validate/);
  });

  it('rejects a notification for another merchant', async () => {
    await expect(createPayfastProvider(cfg, vi.fn() as unknown as typeof fetch).verifyNotification({ rawBody: itn({ merchant_id: '999' }), ip: null })).rejects.toThrow(/merchant/);
  });
});
