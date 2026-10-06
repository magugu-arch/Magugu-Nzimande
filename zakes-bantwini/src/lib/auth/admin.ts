import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AdminUser } from '@/lib/booking/types';
import { newId } from '@/lib/security/crypto';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { getStore } from '@/lib/store';
import { hashPassword, verifyPassword } from './password';
import { createSessionToken, fingerprint, readSessionToken, SESSION_COOKIE } from './session-token';

export type AdminSession = { id: string; name: string; email: string; role: AdminUser['role'] };

/** The signed-in admin, or null. Re-checks the user and their password fingerprint on every call. */
export async function getAdmin(): Promise<AdminSession | null> {
  const jar = await cookies();
  const session = readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await getStore().get('admin_users', session.userId);
  if (!user || fingerprint(user.passwordHash) !== session.fingerprint) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** For admin pages and server actions: proxy.ts gates the route, this re-checks at the data. */
export async function requireAdmin(): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}

/**
 * First-run bootstrap: while no admin users exist, ADMIN_BOOTSTRAP_EMAIL and
 * ADMIN_BOOTSTRAP_PASSWORD let one owner sign in, which creates their account.
 * Once any admin exists the variables are ignored — remove them after setup.
 */
async function bootstrapOwner(email: string, password: string): Promise<AdminUser | null> {
  const store = getStore();
  const bootEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.toLowerCase();
  const bootPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!bootEmail || !bootPassword || email !== bootEmail || password !== bootPassword) return null;
  if ((await store.count('admin_users')) > 0) return null;
  return store.insert('admin_users', {
    id: newId(),
    email: bootEmail,
    name: process.env.ADMIN_BOOTSTRAP_NAME ?? 'Management',
    role: 'owner',
    passwordHash: await hashPassword(bootPassword),
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  });
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(emailInput: string, password: string): Promise<LoginResult> {
  const email = emailInput.trim().toLowerCase();
  const ip = clientIp(await headers());
  // Both per address and per account, so neither spraying nor guessing is cheap.
  const byIp = rateLimit(`login:ip:${ip}`, 20, 15 * 60_000);
  const byAccount = rateLimit(`login:acct:${email}`, 8, 15 * 60_000);
  if (!byIp.ok || !byAccount.ok) {
    return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(Math.max(byIp.retryAfterSeconds, byAccount.retryAfterSeconds) / 60)} minutes.` };
  }

  const store = getStore();
  let user = await store.findOne('admin_users', { email });
  if (!user) user = await bootstrapOwner(email, password);
  // Same work and same message whether or not the account exists.
  const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, DUMMY_HASH).then(() => false);
  if (!user || !valid) return { ok: false, error: 'That email and password do not match an admin account.' };

  await store.update('admin_users', user.id, { lastLoginAt: new Date().toISOString() });
  await startSession(user);
  return { ok: true };
}

/** Issue the session cookie — on sign-in, and again after a password change (which voids the old one). */
export async function startSession(user: Pick<AdminUser, 'id' | 'passwordHash'>): Promise<void> {
  const { token, expires } = createSessionToken(user.id, user.passwordHash);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

const DUMMY_HASH = 'scrypt$32768$8$1$c2FsdHNhbHRzYWx0c2FsdA$' + 'A'.repeat(86);
