import { createServer } from '../server/src/app';
import type { EmailSender } from '../server/src/auth';
import { MemoryStore } from '../server/src/store';
import { SmtpEmailSender } from '../server/src/email';
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
