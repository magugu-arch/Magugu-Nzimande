import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as bounceWebhook } from '@/app/api/notifications/webhook/route';
import { routedTransport } from '@/lib/notifications/registry';
import { notifyPlaced, sentMessageIds } from '@/lib/notifications/send';
import {
  isSuppressed,
  listSuppressed,
  reasonForMailgunEvent,
  suppress,
  suppressionFor,
  unsuppress,
} from '@/lib/notifications/suppression';
import { readState } from '@/lib/demo-state';
import type { Message } from '@/lib/notifications/transport';
import { pushToPos } from '@/lib/fulfilment/handoff';
import {
  CONSOLE_PASSPHRASE,
  blankState,
  bodyOf,
  customer,
  operatorCookie,
  placeOrder,
  request,
} from './fixtures';

/**
 * Bounces, complaints, and the addresses we must stop emailing.
 *
 * Two obligations that look alike and are not. A hard bounce is
 * deliverability: sending to an address that does not exist ruins a domain's
 * reputation, and then the confirmations that would have arrived stop arriving
 * for everybody. A complaint is legal — somebody has withdrawn consent, and
 * POPIA means honouring it rather than noting it.
 *
 * A soft bounce is neither, and that is the distinction most of these tests are
 * about: a mailbox that was full this morning works this afternoon.
 */

const KEY = 'webhook-key';

function signed(eventData: Record<string, unknown>, over: Record<string, unknown> = {}) {
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const token = `tok-${Math.random().toString(36).slice(2)}`;

  return new Request('http://localhost/api/notifications/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      signature: {
        timestamp,
        token,
        signature: createHmac('sha256', KEY).update(`${timestamp}${token}`).digest('hex'),
        ...over,
      },
      'event-data': eventData,
    }),
  });
}

async function withKey<T>(run: () => Promise<T>): Promise<T> {
  const before = process.env.BBQ_MAILGUN_WEBHOOK_KEY;
  process.env.BBQ_MAILGUN_WEBHOOK_KEY = KEY;
  try {
    return await run();
  } finally {
    if (before === undefined) delete process.env.BBQ_MAILGUN_WEBHOOK_KEY;
    else process.env.BBQ_MAILGUN_WEBHOOK_KEY = before;
  }
}

beforeEach(blankState);

describe('what each Mailgun event means', () => {
  it('treats a permanent failure as a hard bounce', () => {
    expect(reasonForMailgunEvent('permanent_fail')).toBe('hard-bounce');
  });

  it('treats a complaint as a complaint, which is the legal one', () => {
    expect(reasonForMailgunEvent('complained')).toBe('complaint');
  });

  /**
   * The one most likely to be mishandled by somebody reading the event list
   * quickly. Suppressing on it cuts a customer off because their mailbox was
   * briefly full.
   */
  it('does nothing about a temporary failure', () => {
    expect(reasonForMailgunEvent('temporary_fail')).toBeNull();
  });

  it('does nothing about the events that are not failures', () => {
    for (const event of ['delivered', 'opened', 'clicked', 'accepted', 'stored']) {
      expect(reasonForMailgunEvent(event), event).toBeNull();
    }
  });
});

describe('the suppression list', () => {
  it('stops an address once it is on it', () => {
    expect(isSuppressed(customer.email)).toBe(false);
    suppress(customer.email, 'hard-bounce');
    expect(isSuppressed(customer.email)).toBe(true);
  });

  it('does not care how the address was capitalised', () => {
    suppress(customer.email.toUpperCase(), 'complaint');
    expect(isSuppressed(customer.email)).toBe(true);
  });

  it('keeps why, not just that', () => {
    suppress(customer.email, 'complaint');
    expect(suppressionFor(customer.email)?.reason).toBe('complaint');
  });

  /**
   * The first reason wins. An address that complained and later hard-bounced is
   * still a complaint: the legal obligation is the stronger of the two, and
   * overwriting it with a deliverability note loses why we stopped.
   */
  it('does not let a later bounce overwrite an earlier complaint', () => {
    suppress(customer.email, 'complaint');
    suppress(customer.email, 'hard-bounce');

    expect(suppressionFor(customer.email)?.reason).toBe('complaint');
    expect(listSuppressed()).toHaveLength(1);
  });

  it('lets a bounced address back, since a mailbox can be fixed', () => {
    suppress(customer.email, 'hard-bounce');
    expect(unsuppress(customer.email)).toBe(true);
    expect(isSuppressed(customer.email)).toBe(false);
  });

  /**
   * Consent is the customer's to give back. The only honest way is for them to
   * place another order, which is not a button in a console.
   */
  it('will not let a complaint be reversed from this side', () => {
    suppress(customer.email, 'complaint');
    expect(unsuppress(customer.email)).toBe(false);
    expect(isSuppressed(customer.email)).toBe(true);
  });
});

