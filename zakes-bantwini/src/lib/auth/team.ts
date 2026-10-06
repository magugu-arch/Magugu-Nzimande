import 'server-only';
import { randomBytes } from 'node:crypto';
import type { AdminRole, AdminUser } from '@/lib/booking/types';
import { newId } from '@/lib/security/crypto';
import { getStore } from '@/lib/store';
import type { AdminSession } from './admin';
import { hashPassword, verifyPassword } from './password';

/**
 * Management accounts. Owners add people, set roles and reset passwords;
 * everyone can change their own password. The last owner can never be
 * removed or demoted, so the team cannot lock itself out.
 */
export class TeamError extends Error {}

export const ROLES: { key: AdminRole; label: string; detail: string }[] = [
  { key: 'owner', label: 'Owner', detail: 'Everything, including the team and confirming without the usual requirements' },
  { key: 'manager', label: 'Manager', detail: 'Runs bookings, quotes, the calendar, events and content' },
  { key: 'viewer', label: 'Viewer', detail: 'Reads everything, changes nothing' },
];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function requireOwner(actor: AdminSession) {
  if (actor.role !== 'owner') throw new TeamError('Only an owner can manage the team.');
}

/** A one-time password to hand over in person: 24 URL-safe characters (144 bits). */
export function temporaryPassword(): string {
  return randomBytes(18).toString('base64url');
}

async function ownersOtherThan(id: string): Promise<number> {
  return (await getStore().list('admin_users', { where: { role: 'owner' } })).filter((u) => u.id !== id).length;
}

export async function listTeam(): Promise<AdminUser[]> {
  return getStore().list('admin_users', { orderBy: { field: 'createdAt', dir: 'asc' } });
}

export async function addMember(actor: AdminSession, input: { email: string; name: string; role: string }): Promise<{ user: AdminUser; password: string }> {
  requireOwner(actor);
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 120);
  const role = ROLES.find((r) => r.key === input.role)?.key;
  if (!EMAIL.test(email)) throw new TeamError('Enter a valid email address.');
  if (!name) throw new TeamError('Enter their name.');
  if (!role) throw new TeamError('Choose a role.');
  const store = getStore();
  if (await store.findOne('admin_users', { email })) throw new TeamError('That email already has an account.');
  const password = temporaryPassword();
  const user = await store.insert('admin_users', {
    id: newId(),
    email,
    name,
    role,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  });
  return { user, password };
}

export async function changeRole(actor: AdminSession, id: string, role: string): Promise<AdminUser> {
  requireOwner(actor);
  const next = ROLES.find((r) => r.key === role)?.key;
  if (!next) throw new TeamError('Choose a role.');
  const store = getStore();
  const user = await store.get('admin_users', id);
  if (!user) throw new TeamError('That account no longer exists.');
  if (user.role === 'owner' && next !== 'owner' && (await ownersOtherThan(id)) === 0) {
    throw new TeamError('Make someone else an owner first — the team always needs one.');
  }
  return (await store.update('admin_users', id, { role: next }))!;
}

/** New password for someone else. Changing the hash signs them out everywhere. */
export async function resetPassword(actor: AdminSession, id: string): Promise<{ user: AdminUser; password: string }> {
  requireOwner(actor);
  const store = getStore();
  const user = await store.get('admin_users', id);
  if (!user) throw new TeamError('That account no longer exists.');
  const password = temporaryPassword();
  const updated = (await store.update('admin_users', id, { passwordHash: await hashPassword(password) }))!;
  return { user: updated, password };
}

export async function removeMember(actor: AdminSession, id: string): Promise<AdminUser> {
  requireOwner(actor);
  if (id === actor.id) throw new TeamError('You cannot remove your own account. Ask another owner.');
  const store = getStore();
  const user = await store.get('admin_users', id);
  if (!user) throw new TeamError('That account no longer exists.');
  if (user.role === 'owner' && (await ownersOtherThan(id)) === 0) throw new TeamError('The team always needs an owner.');
  await store.remove('admin_users', id);
  return user;
}

export async function changeOwnPassword(actor: AdminSession, current: string, next: string, confirm: string): Promise<AdminUser> {
  const store = getStore();
  const user = await store.get('admin_users', actor.id);
  if (!user) throw new TeamError('Your account no longer exists.');
  if (!(await verifyPassword(current, user.passwordHash))) throw new TeamError('Your current password is not right.');
  if (next.length < 12) throw new TeamError('Use at least 12 characters.');
  if (next !== confirm) throw new TeamError('The new passwords do not match.');
  if (next === current) throw new TeamError('Choose a password you have not used here.');
  return (await store.update('admin_users', actor.id, { passwordHash: await hashPassword(next) }))!;
}
