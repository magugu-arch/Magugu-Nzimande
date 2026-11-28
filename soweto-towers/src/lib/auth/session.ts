import 'server-only';
import { eq } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, schema } from '@/lib/db';

export const SESSION_COOKIE = 'st_staff';
const MAX_AGE = 60 * 60 * 12; // one shift

export type StaffSession = { id: string; name: string; email: string; role: 'admin' | 'crew'; version: number };

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
      throw new Error('AUTH_SECRET must be set in production.');
    }
    // Previews and local development only: a fixed key, never used with a real database.
    return new TextEncoder().encode('soweto-towers-preview-only-secret-change-me-0001');
  }
  return new TextEncoder().encode(value);
}

export async function createSession(staff: StaffSession): Promise<void> {
  const token = await new SignJWT({ name: staff.name, email: staff.email, role: staff.role, ver: staff.version })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(staff.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSessionToken(token: string | undefined): Promise<StaffSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      name: String(payload.name ?? ''),
      email: String(payload.email ?? ''),
      role: payload.role === 'admin' ? 'admin' : 'crew',
      version: typeof payload.ver === 'number' ? payload.ver : 0,
    };
  } catch {
    return null;
  }
}

/**
 * The signed-in staff member, re-checked against the database: removed staff
 * lose access at once, and a password change signs out every other device.
 */
export async function getStaff(): Promise<StaffSession | null> {
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const db = await getDb();
  const [row] = await db.select({ id: schema.staff.id, version: schema.staff.sessionVersion }).from(schema.staff).where(eq(schema.staff.id, session.id));
  return row && row.version === session.version ? session : null;
}

export async function requireStaff(role?: 'admin'): Promise<StaffSession> {
  const s = await getStaff();
  if (!s) redirect('/admin/login');
  if (role === 'admin' && s.role !== 'admin') redirect('/admin?denied=1');
  return s;
}
