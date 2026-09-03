import { createHash } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as webhookRoute } from '@/app/api/payments/webhook/route';
import {
  centsToRands,
  parameterString,
  payfastEncode,
  randsToCents,
  sign,
} from '@/lib/payments/payfast/encoding';
import { entriesOf, fromPayfast, postbackValid, signatureMatches } from '@/lib/payments/payfast/itn';
import { clientIpFrom, payfastProvider } from '@/lib/payments/payfast/provider';
import { intentForOrder, openIntent } from '@/lib/payments/ledger';
import { activeProvider } from '@/lib/payments/registry';
import { blankState, placeOrder } from './fixtures';

/**
 * The PayFast adapter.
 *
 * Written against their published integration and driven with no merchant
 * account: everything here is either arithmetic on the signature, or a check
 * with its network dependency injected. What cannot be tested without
 * credentials is the one thing credentials buy — that PayFast agrees our
 * signature is right — and that is what a sandbox account is for.
 *
 * Most of this is the encoding. It is where integrations against PayFast go
 * wrong, and the failure is the worst shape available: the signature is correct
 * for most payments and wrong for the ones whose fields happen to contain an
 * apostrophe or a bracket.
 */

const PASSPHRASE = 'a-test-passphrase';

const ENV = {
  BBQ_PAYMENT_PROVIDER: 'payfast',
  BBQ_PAYMENT_SECRET: PASSPHRASE,
  BBQ_PAYFAST_MERCHANT_ID: '10000100',
  BBQ_PAYFAST_MERCHANT_KEY: '46f0cd694581a',
  BBQ_PUBLIC_URL: 'https://order.example.co.za',
};

/** A notification body, signed the way PayFast signs one. */
function notification(fields: [string, string][], passphrase = PASSPHRASE): string {
  const body = fields.map(([key, value]) => `${key}=${payfastEncode(value)}`).join('&');
  return `${body}&signature=${sign(fields, passphrase)}`;
}

const anItn = (over: Partial<Record<string, string>> = {}): [string, string][] =>
  Object.entries({
    m_payment_id: 'pi_test',
    pf_payment_id: '1089250',
    payment_status: 'COMPLETE',
    item_name: 'bb.q Chicken order BBQ-260903-0001',
    amount_gross: '229.00',
    amount_fee: '-6.86',
    amount_net: '222.14',
    merchant_id: ENV.BBQ_PAYFAST_MERCHANT_ID,
    ...over,
  }) as [string, string][];

beforeEach(blankState);

describe('the encoding, which is where this goes wrong', () => {
  /**
   * PHP's urlencode, which PayFast builds its signature with. Every one of
   * these differs from encodeURIComponent, and every one of them turns up in a
   * real order — an apostrophe in a product name, a space in an address.
   */
  it('escapes the six characters encodeURIComponent leaves alone', () => {
    expect(payfastEncode("!'()*~")).toBe('%21%27%28%29%2A%7E');
  });

  it('writes a space as a plus, not as %20', () => {
    expect(payfastEncode('Half and Half')).toBe('Half+and+Half');
  });

  it('uses upper-case hex, because PayFast does', () => {
    expect(payfastEncode('a/b')).toBe('a%2Fb');
    expect(payfastEncode('é')).toBe('%C3%A9');
  });

  it('leaves the characters PHP leaves alone', () => {
    expect(payfastEncode('abcXYZ019-_.')).toBe('abcXYZ019-_.');
  });

  /** A real order name, with the things that actually break signatures in it. */
  it('handles a product name a customer could really order', () => {
    expect(payfastEncode("Nando's (large) ~ 1/2 chicken")).toBe(
      'Nando%27s+%28large%29+%7E+1%2F2+chicken',
    );
  });
});

