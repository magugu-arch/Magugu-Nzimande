import fs from 'fs';
import path from 'path';
import { Database } from '@/domain/db';
import { createHandlers, MOCK_OTP } from '@/domain/rpc';
import type { Actor } from '@/domain/guests/types';
import { addGuest, ADMIN, makeBackend, STAFF } from './support/backend';

describe('schema parity', () => {
  it('has a PostgreSQL table for every table the services use, and no strays', () => {
    const dir = path.join(__dirname, '../server/migrations');
    const sql = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
      .join('\n');
    // server_* tables belong to the API server's runtime, not the services.
    const created = [...sql.matchAll(/CREATE TABLE (\w+)/g)]
      .map((m) => m[1])
      .filter((t) => !t!.startsWith('server_'))
      .sort();
    const used = new Database()
      .tables()
      .map((t) => t.name)
      .sort();
    expect(created).toEqual(used);
  });
});

describe('RPC surface', () => {
  const setup = () => {
    const b = makeBackend();
    const h = createHandlers(b);
    return { b, h };
  };

  it('serves public content signed out, and nothing personal', async () => {
    const { h } = setup();
    const home = await h['content.home']();
    expect(home.home.heroTitle).toMatch(/Refined by Fire/);
    await expect(h['me.get'](null)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(h['booking.mine'](null)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('never gives a guest the staff tools', async () => {
    const { b, h } = setup();
    const guest = addGuest(b);
    for (const call of [
      () => h['admin.dashboard'](guest, { date: '2026-10-01' }),
      () => h['admin.reservations'](guest, { date: '2026-10-01' }),
      () => h['admin.rewards'](guest),
      () => h['admin.templates'](guest),
      () => h['admin.audit'](guest),
      () => h['admin.adjust'](guest, { accountId: 'x', points: 1000, reason: 'self-serve' }),
      () => h['admin.vouchers.lookup'](guest, { code: 'MABU-XXXX-XXXX' }),
      () => h['admin.jobs.run'](guest),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it('keeps admin-only tools from front-of-house staff', async () => {
    const { h } = setup();
    await expect(h['admin.rewards'](STAFF)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(h['admin.policy.update'](STAFF, { maxPartySize: 40 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(h['admin.reservations'](STAFF, { date: '2026-10-01' })).resolves.toEqual([]);
  });

  it('shows guests the booking policy without pacing or inventory numbers', async () => {
    const { h } = setup();
    const policy = await h['booking.policy']();
    expect(policy).not.toHaveProperty('coversPerSlot');
    expect(policy).not.toHaveProperty('slotIntervalMinutes');
    expect(policy.cancellationPolicyText).toBeTruthy();
    // The deposit rule is reported off while the deposit feature flag is off.
    const admin = await h['admin.policy'](ADMIN);
    await h['admin.policy.update'](ADMIN, { deposit: { ...admin.deposit, enabled: true } });
    expect((await h['booking.policy']()).deposit.enabled).toBe(false);
  });

  it('signs in with a one-time code and refuses a wrong one', async () => {
    const { h } = setup();
    await expect(
      h['auth.verifyCode'](null, { email: 'new@example.com', code: '000000' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    const res = await h['auth.verifyCode'](null, {
      email: 'New@Example.com',
      code: MOCK_OTP,
      name: 'New Guest',
    });
    expect(res.guest).toMatchObject({ email: 'new@example.com', name: 'New Guest', role: 'guest' });
    expect(res.actor).toEqual({ id: res.guest.id, role: 'guest' });
  });

  it('decides a late cancellation on the server clock', async () => {
    const { b, h } = setup();
    const guest = addGuest(b);
    const r = await h['booking.create'](guest, {
      slotId: 'mabu-waterfall|2026-10-01|19:00',
      partySize: 2,
      guest: { name: 'Lerato Mokoena', email: 'lerato@example.com', phone: '0825550101' },
      idempotencyKey: 'idem_late_check_1',
    });
    expect((await h['booking.get'](guest, { id: r.id })).lateCancellation).toBe(true);
    const other: Actor = { id: 'someone_else', role: 'guest' };
    await expect(h['booking.get'](other, { id: r.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
