import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { can, type Permission } from '@kc-one/contracts';
import { readAdminConfig } from './env';
import { decodeSession, SESSION_COOKIE, type StaffSession } from './session';
import { currentRole } from './store';

/**
 * Data access layer: every page and server action goes through these, so
 * authentication and authorisation are checked on the server for every
 * request, not just hidden in the navigation.
 */
export const getSession = cache(async (): Promise<StaffSession | null> => {
  const config = readAdminConfig();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = decodeSession(token, config.sessionSecret);
  if (!session) return null;
  // Re-read the role on every request so a role change or deactivation
  // takes effect immediately rather than when the cookie expires.
  const role = session.demo ? currentRole(session.sub) : session.role;
  if (!role) return null;
  return { ...session, role };
});

export async function requireSession(): Promise<StaffSession> {
  const s = await getSession();
  if (!s) redirect('/sign-in');
  return s;
}

export async function requirePermission(permission: Permission): Promise<StaffSession> {
  const s = await requireSession();
  if (!can(s.role, permission)) redirect(`/forbidden?need=${encodeURIComponent(permission)}`);
  return s;
}