describe('the signature', () => {
  it('is an MD5 of the parameter string', () => {
    const fields: [string, string][] = [
      ['merchant_id', '10000100'],
      ['amount', '229.00'],
    ];

    expect(sign(fields)).toBe(
      createHash('md5').update('merchant_id=10000100&amount=229.00').digest('hex'),
    );
  });

  it('appends the passphrase as a final parameter when there is one', () => {
    const fields: [string, string][] = [['amount', '229.00']];
    expect(parameterString(fields, 'shh')).toBe('amount=229.00&passphrase=shh');
  });

  /** Appending an empty one gives a signature no passphrase-less account matches. */
  it('appends nothing when there is not', () => {
    expect(parameterString([['amount', '229.00']])).toBe('amount=229.00');
    expect(parameterString([['amount', '229.00']], '')).toBe('amount=229.00');
  });

  /**
   * Order is the specification. PayFast signs fields in the order they were
   * sent, so anything that sorts them first produces a plausible signature that
   * never matches.
   */
  it('depends on the order of the fields', () => {
    const one: [string, string][] = [['a', '1'], ['b', '2']];
    const other: [string, string][] = [['b', '2'], ['a', '1']];

    expect(sign(one)).not.toBe(sign(other));
  });

  it('urlencodes the passphrase too', () => {
    expect(parameterString([['a', '1']], 'two words')).toBe('a=1&passphrase=two+words');
  });
});

describe('rands and cents', () => {
  it('reads what PayFast sends', () => {
    expect(randsToCents('229.00')).toBe(22_900);
    expect(randsToCents('0.01')).toBe(1);
    expect(randsToCents('1234')).toBe(123_400);
    expect(randsToCents('129.1')).toBe(12_910);
  });

  /**
   * Parsed as text rather than through parseFloat.
   *
   * Being straight about the strength of this: for well-formed two-decimal
   * amounts, `Math.round(parseFloat(x) * 100)` also gets the right answer —
   * 129.10 becomes 12909.999999999998 and rounds back to 12910. So this is
   * correctness by construction rather than a bug being fixed, and it is worth
   * it because the rounding is doing the work in that version and rounding is
   * exactly what stops being reliable when somebody later reaches for the same
   * helper with a different number of decimal places.
   *
   * The part that is a real difference is below: the float route accepts
   * three decimals and silently rounds them away.
   */
  it('is exact for every amount PayFast can send', () => {
    for (const [amount, cents] of [
      ['129.10', 12_910],
      ['8.07', 807],
      ['0.29', 29],
      ['1054.30', 105_430],
      ['99999.99', 9_999_999],
    ] as const) {
      expect(randsToCents(amount), amount).toBe(cents);
    }
  });

  it('refuses a third decimal instead of quietly rounding it away', () => {
    expect(randsToCents('1.005')).toBeNull();
    expect(Math.round(Number.parseFloat('1.005') * 100), 'which the float route would not').toBe(
      100,
    );
  });

  it('refuses something that is not an amount', () => {
    for (const bad of ['', 'free', '-12.00', '12.345', '1,234.00']) {
      expect(randsToCents(bad), bad).toBeNull();
    }
  });

  it('writes an amount the way PayFast wants it', () => {
    expect(centsToRands(22_900)).toBe('229.00');
    expect(centsToRands(1)).toBe('0.01');
  });
});

describe('checking a notification', () => {
  it('accepts one signed with the right passphrase', () => {
    expect(signatureMatches(notification(anItn()), PASSPHRASE)).toBe(true);
  });

  it('refuses one signed with the wrong passphrase', () => {
    expect(signatureMatches(notification(anItn(), 'not-the-passphrase'), PASSPHRASE)).toBe(false);
  });

  it('refuses one with no signature at all', () => {
    const unsigned = anItn()
      .map(([key, value]) => `${key}=${payfastEncode(value)}`)
      .join('&');
    expect(signatureMatches(unsigned, PASSPHRASE)).toBe(false);
  });

  /** The amount is the field an attacker would most like to change. */
  it('refuses one whose amount was edited after signing', () => {
    const honest = notification(anItn());
    const tampered = honest.replace('amount_gross=229.00', 'amount_gross=1.00');

    expect(signatureMatches(tampered, PASSPHRASE)).toBe(false);
  });

  it('reads the fields in the order they arrived', () => {
    expect(entriesOf('b=2&a=1').map(([key]) => key)).toEqual(['b', 'a']);
  });
});

