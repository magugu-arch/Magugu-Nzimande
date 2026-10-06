import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AdminSession } from '@/lib/auth/admin';
import { verifyPassword } from '@/lib/auth/password';
import { addMember, changeOwnPassword, changeRole, removeMember, resetPassword, TeamError } from '@/lib/auth/team';
import { csvCell, toCsv } from '@/lib/csv';
import { setStoreForTesting } from '@/lib/store';
import { FileStore } from '@/lib/store/file-store';
import type { Store } from '@/lib/store/types';

describe('CSV export', () => {
  it('quotes every cell and doubles embedded quotes', () => {
    expect(csvCell('Plain')).toBe('"Plain"');
    expect(csvCell('Say "hi", then go')).toBe('"Say ""hi"", then go"');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(true)).toBe('"yes"');
    expect(csvCell(1200)).toBe('"1200"');
  });

  it('neutralises anything a spreadsheet would run as a formula', () => {
    for (const evil of ['=HYPERLINK("http://x","click")', '+27 82 000 0000', '-2+3', '@SUM(A1)', '\t=1', '\r=1']) {
      expect(csvCell(evil).startsWith(`"'`), evil).toBe(true);
    }
  });

  it('writes a BOM, a header and CRLF rows', () => {
    expect(toCsv(['A', 'B'], [[1, 'x']])).toBe('﻿"A","B"\r\n"1","x"\r\n');
  });
});

describe('team management', () => {
  let store: Store;
  let owner: AdminSession;
  beforeEach(async () => {
    store = new FileStore(null);
    setStoreForTesting(store);
    await store.insert('admin_users', { id: 'o1', email: 'owner@example.com', name: 'Owner', role: 'owner', passwordHash: 'x', createdAt: '2026-10-01T00:00:00.000Z', lastLoginAt: null });
    owner = { id: 'o1', name: 'Owner', email: 'owner@example.com', role: 'owner' };
  });
  afterEach(() => setStoreForTesting(undefined));

  it('adds people with a one-time password that actually signs them in', async () => {
    const { user, password } = await addMember(owner, { email: ' New@Example.com ', name: 'New Person', role: 'manager' });
    expect(user).toMatchObject({ email: 'new@example.com', role: 'manager' });
    expect(password.length).toBeGreaterThanOrEqual(20);
    expect(await verifyPassword(password, user.passwordHash)).toBe(true);
    await expect(addMember(owner, { email: 'new@example.com', name: 'Again', role: 'viewer' })).rejects.toThrow(/already/);
  });

  it('only owners manage the team', async () => {
    const { user } = await addMember(owner, { email: 'm@example.com', name: 'Manager', role: 'manager' });
    const manager: AdminSession = { id: user.id, name: user.name, email: user.email, role: 'manager' };
    await expect(addMember(manager, { email: 'x@example.com', name: 'X', role: 'owner' })).rejects.toBeInstanceOf(TeamError);
    await expect(changeRole(manager, user.id, 'owner')).rejects.toBeInstanceOf(TeamError);
    await expect(resetPassword(manager, 'o1')).rejects.toBeInstanceOf(TeamError);
    await expect(removeMember(manager, 'o1')).rejects.toBeInstanceOf(TeamError);
  });

  it('never leaves the team without an owner', async () => {
    await expect(changeRole(owner, 'o1', 'manager')).rejects.toThrow(/owner/);
    await expect(removeMember(owner, 'o1')).rejects.toThrow(/own account/);
    const { user } = await addMember(owner, { email: 'o2@example.com', name: 'Second Owner', role: 'owner' });
    await changeRole(owner, 'o1', 'manager');
    const second: AdminSession = { id: user.id, name: user.name, email: user.email, role: 'owner' };
    await expect(changeRole(second, user.id, 'viewer')).rejects.toThrow(/owner/);
    await removeMember(second, 'o1');
    expect(await store.count('admin_users')).toBe(1);
  });

  it('resets a password, which changes the hash and so ends their sessions', async () => {
    const { user } = await addMember(owner, { email: 'v@example.com', name: 'Viewer', role: 'viewer' });
    const { password } = await resetPassword(owner, user.id);
    const after = (await store.get('admin_users', user.id))!;
    expect(after.passwordHash).not.toBe(user.passwordHash);
    expect(await verifyPassword(password, after.passwordHash)).toBe(true);
  });

  it('changes your own password only with the current one', async () => {
    const { user, password } = await addMember(owner, { email: 'self@example.com', name: 'Self', role: 'viewer' });
    const me: AdminSession = { id: user.id, name: user.name, email: user.email, role: 'viewer' };
    await expect(changeOwnPassword(me, 'wrong-password-123', 'a-brand-new-password', 'a-brand-new-password')).rejects.toThrow(/current/);
    await expect(changeOwnPassword(me, password, 'short', 'short')).rejects.toThrow(/12/);
    await expect(changeOwnPassword(me, password, 'a-brand-new-password', 'a-different-password')).rejects.toThrow(/match/);
    const updated = await changeOwnPassword(me, password, 'a-brand-new-password', 'a-brand-new-password');
    expect(await verifyPassword('a-brand-new-password', updated.passwordHash)).toBe(true);
  });
});
