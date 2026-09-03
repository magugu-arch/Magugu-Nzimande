import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clickatellMsisdn, clickatellTransport } from '@/lib/notifications/clickatell';
import { mailgunTransport, verifyMailgunSignature } from '@/lib/notifications/mailgun';
import {
  emailTransport,
  mailgunRegion,
  mailgunWebhookKey,
  routedTransport,
  smsTransport,
} from '@/lib/notifications/registry';
import { e164 } from '@/lib/fulfilment/uber/address';
import type { Message } from '@/lib/notifications/transport';
import { blankState } from './fixtures';

/**
 * Mailgun for email, Clickatell for SMS.
 *
 * Two providers because email and SMS are different products with different
 * economics, and Clickatell terminates locally — an SMS to a South African
 * network costs what it should rather than what an international route costs.
 *
 * Built with no account for either. Everything is a transformation or a call
 * with its fetch injected; what credentials buy is the provider agreeing our
 * request is well formed.
 */

const ENV = {
  BBQ_MAILGUN_API_KEY: 'key-test',
  BBQ_MAILGUN_DOMAIN: 'mg.example.co.za',
  BBQ_MAILGUN_FROM: 'bb.q Chicken <orders@example.co.za>',
  BBQ_MAILGUN_WEBHOOK_KEY: 'webhook-key',
  BBQ_CLICKATELL_API_KEY: 'clickatell-key',
};

const anEmail: Message = {
  id: 'O-1:placed:email',
  channel: 'email',
  to: 'thandi@example.com',
  subject: 'Your bb.q Chicken order',
  body: 'Thank you.',
};

const aText: Message = {
  id: 'O-1:placed:sms',
  channel: 'sms',
  to: '0821234567',
  subject: '',
  body: 'bb.q Chicken: order received.',
};

/** A fetch that records its calls and answers what it is told to. */
function stub(reply: Response | (() => Response | Promise<Response>)) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return typeof reply === 'function' ? reply() : reply;
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

const accepted = () => new Response(JSON.stringify({ id: '<20260903@mg>' }));
const clickatellOk = () =>
  new Response(JSON.stringify({ messages: [{ apiMessageId: 'cm_1', accepted: true }] }));

beforeEach(blankState);

describe('Mailgun', () => {
  const transport = (fetcher: typeof fetch) =>
    mailgunTransport({
      apiKey: 'key-test',
      domain: 'mg.example.co.za',
      from: 'orders@example.co.za',
      region: 'eu',
      fetcher,
    });

  it('sends the message and keeps their id', async () => {
    const { fetcher } = stub(accepted());
    expect(await transport(fetcher).deliver(anEmail)).toEqual({ ok: true, id: '<20260903@mg>' });
  });

  /**
   * The username is the literal string `api`, which looks like a placeholder
   * and is what Mailgun specifies.
   */
  it('authenticates as api, with the key as the password', async () => {
    const { fetcher, calls } = stub(accepted());
    await transport(fetcher).deliver(anEmail);

    const header = new Headers(calls[0]?.init.headers).get('authorization') ?? '';
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString();
    expect(decoded).toBe('api:key-test');
  });

  it('posts form fields rather than JSON, which is what they take', async () => {
    const { fetcher, calls } = stub(accepted());
    await transport(fetcher).deliver(anEmail);

    expect(new Headers(calls[0]?.init.headers).get('content-type')).toBe(
      'application/x-www-form-urlencoded',
    );
    const body = new URLSearchParams(String(calls[0]?.init.body));
    expect(body.get('to')).toBe(anEmail.to);
    expect(body.get('subject')).toBe(anEmail.subject);
    expect(body.get('text')).toBe(anEmail.body);
  });

  /** Wrong region is a 401 that reads exactly like a wrong key. */
  it('goes to the region it was configured for', async () => {
    const eu = stub(accepted());
    await transport(eu.fetcher).deliver(anEmail);
    expect(eu.calls[0]?.url).toContain('api.eu.mailgun.net');

    const us = stub(accepted());
    await mailgunTransport({
      apiKey: 'k',
      domain: 'd',
      from: 'f',
      region: 'us',
      fetcher: us.fetcher,
    }).deliver(anEmail);
    expect(us.calls[0]?.url).toContain('api.mailgun.net');
  });

  it('reports a refusal rather than throwing', async () => {
    const { fetcher } = stub(new Response('Forbidden', { status: 401 }));
    const result = await transport(fetcher).deliver(anEmail);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('401');
  });

  it('reports an unreachable Mailgun rather than throwing', async () => {
    const broken = (async () => {
      throw new Error('ENOTFOUND');
    }) as unknown as typeof fetch;

    expect((await transport(broken).deliver(anEmail)).ok).toBe(false);
  });

  /** Queued with no id is still queued; failing would send it twice. */
  it('treats an acceptance with no id as an acceptance', async () => {
    const { fetcher } = stub(new Response(JSON.stringify({ message: 'Queued' })));
    expect((await transport(fetcher).deliver(anEmail)).ok).toBe(true);
  });
});