describe('sending to a suppressed address', () => {
  const logged: Message[] = [];
  const route = () => routedTransport((message) => logged.push(message), {});

  beforeEach(() => {
    logged.length = 0;
  });

  /**
   * Checked in the router rather than in the Mailgun transport, so it holds
   * whichever provider carries email — including the log. Writing the message
   * to an audit log instead of sending it is still not honouring a withdrawal
   * of consent.
   */
  it('does not send it, even down the log transport', async () => {
    suppress(customer.email, 'complaint');

    const result = await route().deliver({
      id: 'x',
      channel: 'email',
      to: customer.email,
      subject: 's',
      body: 'b',
    });

    expect(result.ok).toBe(false);
    expect(logged, 'nothing was written either').toHaveLength(0);
  });

  it('still sends to a different address', async () => {
    suppress('someone@else.example', 'complaint');

    const result = await route().deliver({
      id: 'x',
      channel: 'email',
      to: customer.email,
      subject: 's',
      body: 'b',
    });

    expect(result.ok).toBe(true);
  });

  /** A complaint about an email address says nothing about a mobile number. */
  it('does not stop the text message', async () => {
    suppress(customer.email, 'complaint');

    const result = await route().deliver({
      id: 'y',
      channel: 'sms',
      to: customer.mobile,
      subject: '',
      body: 'b',
    });

    expect(result.ok).toBe(true);
  });

  it('does not stop the order being placed', async () => {
    suppress(customer.email, 'hard-bounce');
    const order = await placeOrder();

    expect(order.orderNumber).toBeTruthy();
    // The text still went; the email did not.
    expect(sentMessageIds().filter((id) => id.startsWith(order.id))).toHaveLength(2);
    await notifyPlaced(order);
  });
});

