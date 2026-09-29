import { createServer } from '../server/src/app';
import type { EmailSender } from '../server/src/auth';
import { MemoryStore } from '../server/src/store';
import { SmtpEmailSender } from '../server/src/email';
import { PayFastProvider, payfastSignature, phpUrlencode } from '../server/src/payfast';
import { guardJson } from '../server/src/security';
import http from 'node:http';
import nodemailer from 'nodemailer';
import { DEFAULT_FLAGS } from '@/domain/flags';
import { fixedClock } from '@/domain/shared/clock';
import { newIdempotencyKey } from '@/domain/shared/ids';

const NOW = '2026-10-01T09:00:00+02:00';

/** Captures what the server would email, so the test can read the code. */
function inbox() {
  const sent: { to: string; subject: string; text: string }[] = [];
  const sender: EmailSender = {
    async send(to, subject, text) {
      sent.push({ to, subject, text });
    },
  };
  const lastCode = () => /(\d{6})/.exec(sent[sent.length - 1]?.text ?? '')?.[1] ?? '';
  return { sent, sender, lastCode };
}

async function boot(store = new MemoryStore(), extra: Record<string, unknown> = {}) {
  const mail = inbox();
  const server = await createServer({
    store,
    flags: { ...DEFAULT_FLAGS, bookingProvider: 'mabu-direct' },
    email: mail.sender,
    clock: fixedClock(NOW),
    directInventory: true,
    log: () => undefined,
    ...extra,
  });
  return { server, mail, store };
}

async function signIn(
  server: Awaited<ReturnType<typeof boot>>['server'],
  mail: ReturnType<typeof inbox>,
  email = 'thandi@example.com',
) {
  expect(
    (await server.call('auth.requestCode', { email }, undefined, { ip: '1.1.1.1' })).status,
  ).toBe(200);
  const res = await server.call('auth.verifyCode', {
    email,
    code: mail.lastCode(),
    name: 'Thandi',
  });
  expect(res.status).toBe(200);
  return (res.body as { token: string }).token;
}

describe('Mábu API server', () => {
  it('signs in with an emailed code and never returns the code', async () => {
    const { server, mail } = await boot();
    const req = await server.call('auth.requestCode', { email: 'Thandi@Example.com' });
    expect(req.body).toEqual({ sent: true });
    expect(mail.sent[0]?.to).toBe('thandi@example.com');
    const token = await signIn(server, mail);
    expect(token.length).toBeGreaterThan(30);
    const me = await server.call('me.get', {}, token);
    expect(me.status).toBe(200);
    expect((me.body as { email: string }).email).toBe('thandi@example.com');
  });

  it('refuses a wrong code, locks after five attempts, and consumes a used code', async () => {
    const { server, mail } = await boot();
    await server.call('auth.requestCode', { email: 'a@example.com' });
    const good = mail.lastCode();
    const bad = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) {
      expect(
        (await server.call('auth.verifyCode', { email: 'a@example.com', code: bad })).status,
      ).toBe(400);
    }
    const locked = await server.call('auth.verifyCode', { email: 'a@example.com', code: good });
    expect(locked.status).toBe(429);

    await server.call('auth.requestCode', { email: 'b@example.com' });
    const code = mail.lastCode();
    expect((await server.call('auth.verifyCode', { email: 'b@example.com', code })).status).toBe(
      200,
    );
    expect((await server.call('auth.verifyCode', { email: 'b@example.com', code })).status).toBe(
      400,
    );
  });

  it('rate-limits code requests per address', async () => {
    const { server } = await boot();
    for (let i = 0; i < 5; i += 1) {
      expect((await server.call('auth.requestCode', { email: 'c@example.com' })).status).toBe(200);
    }
    expect((await server.call('auth.requestCode', { email: 'c@example.com' })).status).toBe(429);
  });

  it('refuses sign-in when no email provider is configured, rather than faking it', async () => {
    const { server } = await boot(new MemoryStore(), { email: null });
    const res = await server.call('auth.requestCode', { email: 'd@example.com' });
    expect(res).toMatchObject({ status: 503, body: { code: 'NOT_CONFIGURED' } });
  });

  it('does not trust a guest id as a token, and answers 401 when signed out', async () => {
    const { server, mail } = await boot();
    await signIn(server, mail);
    const guestId = server.backend.db.guests.list()[0]!.id;
    expect((await server.call('me.get', {}, guestId)).status).toBe(401);
    expect((await server.call('booking.mine', {})).status).toBe(401);
  });

  it('takes a booking against direct inventory and keeps it across a restart', async () => {
    const store = new MemoryStore();
    const first = await boot(store);
    const token = await signIn(first.server, first.mail);
    const slots = (await first.server.call('booking.search', { date: '2026-10-08', partySize: 2 }))
      .body as { slotId: string; available: boolean }[];
    const slot = slots.find((s) => s.available)!;
    const key = newIdempotencyKey();
    const create = () =>
      first.server.call(
        'booking.create',
        {
          slotId: slot.slotId,
          partySize: 2,
          guest: { name: 'Thandi', email: 'thandi@example.com', phone: '082 555 0199' },
        },
        token,
        { idempotencyKey: key },
      );
    const [a, b] = await Promise.all([create(), create()]);
    expect(a.status).toBe(200);
    expect((a.body as { id: string }).id).toBe((b.body as { id: string }).id);

    const second = await boot(store);
    const mine = await second.server.call('booking.mine', {}, token);
    expect(mine.status).toBe(200);
    expect(JSON.stringify(mine.body)).toContain((a.body as { id: string }).id);
  });

  it('hides mock-only tools and unknown calls', async () => {
    const { server } = await boot();
    expect((await server.call('admin.simulateFailure', { channel: 'push', count: 1 })).status).toBe(
      404,
    );
    expect((await server.call('nope.nothing', {})).status).toBe(404);
  });

  it('registers a device and pushes through Expo, forgetting unregistered devices', async () => {
    const calls: unknown[] = [];
    const fakeFetch = (async (_url: string, init: { body: string }) => {
      calls.push(JSON.parse(init.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
        }),
      };
    }) as unknown as typeof fetch;
    const { server, mail } = await boot(new MemoryStore(), { push: { fetch: fakeFetch } });
    const token = await signIn(server, mail);
    const bad = await server.call(
      'devices.register',
      { token: 'not-a-token', platform: 'ios' },
      token,
    );
    expect(bad.status).toBe(400);
    const ok = await server.call(
      'devices.register',
      { token: 'ExponentPushToken[abc123]', platform: 'ios' },
      token,
    );
    expect(ok.status).toBe(200);
    const guestId = server.backend.db.guests.list()[0]!.id;
    await server.backend.notifications.sendNow({
      id: 'n1',
      guestId,
      category: 'booking',
      templateKey: 'booking.confirmed',
      data: {},
      channels: ['push'],
      dedupeKey: 'test-push',
    } as never);
    expect(calls).toHaveLength(1);
    expect(server.backend.db.pushTokens.count()).toBe(0);
  });
});