describe('the Mailgun webhook signature', () => {
  const sign = (timestamp: string, token: string, key = 'webhook-key') =>
    createHmac('sha256', key).update(`${timestamp}${token}`).digest('hex');

  const fresh = () => String(Math.floor(Date.now() / 1_000));

  it('accepts one Mailgun signed', () => {
    const timestamp = fresh();
    expect(
      verifyMailgunSignature(
        { timestamp, token: 'tok', signature: sign(timestamp, 'tok') },
        'webhook-key',
      ),
    ).toBe(true);
  });

  it('refuses one signed with the wrong key', () => {
    const timestamp = fresh();
    expect(
      verifyMailgunSignature(
        { timestamp, token: 'tok', signature: sign(timestamp, 'tok', 'wrong') },
        'webhook-key',
      ),
    ).toBe(false);
  });

  /**
   * The reason the extra checks exist. Mailgun signs the timestamp and token,
   * *not* the payload — unlike every other webhook here — so the signature
   * proves the request came from Mailgun and says nothing about the body. A
   * captured triple would otherwise be replayable for ever with any body.
   */
  it('refuses one that is too old to be honest', () => {
    const stale = String(Math.floor(Date.now() / 1_000) - 3_600);
    expect(
      verifyMailgunSignature(
        { timestamp: stale, token: 'tok', signature: sign(stale, 'tok') },
        'webhook-key',
      ),
    ).toBe(false);
  });

  it('refuses a token it has already seen, inside the window', () => {
    const timestamp = fresh();
    const triple = { timestamp, token: 'tok', signature: sign(timestamp, 'tok') };
    const seen = new Set<string>();

    expect(verifyMailgunSignature(triple, 'webhook-key', { seen })).toBe(true);
    expect(verifyMailgunSignature(triple, 'webhook-key', { seen }), 'replayed').toBe(false);
  });

  it('refuses a timestamp that is not a number', () => {
    expect(
      verifyMailgunSignature(
        { timestamp: 'soon', token: 'tok', signature: sign('soon', 'tok') },
        'webhook-key',
      ),
    ).toBe(false);
  });
});

describe('Clickatell', () => {
  const transport = (fetcher: typeof fetch, from?: string) =>
    clickatellTransport({ apiKey: 'clickatell-key', from, fetcher });

  it('sends the message and keeps their id', async () => {
    const { fetcher } = stub(clickatellOk());
    expect(await transport(fetcher).deliver(aText)).toEqual({ ok: true, id: 'cm_1' });
  });

  /** Not `Bearer <key>`. Adding the scheme is a 401 that reads like a bad key. */
  it('sends the bare key as the authorization header', async () => {
    const { fetcher, calls } = stub(clickatellOk());
    await transport(fetcher).deliver(aText);

    expect(new Headers(calls[0]?.init.headers).get('authorization')).toBe('clickatell-key');
  });

  it('sends the number international and without a plus', async () => {
    const { fetcher, calls } = stub(clickatellOk());
    await transport(fetcher).deliver(aText);

    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.messages[0].to).toBe('27821234567');
    expect(body.messages[0].channel).toBe('sms');
  });

  /**
   * The one that would be silent. Clickatell answers 200 with
   * `accepted: false` on the individual message — an unroutable number, an
   * account out of credit. Reading only the status code is how a store finds
   * out at month end that nothing has gone out since the balance ran dry.
   */
  it('does not mistake a 200 for an acceptance', async () => {
    const { fetcher } = stub(
      new Response(
        JSON.stringify({ messages: [{ accepted: false, error: 'Insufficient credits' }] }),
      ),
    );

    const result = await transport(fetcher).deliver(aText);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('Insufficient credits');
  });

  it('refuses a 200 with no message in it at all', async () => {
    const { fetcher } = stub(new Response(JSON.stringify({ messages: [] })));
    expect((await transport(fetcher).deliver(aText)).ok).toBe(false);
  });

  it('refuses a number it cannot send to, before spending a request', async () => {
    const { fetcher, calls } = stub(clickatellOk());
    const result = await transport(fetcher).deliver({ ...aText, to: '+15550100' });

    expect(result.ok).toBe(false);
    expect(calls, 'nothing was sent').toHaveLength(0);
  });

  it('includes a sender id when the account has one', async () => {
    const { fetcher, calls } = stub(clickatellOk());
    await transport(fetcher, 'bbqChicken').deliver(aText);

    expect(JSON.parse(String(calls[0]?.init.body)).messages[0].from).toBe('bbqChicken');
  });

  it('reports an unreachable Clickatell rather than throwing', async () => {
    const broken = (async () => {
      throw new Error('ETIMEDOUT');
    }) as unknown as typeof fetch;

    expect((await transport(broken).deliver(aText)).ok).toBe(false);
  });
});