describe('the bounce webhook', () => {
  it('refuses everything with no signing key configured', async () => {
    const response = await bounceWebhook(signed({ event: 'complained', recipient: 'a@b.com' }));
    expect(response.status).toBe(501);
  });

  it('suppresses on a complaint', async () => {
    await withKey(async () => {
      const response = await bounceWebhook(
        signed({ event: 'complained', recipient: customer.email }),
      );

      expect(response.status).toBe(200);
      expect(suppressionFor(customer.email)?.reason).toBe('complaint');
    });
  });

  it('suppresses on a permanent failure', async () => {
    await withKey(async () => {
      await bounceWebhook(
        signed({ event: 'failed', severity: 'permanent', recipient: customer.email }),
      );
      expect(suppressionFor(customer.email)?.reason).toBe('hard-bounce');
    });
  });

  /**
   * Mailgun reports both bounces as `failed` and distinguishes them by
   * severity. Reading the event alone suppresses a customer whose mailbox was
   * briefly full, which is the mistake this test exists for.
   */
  it('does not suppress on a temporary failure, however it is spelled', async () => {
    await withKey(async () => {
      await bounceWebhook(
        signed({ event: 'failed', severity: 'temporary', recipient: customer.email }),
      );
      expect(isSuppressed(customer.email)).toBe(false);

      await bounceWebhook(signed({ event: 'temporary_fail', recipient: customer.email }));
      expect(isSuppressed(customer.email)).toBe(false);
    });
  });

  it('does nothing on a delivery or an open', async () => {
    await withKey(async () => {
      for (const event of ['delivered', 'opened']) {
        await bounceWebhook(signed({ event, recipient: customer.email }));
      }
      expect(isSuppressed(customer.email)).toBe(false);
    });
  });

  it('refuses a forged signature and suppresses nobody', async () => {
    await withKey(async () => {
      const response = await bounceWebhook(
        signed({ event: 'complained', recipient: customer.email }, { signature: 'f'.repeat(64) }),
      );

      expect(response.status).toBe(401);
      expect(isSuppressed(customer.email)).toBe(false);
    });
  });

  it('refuses a body with no signature block', async () => {
    await withKey(async () => {
      const response = await bounceWebhook(
        new Request('http://localhost/api/notifications/webhook', {
          method: 'POST',
          body: JSON.stringify({ 'event-data': { event: 'complained', recipient: 'a@b.com' } }),
        }),
      );

      expect(response.status).toBe(401);
    });
  });

  /**
   * Single use, in the shared state rather than a module Set — the workers have
   * to agree, or the guard is per worker and a replay simply picks another one.
   */
  it('acts on a token once', async () => {
    await withKey(async () => {
      const request = signed({ event: 'failed', severity: 'permanent', recipient: customer.email });
      const body = await request.clone().text();
      const again = new Request(request.url, { method: 'POST', body });

      expect((await bounceWebhook(request)).status).toBe(200);
      expect(isSuppressed(customer.email)).toBe(true);

      unsuppress(customer.email);
      const replay = await bounceWebhook(again);

      expect(replay.status).toBe(200);
      expect((await replay.json()).replayed).toBe(true);
      expect(isSuppressed(customer.email), 'the replay did nothing').toBe(false);
    });
  });

  it('remembers the token in the shared state', async () => {
    await withKey(async () => {
      await bounceWebhook(signed({ event: 'delivered', recipient: customer.email }));
      expect(readState().notifications.webhookTokens).toHaveLength(1);
    });
  });

  it('answers 400 for a body that is not JSON', async () => {
    await withKey(async () => {
      const response = await bounceWebhook(
        new Request('http://localhost/api/notifications/webhook', {
          method: 'POST',
          body: 'not json',
        }),
      );
      expect(response.status).toBe(400);
    });
  });
});

describe('what the console can now see', () => {
  // The console fails closed with no passphrase configured, so these three
  // need one — the same way tests/admin-operations.test.ts does it.
  beforeAll(() => {
    process.env.BBQ_ADMIN_PASSWORD = CONSOLE_PASSPHRASE;
  });

  afterAll(() => {
    delete process.env.BBQ_ADMIN_PASSWORD;
  });

  /**
   * Both of these were recorded from the moment they were built and displayed
   * nowhere, which makes them a log rather than a report. The end-of-service
   * question is "which orders did the kitchen never get", and the answer must
   * not be "ask the customers".
   */
  it('reports the addresses it has stopped emailing', async () => {
    suppress(customer.email, 'complaint');

    const { GET } = await import('@/app/api/admin/orders/route');
    const response = await GET(request('/api/admin/orders', { cookie: await operatorCookie() }));
    const body = await bodyOf<{ suppressed: { address: string; reason: string }[] }>(response);

    expect(body.suppressed).toHaveLength(1);
    expect(body.suppressed[0]?.reason).toBe('complaint');
  });

  it('reports the orders a kitchen system refused', async () => {
    const order = await placeOrder();
    await pushToPos(order, {
      name: 'test-pos',
      pushOrder: async () => ({ ok: false, error: 'till offline', retryable: true }),
      fetchSoldOut: async () => null,
    });

    const { GET } = await import('@/app/api/admin/orders/route');
    const response = await GET(request('/api/admin/orders', { cookie: await operatorCookie() }));
    const body = await bodyOf<{ unacknowledged: { orderNumber: string }[] }>(response);

    expect(body.unacknowledged.map((entry) => entry.orderNumber)).toEqual([order.orderNumber]);
  });

  it('reports neither when nothing has gone wrong', async () => {
    const { GET } = await import('@/app/api/admin/orders/route');
    const response = await GET(request('/api/admin/orders', { cookie: await operatorCookie() }));
    const body = await bodyOf<{ unacknowledged: unknown[]; suppressed: unknown[] }>(response);

    expect(body.unacknowledged).toEqual([]);
    expect(body.suppressed).toEqual([]);
  });
});