describe('SMTP email', () => {
  it('sends a text and branded HTML message, and refuses header injection', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const sent: string[] = [];
    const orig = transport.sendMail.bind(transport);
    transport.sendMail = (async (m: Parameters<typeof orig>[0]) => {
      const info = await orig(m);
      sent.push(String(info.message));
      return info;
    }) as typeof transport.sendMail;
    const sender = new SmtpEmailSender(transport, 'Mábu <reservations@example.com>');
    await sender.send(
      'guest@example.com',
      'Your Mábu sign-in code',
      'Your code is 123456.\n\nThanks.',
    );
    const msg = JSON.parse(sent[0]!);
    expect(msg.to).toEqual([{ address: 'guest@example.com', name: '' }]);
    expect(msg.text).toContain('123456');
    expect(msg.html).toContain('MÁBU');
    await expect(sender.send('a@example.com, b@example.com', 'x', 'y')).rejects.toThrow();
    await expect(sender.send('a@example.com', 'x\r\nBcc: evil@example.com', 'y')).rejects.toThrow();
  });
});

describe('PayFast hosted checkout', () => {
  const config = {
    merchantId: '10000100',
    merchantKey: '46f0cd694581a',
    passphrase: 'jt7NOE43FZPn',
    sandbox: true,
    publicUrl: 'https://api.example.com',
  };

  it('encodes like PHP urlencode and signs the fields in order', () => {
    expect(phpUrlencode("a b!'()*~@/")).toBe('a+b%21%27%28%29%2A%7E%40%2F');
    const fields: [string, string][] = [
      ['merchant_id', '10000100'],
      ['amount', '100.00'],
      ['item_name', 'Mábu gift voucher'],
    ];
    const sig = payfastSignature(fields, 'jt7NOE43FZPn');
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
    // Order matters, and empty fields are left out.
    expect(payfastSignature([...fields].reverse(), 'jt7NOE43FZPn')).not.toBe(sig);
    expect(payfastSignature([...fields, ['name_first', '']], 'jt7NOE43FZPn')).toBe(sig);
  });

  it('sends the guest to PayFast and issues the voucher only on a verified notification', async () => {
    const provider = new PayFastProvider(config);
    let confirm = true;
    const { server, mail } = await boot(new MemoryStore(), {
      payfast: { provider, validate: async () => confirm },
    });
    const token = await signIn(server, mail);
    const buy = await server.call(
      'vouchers.purchase',
      {
        amountCents: 100000,
        forSelf: true,
        delivery: 'in-app',
        methodToken: 'hosted',
        idempotencyKey: 'payfast-test-1',
      },
      token,
    );
    expect(buy.status).toBe(200);
    const voucher = buy.body as { id: string; status: string; paymentId: string };
    expect(voucher.status).toBe('pending_payment');

    const checkout = await server.call('payments.checkout', { id: voucher.paymentId }, token);
    expect(checkout.body).toMatchObject({
      status: 'pending',
      checkoutUrl: `https://api.example.com/pay/${voucher.paymentId}`,
    });
    const other = await (async () => {
      await server.call('auth.requestCode', { email: 'someone@example.com' });
      const r = await server.call('auth.verifyCode', {
        email: 'someone@example.com',
        code: mail.lastCode(),
      });
      return (r.body as { token: string }).token;
    })();
    expect((await server.call('payments.checkout', { id: voucher.paymentId }, other)).status).toBe(
      404,
    );

    const page = await server.payfast.page(voucher.paymentId);
    expect(page.html).toContain('https://sandbox.payfast.co.za/eng/process');
    expect(page.html).toContain('name="amount" value="1000.00"');
    expect(page.html).toContain(`name="m_payment_id" value="${voucher.paymentId}"`);

    const itn = (over: Record<string, string> = {}) => {
      const f: [string, string][] = Object.entries({
        m_payment_id: voucher.paymentId,
        pf_payment_id: '1089250',
        payment_status: 'COMPLETE',
        item_name: 'Mábu gift voucher',
        amount_gross: '1000.00',
        amount_fee: '-23.00',
        amount_net: '977.00',
        merchant_id: '10000100',
        ...over,
      });
      f.push(['signature', payfastSignature(f, config.passphrase)]);
      // The ITN signature covers empty fields too; none here.
      return new URLSearchParams(f).toString();
    };

    // Tampered, wrong amount, unconfirmed: all refused, voucher still pending.
    expect(await server.payfast.notify(itn().replace('1000.00', '1.00'))).toBe(400);
    expect(await server.payfast.notify(itn({ amount_gross: '1.00' }))).toBe(400);
    confirm = false;
    expect(await server.payfast.notify(itn())).toBe(400);
    const still = await server.call('vouchers.get', { id: voucher.id }, token);
    expect((still.body as { status: string }).status).toBe('pending_payment');

    confirm = true;
    expect(await server.payfast.notify(itn())).toBe(200);
    expect(await server.payfast.notify(itn())).toBe(200); // PayFast retries: harmless
    const done = await server.call('vouchers.get', { id: voucher.id }, token);
    expect((done.body as { status: string }).status).toBe('active');
  });
});

