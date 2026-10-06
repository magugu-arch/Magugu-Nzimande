import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Customer } from '@/lib/booking/types';
import { UniqueViolation, type Store } from '@/lib/store/types';
import { storeHarnesses } from './stores';

const customer = (id: string, email: string, createdAt: string): Customer => ({
  id,
  fullName: `Person ${id}`,
  organisation: id === 'a' ? null : 'Org',
  email,
  phone: '+27 82 000 0000',
  whatsappOptIn: id === 'b',
  createdAt,
});

describe.each(storeHarnesses())('store contract — $name', (harness) => {
  let store: Store;
  beforeEach(async () => {
    store = await harness.fresh();
  });
  afterAll(() => harness.close());

  it('round-trips rows with nulls, booleans and ISO timestamps intact', async () => {
    const row = customer('a', 'a@example.com', '2026-10-06T10:00:00.000Z');
    await store.insert('customers', row);
    expect(await store.get('customers', 'a')).toEqual(row);
  });

  it('filters, ranges, orders and limits', async () => {
    await store.insert('customers', customer('a', 'a@example.com', '2026-10-01T00:00:00.000Z'));
    await store.insert('customers', customer('b', 'b@example.com', '2026-10-03T00:00:00.000Z'));
    await store.insert('customers', customer('c', 'c@example.com', '2026-10-05T00:00:00.000Z'));
    expect((await store.list('customers', { where: { whatsappOptIn: true } })).map((c) => c.id)).toEqual(['b']);
    expect((await store.list('customers', { where: { organisation: null } })).map((c) => c.id)).toEqual(['a']);
    expect((await store.list('customers', { orderBy: { field: 'createdAt', dir: 'desc' }, limit: 2 })).map((c) => c.id)).toEqual(['c', 'b']);
    expect((await store.list('customers', { in: { field: 'id', values: ['a', 'c'] }, orderBy: { field: 'id', dir: 'asc' } })).map((c) => c.id)).toEqual(['a', 'c']);
    expect(await store.count('customers', { range: { field: 'createdAt', from: '2026-10-02', to: '2026-10-04' } })).toBe(1);
  });

  it('keeps calendar days as plain dates and upserts by day', async () => {
    const entry = { date: '2026-12-24', state: 'TRAVEL' as const, bookingId: null, note: 'Flights', updatedAt: '2026-10-06T10:00:00.000Z', updatedBy: 'test' };
    await store.upsert('availability', entry);
    await store.upsert('availability', { ...entry, state: 'UNAVAILABLE', note: null });
    const rows = await store.list('availability', { range: { field: 'date', from: '2026-12-01', to: '2026-12-31' } });
    expect(rows).toEqual([{ ...entry, state: 'UNAVAILABLE', note: null }]);
    expect(await store.remove('availability', '2026-12-24')).toBe(true);
    expect(await store.get('availability', '2026-12-24')).toBeNull();
  });

  it('enforces unique constraints', async () => {
    const admin = { id: 'u1', email: 'one@example.com', name: 'One', role: 'owner' as const, passwordHash: 'x', createdAt: '2026-10-06T10:00:00.000Z', lastLoginAt: null };
    await store.insert('admin_users', admin);
    await expect(store.insert('admin_users', { ...admin, id: 'u2' })).rejects.toBeInstanceOf(UniqueViolation);
  });

  it('stores JSON columns and partial updates', async () => {
    await store.insert('audit_log', { id: 'x', bookingId: null, actor: 'test', action: 'thing', detail: { a: 1, nested: { b: [1, 2] } }, createdAt: '2026-10-06T10:00:00.000Z' });
    expect((await store.get('audit_log', 'x'))?.detail).toEqual({ a: 1, nested: { b: [1, 2] } });
    const updated = await store.update('audit_log', 'x', { action: 'other' });
    expect(updated?.action).toBe('other');
    expect(updated?.detail).toEqual({ a: 1, nested: { b: [1, 2] } });
    expect(await store.update('audit_log', 'missing', { action: 'nope' })).toBeNull();
  });

  it('hands out booking reference numbers without gaps or repeats under concurrency', async () => {
    const numbers = await Promise.all(Array.from({ length: 12 }, () => store.nextReferenceNumber(2027)));
    expect([...numbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(await store.nextReferenceNumber(2028)).toBe(1);
  });

  it('commits every write in a transaction together', async () => {
    await store.transaction(async (tx) => {
      await tx.insert('customers', customer('a', 'a@example.com', '2026-10-01T00:00:00.000Z'));
      await tx.insert('customers', customer('b', 'b@example.com', '2026-10-02T00:00:00.000Z'));
      await tx.nextReferenceNumber(2030);
    });
    expect(await store.count('customers')).toBe(2);
    expect(await store.nextReferenceNumber(2030)).toBe(2);
  });

  it('rolls back every write when the transaction fails part-way', async () => {
    await store.insert('customers', customer('a', 'a@example.com', '2026-10-01T00:00:00.000Z'));
    await expect(
      store.transaction(async (tx) => {
        await tx.update('customers', 'a', { fullName: 'Changed' });
        await tx.insert('customers', customer('b', 'b@example.com', '2026-10-02T00:00:00.000Z'));
        await tx.nextReferenceNumber(2031);
        throw new Error('calendar conflict');
      }),
    ).rejects.toThrow('calendar conflict');
    expect(await store.count('customers')).toBe(1);
    expect((await store.get('customers', 'a'))?.fullName).toBe('Person a');
    expect(await store.nextReferenceNumber(2031)).toBe(1);
  });

  it('rolls back on a constraint violation inside the transaction', async () => {
    await expect(
      store.transaction(async (tx) => {
        await tx.insert('customers', customer('c', 'c@example.com', '2026-10-01T00:00:00.000Z'));
        await tx.insert('customers', customer('c', 'c2@example.com', '2026-10-01T00:00:00.000Z'));
      }),
    ).rejects.toBeInstanceOf(UniqueViolation);
    expect(await store.get('customers', 'c')).toBeNull();
  });
});