describe('where the notification came from', () => {
  const resolves = (map: Record<string, string[]>): typeof fromPayfast extends never ? never : (host: string) => Promise<string[]> =>
    async (host) => map[host] ?? [];

  it('accepts an address PayFast resolves to', async () => {
    expect(
      await fromPayfast('197.97.145.144', resolves({ 'www.payfast.co.za': ['197.97.145.144'] })),
    ).toBe(true);
  });

  it('refuses one it does not', async () => {
    expect(
      await fromPayfast('203.0.113.7', resolves({ 'www.payfast.co.za': ['197.97.145.144'] })),
    ).toBe(false);
  });

  it('treats an IPv4-mapped address as the same address', async () => {
    expect(
      await fromPayfast(
        '::ffff:197.97.145.144',
        resolves({ 'w1w.payfast.co.za': ['197.97.145.144'] }),
      ),
    ).toBe(true);
  });

  /**
   * Fails closed. Every lookup failing means DNS is down or there is no
   * outbound access, and neither is a reason to start believing notifications
   * from anywhere.
   */
  it('refuses everything when no host resolves', async () => {
    expect(await fromPayfast('197.97.145.144', async () => [])).toBe(false);
    expect(
      await fromPayfast('197.97.145.144', async () => {
        throw new Error('no DNS');
      }),
    ).toBe(false);
  });

  it('refuses when there is no source address to check', async () => {
    expect(await fromPayfast(null, resolves({ 'www.payfast.co.za': ['1.2.3.4'] }))).toBe(false);
  });

  /**
   * The last hop, not the first. Earlier entries in x-forwarded-for are
   * whatever the caller sent, so taking the first would let a notification
   * name its own source address — which is the check being made.
   */
  it('takes the address the nearest proxy added', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 197.97.145.144' });
    expect(clientIpFrom(headers)).toBe('197.97.145.144');
  });

  it('falls back to x-real-ip', () => {
    expect(clientIpFrom(new Headers({ 'x-real-ip': '197.97.145.144' }))).toBe('197.97.145.144');
  });

  it('has nothing when neither header is there', () => {
    expect(clientIpFrom(new Headers())).toBeNull();
  });
});