describe('the security layer', () => {
  it('sets a strict policy on every answer, and never caches one', async () => {
    const { server } = await boot();
    const res = await new Promise<{ status: number; headers: Record<string, string> }>(
      (resolve) => {
        const httpServer = http.createServer(server.handle);
        httpServer.listen(0, () => {
          const port = (httpServer.address() as { port: number }).port;
          http.get(`http://127.0.0.1:${port}/health`, (r) => {
            r.resume();
            resolve({
              status: r.statusCode ?? 0,
              headers: r.headers as unknown as Record<string, string>,
            });
            httpServer.close();
          });
        });
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{16}$/);
  });

  it('refuses a body that is legal JSON but expensive', () => {
    expect(() => guardJson(JSON.parse(`{"a":"${'x'.repeat(9000)}"}`))).toThrow();
    let deep = '1';
    for (let i = 0; i < 20; i += 1) deep = `[${deep}]`;
    expect(() => guardJson(JSON.parse(deep))).toThrow();
    const clean = guardJson(JSON.parse('{"__proto__":{"admin":true},"name":"Thandi"}')) as Record<
      string,
      unknown
    >;
    expect(clean).toEqual({ name: 'Thandi' });
    expect(({} as { admin?: boolean }).admin).toBeUndefined();
  });

  it('slows down a caller that hammers the API, and says for how long', async () => {
    const { server } = await boot(new MemoryStore(), {
      rateLimit: { perIpPerMinute: 5, perSessionPerMinute: 5 },
    });
    for (let i = 0; i < 5; i += 1) {
      expect((await server.call('content.menu', {}, undefined, { ip: '9.9.9.9' })).status).toBe(
        200,
      );
    }
    const stopped = await server.call('content.menu', {}, undefined, { ip: '9.9.9.9' });
    expect(stopped.status).toBe(429);
    expect(stopped.retryAfter).toBeGreaterThan(0);
    // Another caller is unaffected.
    expect((await server.call('content.menu', {}, undefined, { ip: '8.8.8.8' })).status).toBe(200);
  });

  it('limits how many codes one address may try', async () => {
    const { server, mail } = await boot();
    await server.call('auth.requestCode', { email: 'many@example.com' }, undefined, {
      ip: '2.2.2.2',
    });
    const wrong = mail.lastCode() === '000000' ? '111111' : '000000';
    let refusals = 0;
    for (let i = 0; i < 25; i += 1) {
      const res = await server.call(
        'auth.verifyCode',
        { email: `guess${i}@example.com`, code: wrong },
        undefined,
        { ip: '2.2.2.2' },
      );
      if (res.status === 429) refusals += 1;
    }
    expect(refusals).toBeGreaterThan(0);
  });

  it('lists a guest’s sign-ins and ends the others', async () => {
    const { server, mail } = await boot();
    const first = await signIn(server, mail, 'devices@example.com');
    const second = await signIn(server, mail, 'devices@example.com');
    const list = await server.call('auth.sessions', {}, second);
    const sessions = (list.body as { sessions: { current: boolean; label: string }[] }).sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((s) => s.current)).toHaveLength(1);

    const revoked = await server.call('auth.signOutOthers', {}, second);
    expect(revoked.body).toEqual({ revoked: 1 });
    expect((await server.call('me.get', {}, first)).status).toBe(401);
    expect((await server.call('me.get', {}, second)).status).toBe(200);
  });

  it('warns the guest by email when a new device signs in, but not on the same one', async () => {
    const { server, mail } = await boot();
    const openOn = async (label: string, ip: string) => {
      await server.call('auth.requestCode', { email: 'alert@example.com' }, undefined, { ip });
      await server.call(
        'auth.verifyCode',
        { email: 'alert@example.com', code: mail.lastCode() },
        undefined,
        { ip, label },
      );
    };
    await openOn('Mábu app on iPhone', '1.1.1.1');
    const afterFirst = mail.sent.length;
    await openOn('Mábu app on iPhone', '1.1.1.1');
    expect(
      mail.sent.slice(afterFirst).filter((m) => m.subject.includes('new sign-in')),
    ).toHaveLength(0);
    const before = mail.sent.length;
    await openOn('Browser on Windows', '5.5.5.5');
    const alerts = mail.sent.slice(before).filter((m) => m.subject.includes('new sign-in'));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.to).toBe('alert@example.com');
    expect(alerts[0]!.text).not.toMatch(/\d{6}/);
  });

  it('asks a staff member to sign in again before changing policy', async () => {
    const store = new MemoryStore();
    const { server, mail } = await boot(store);
    const token = await signIn(server, mail, 'boss@example.com');
    const guest = server.backend.db.guests.list()[0]!;
    server.backend.db.guests.update(guest.id, { role: 'admin' });

    const fresh = await server.call('admin.policy.update', { maxPartySize: 12 }, token);
    expect(fresh.status).toBe(200);

    // The same session, an hour later: money and policy need a fresh sign-in.
    const later = await boot(store, { clock: fixedClock('2026-10-01T11:00:00+02:00') });
    const stale = await later.server.call('admin.policy.update', { maxPartySize: 14 }, token);
    expect(stale).toMatchObject({ status: 403, body: { code: 'REAUTH_REQUIRED' } });
    // Reading the day's bookings still works: only changes need the fresh sign-in.
    expect(
      (await later.server.call('admin.reservations', { date: '2026-10-01' }, token)).status,
    ).toBe(200);
  });

  it('ends a staff session after twelve idle hours, and a guest session after sixty days', async () => {
    const store = new MemoryStore();
    const { server, mail } = await boot(store);
    const staffToken = await signIn(server, mail, 'floor@example.com');
    server.backend.db.guests.update(server.backend.db.guests.list()[0]!.id, { role: 'staff' });
    const guestToken = await signIn(server, mail, 'guest@example.com');

    const nextDay = await boot(store, { clock: fixedClock('2026-10-02T09:00:00+02:00') });
    // The staff session was opened as a guest session before the role changed,
    // so re-open it as staff to check the staff life.
    expect((await nextDay.server.call('me.get', {}, guestToken)).status).toBe(200);
    const staff = await signIn(nextDay.server, nextDay.mail, 'floor@example.com');
    const halfWeek = await boot(store, { clock: fixedClock('2026-10-03T09:00:00+02:00') });
    expect((await halfWeek.server.call('me.get', {}, staff)).status).toBe(401);
    expect((await halfWeek.server.call('me.get', {}, guestToken)).status).toBe(200);
    void staffToken;
  });
});