describe('the two number formats', () => {
  it('converts a South African mobile for Clickatell', () => {
    expect(clickatellMsisdn('0821234567')).toBe('27821234567');
    expect(clickatellMsisdn('082 123 4567')).toBe('27821234567');
    expect(clickatellMsisdn('+27821234567')).toBe('27821234567');
  });

  /**
   * Deliberately different from the courier's. Uber wants the plus and
   * Clickatell does not, so sharing one helper would leave one of them quietly
   * wrong — and a message accepted and never delivered looks like nothing from
   * here.
   */
  it('differs from the one the courier needs, which is the point', () => {
    expect(e164('0821234567')).toBe('+27821234567');
    expect(clickatellMsisdn('0821234567')).toBe('27821234567');
    expect(e164('0821234567')).not.toBe(clickatellMsisdn('0821234567'));
  });

  it('refuses what is not a South African mobile', () => {
    for (const bad of ['', '12345', '+15550100', '0121234567']) {
      expect(clickatellMsisdn(bad), bad).toBeNull();
    }
  });
});

describe('choosing the providers', () => {
  it('needs the whole set for Mailgun', () => {
    for (const missing of ['BBQ_MAILGUN_API_KEY', 'BBQ_MAILGUN_DOMAIN', 'BBQ_MAILGUN_FROM']) {
      expect(emailTransport({ ...ENV, [missing]: undefined }), missing).toBeNull();
    }
    expect(emailTransport(ENV)?.name).toBe('mailgun');
  });

  it('needs only a key for Clickatell', () => {
    expect(smsTransport({ ...ENV, BBQ_CLICKATELL_API_KEY: undefined })).toBeNull();
    expect(smsTransport(ENV)?.name).toBe('clickatell');
  });

  it('keeps the Mailgun webhook key separate from the sending key', () => {
    expect(mailgunWebhookKey(ENV)).toBe('webhook-key');
    expect(mailgunWebhookKey({ ...ENV, BBQ_MAILGUN_WEBHOOK_KEY: undefined })).toBeNull();
  });
});

describe('routing by channel', () => {
  const logged: Message[] = [];
  const route = (env: Record<string, string | undefined>) =>
    routedTransport((message) => logged.push(message), env);

  beforeEach(() => {
    logged.length = 0;
  });

  it('names which provider carries which channel', () => {
    expect(route(ENV).name).toBe('email:mailgun sms:clickatell');
    expect(route({}).name).toBe('email:log sms:log');
  });

  /**
   * Independently. A store with email configured and SMS not should still get
   * the email — this is the fulfilment rule rather than the payment one, where
   * an absent provider refuses.
   */
  it('falls back per channel rather than all or nothing', () => {
    expect(route({ ...ENV, BBQ_CLICKATELL_API_KEY: undefined }).name).toBe(
      'email:mailgun sms:log',
    );
    expect(route({ ...ENV, BBQ_MAILGUN_API_KEY: undefined }).name).toBe('email:log sms:clickatell');
  });

  it('logs a message on a channel with no provider rather than dropping it', async () => {
    const result = await route({}).deliver(anEmail);

    expect(result.ok).toBe(true);
    expect(logged).toHaveLength(1);
  });

  /**
   * EU rather than Mailgun's own US default. A South African business storing
   * customer data answers to POPIA, and the EU region is the one with a regime
   * a lawyer can point at.
   *
   * Tested against the registry's own decision. An earlier version rebuilt the
   * transport by hand with the same expression the registry uses, which passes
   * whatever the registry actually does — mutation testing found it by
   * inverting the default and breaking nothing.
   */
  it('defaults Mailgun to the EU region', () => {
    expect(mailgunRegion({})).toBe('eu');
    expect(mailgunRegion(ENV)).toBe('eu');
    expect(mailgunRegion({ ...ENV, BBQ_MAILGUN_REGION: 'us' })).toBe('us');
    // Anything that is not exactly "us" stays on the safer one.
    expect(mailgunRegion({ ...ENV, BBQ_MAILGUN_REGION: 'US' })).toBe('eu');
  });
});