describe('the postback', () => {
  /** A stub that records what it was called with, typed so the calls are readable. */
  const answering = (body: string, ok = true) =>
    vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(body, { status: ok ? 200 : 500 }),
    );

  it('believes a VALID answer', async () => {
    expect(
      await postbackValid('a=1', { sandbox: true, fetcher: answering('VALID') as unknown as typeof fetch }),
    ).toBe(true);
  });

  it('does not believe an INVALID one', async () => {
    expect(
      await postbackValid('a=1', {
        sandbox: true,
        fetcher: answering('INVALID') as unknown as typeof fetch,
      }),
    ).toBe(false);
  });

  it('sends the body back exactly as it arrived', async () => {
    const fetcher = answering('VALID');
    await postbackValid('b=2&a=1&signature=abc', {
      sandbox: true,
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(
      fetcher.mock.calls[0]?.[1]?.body,
      're-encoding it would be a mismatch at their end',
    ).toBe('b=2&a=1&signature=abc');
  });

  it('goes to the sandbox or the live host, as configured', async () => {
    const sandbox = answering('VALID');
    await postbackValid('a=1', { sandbox: true, fetcher: sandbox as unknown as typeof fetch });
    expect(String(sandbox.mock.calls[0]?.[0])).toContain('sandbox.payfast.co.za');

    const live = answering('VALID');
    await postbackValid('a=1', { sandbox: false, fetcher: live as unknown as typeof fetch });
    expect(String(live.mock.calls[0]?.[0])).toContain('www.payfast.co.za');
  });

  /**
   * Fails closed on everything. A timeout, a refused connection and a 500 are
   * none of them evidence that a payment happened, and this is the only check
   * that catches a replay of a genuine notification.
   */
  it('does not believe a network that did not answer', async () => {
    const throwing = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    expect(await postbackValid('a=1', { sandbox: true, fetcher: throwing })).toBe(false);
    expect(
      await postbackValid('a=1', {
        sandbox: true,
        fetcher: answering('VALID', false) as unknown as typeof fetch,
      }),
    ).toBe(false);
  });
});

describe('the adapter', () => {
  const provider = () =>
    payfastProvider({
      merchantId: ENV.BBQ_PAYFAST_MERCHANT_ID,
      merchantKey: ENV.BBQ_PAYFAST_MERCHANT_KEY,
      passphrase: PASSPHRASE,
      sandbox: true,
      returnUrl: 'https://order.example.co.za/journey',
      cancelUrl: 'https://order.example.co.za/checkout',
      notifyUrl: 'https://order.example.co.za/api/payments/webhook',
      resolver: async () => ['197.97.145.144'],
      fetcher: (async () => new Response('VALID')) as unknown as typeof fetch,
    });

  it('sends the customer to PayFast with a signed redirect', async () => {
    const result = await provider().createIntent({
      reference: 'pi_test',
      amountCents: 22_900,
      currency: 'ZAR',
      description: 'bb.q Chicken order BBQ-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const url = new URL(result.redirectUrl ?? '');
    expect(url.host).toBe('sandbox.payfast.co.za');
    expect(url.searchParams.get('amount')).toBe('229.00');
    expect(url.searchParams.get('m_payment_id')).toBe('pi_test');
    expect(url.searchParams.get('signature')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('never puts the passphrase in the redirect the customer can read', async () => {
    const result = await provider().createIntent({
      reference: 'pi_test',
      amountCents: 22_900,
      currency: 'ZAR',
      description: 'an order',
    });

    expect(result.ok && result.redirectUrl).not.toContain(PASSPHRASE);
  });

  it('parses a complete payment into a settlement', () => {
    const event = provider().parse(notification(anItn()));

    expect(event).toMatchObject({
      intentId: 'pi_test',
      status: 'captured',
      providerRef: '1089250',
      amountCents: 22_900,
    });
  });

  it('maps a failure and a cancellation onto failed', () => {
    for (const status of ['FAILED', 'CANCELLED']) {
      const event = provider().parse(notification(anItn({ payment_status: status })));
      expect(event?.status, status).toBe('failed');
      expect(event?.failureReason).toContain(status);
    }
  });

  it('maps pending onto pending', () => {
    expect(provider().parse(notification(anItn({ payment_status: 'PENDING' })))?.status).toBe(
      'pending',
    );
  });

  /** A status PayFast adds later is refused rather than guessed at. */
  it('refuses a status it has never heard of', () => {
    expect(provider().parse(notification(anItn({ payment_status: 'REVERSED' })))).toBeNull();
  });

  /**
   * The idempotency key, and the decision worth arguing about.
   *
   * PayFast reuses pf_payment_id across every notification for one payment. Key
   * on it alone and the PENDING settles while the COMPLETE that follows is
   * dropped as a replay — the customer pays and the order never moves.
   */
  it('keys on the payment and the outcome, so a later COMPLETE still applies', () => {
    const pending = provider().parse(notification(anItn({ payment_status: 'PENDING' })));
    const complete = provider().parse(notification(anItn()));

    expect(pending?.id).not.toBe(complete?.id);
    expect(complete?.id).toBe('1089250:captured');
  });

  it('still treats a redelivery of the same outcome as the same event', () => {
    const once = provider().parse(notification(anItn()));
    const again = provider().parse(notification(anItn()));

    expect(once?.id).toBe(again?.id);
  });

  it('refuses a notification missing the fields it needs', () => {
    for (const missing of ['m_payment_id', 'pf_payment_id', 'payment_status', 'amount_gross']) {
      const fields = anItn().filter(([key]) => key !== missing);
      expect(provider().parse(notification(fields)), missing).toBeNull();
    }
  });

  it('runs all four checks and accepts a good notification', async () => {
    const headers = new Headers({ 'x-forwarded-for': '197.97.145.144' });
    expect(await provider().verify(notification(anItn()), headers)).toBe(true);
  });

  it('refuses when any one of them fails', async () => {
    const good = new Headers({ 'x-forwarded-for': '197.97.145.144' });

    // Signature.
    expect(await provider().verify(notification(anItn(), 'wrong'), good)).toBe(false);
    // Source.
    expect(
      await provider().verify(
        notification(anItn()),
        new Headers({ 'x-forwarded-for': '203.0.113.7' }),
      ),
    ).toBe(false);
    // Postback.
    const refusing = payfastProvider({
      merchantId: 'x',
      merchantKey: 'y',
      passphrase: PASSPHRASE,
      sandbox: true,
      returnUrl: 'https://e/1',
      cancelUrl: 'https://e/2',
      notifyUrl: 'https://e/3',
      resolver: async () => ['197.97.145.144'],
      fetcher: (async () => new Response('INVALID')) as unknown as typeof fetch,
    });
    expect(await refusing.verify(notification(anItn()), good)).toBe(false);
  });
});

describe('choosing PayFast', () => {
  it('is not configured without every credential it needs', () => {
    for (const missing of [
      'BBQ_PAYFAST_MERCHANT_ID',
      'BBQ_PAYFAST_MERCHANT_KEY',
      'BBQ_PUBLIC_URL',
      'BBQ_PAYMENT_SECRET',
    ]) {
      const env = { ...ENV, [missing]: undefined };
      expect(activeProvider(env), `${missing} missing`).toBeNull();
    }
  });

  it('is configured with them all', () => {
    expect(activeProvider(ENV)?.name).toBe('payfast-sandbox');
  });

  /**
   * Live only when the variable says exactly "false". Every other value keeps
   * the sandbox, because getting this backwards takes real money on a
   * deployment somebody believed was a test.
   */
  it('stays in the sandbox unless told otherwise in exactly one way', () => {
    for (const value of [undefined, '', '0', 'no', 'FALSE', 'true']) {
      expect(activeProvider({ ...ENV, BBQ_PAYFAST_SANDBOX: value })?.name, String(value)).toBe(
        'payfast-sandbox',
      );
    }
    expect(activeProvider({ ...ENV, BBQ_PAYFAST_SANDBOX: 'false' })?.name).toBe('payfast');
  });

  it('points the notification at this deployment', async () => {
    const provider = activeProvider(ENV);
    const result = await provider?.createIntent({
      reference: 'pi_1',
      amountCents: 100,
      currency: 'ZAR',
      description: 'x',
    });

    expect(result?.ok && result.redirectUrl).toContain(
      encodeURIComponent('https://order.example.co.za/api/payments/webhook'),
    );
  });
});

describe('through the webhook route', () => {
  /**
   * The whole path, with only the two things that leave the machine replaced:
   * the DNS lookup and the postback. Both are stubbed at the module the adapter
   * really calls, so everything between the raw request body and the settled
   * order is the code that would run in production.
   *
   * An earlier version of this let the DNS lookup go out for real and accepted
   * either a 200 or a 401 depending on whether it resolved. That is a test that
   * passes whatever the code does.
   */
  async function throughTheRoute(body: string, postback: string) {
    const before = { ...process.env };
    Object.assign(process.env, ENV);

    const resolver = vi.spyOn(dns, 'resolve4').mockResolvedValue(['197.97.145.144']);
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(postback));

    try {
      return await webhookRoute(
        new Request('http://localhost/api/payments/webhook', {
          method: 'POST',
          headers: {
            'x-forwarded-for': '197.97.145.144',
            'content-type': 'application/x-www-form-urlencoded',
          },
          body,
        }),
      );
    } finally {
      resolver.mockRestore();
      fetcher.mockRestore();
      for (const key of Object.keys(ENV)) delete process.env[key];
      Object.assign(process.env, before);
    }
  }

  async function anOrderAwaitingPayment() {
    const order = await placeOrder();
    const opened = openIntent(order.id, 'payfast-sandbox');
    if (!opened.ok) throw new Error('could not open an intent');

    return {
      order,
      body: notification(
        anItn({
          m_payment_id: opened.intent.id,
          amount_gross: (order.totals.totalCents / 100).toFixed(2),
        }),
      ),
    };
  }

  it('settles the order the notification is about', async () => {
    const { order, body } = await anOrderAwaitingPayment();
    const response = await throughTheRoute(body, 'VALID');

    expect(response.status).toBe(200);
    expect(intentForOrder(order.id)?.status).toBe('captured');
  });

  /**
   * The reason `verify` was allowed to return a promise. A route that forgot to
   * await it would see a Promise, which is truthy, and settle every
   * notification PayFast disowned.
   */
  it('refuses one PayFast disowns on the postback', async () => {
    const { order, body } = await anOrderAwaitingPayment();
    const response = await throughTheRoute(body, 'INVALID');

    expect(response.status).toBe(401);
    expect(intentForOrder(order.id)?.status, 'still unpaid').toBe('pending');
  });

  /** The ledger's own amount check, reached through a real PayFast body. */
  it('refuses one for an amount that is not what was asked for', async () => {
    const order = await placeOrder();
    const opened = openIntent(order.id, 'payfast-sandbox');
    if (!opened.ok) throw new Error('could not open an intent');

    const body = notification(anItn({ m_payment_id: opened.intent.id, amount_gross: '1.00' }));
    const response = await throughTheRoute(body, 'VALID');

    expect(response.status).toBe(409);
    expect(intentForOrder(order.id)?.status).toBe('pending');
  });
});
