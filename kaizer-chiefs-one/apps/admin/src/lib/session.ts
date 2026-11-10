import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ROLES, type Role } from '@kc-one/contracts';

export interface StaffSession {
  sub: string;
  name: string;
  role: Role;
  /** Expiry, seconds since epoch. */
  exp: number;
  demo: boolean;
}

export const SESSION_COOKIE = 'kc1_admin';
/** Staff sessions are short: eight hours, one working shift. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString('base64url');
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function encodeSession(s: StaffSession, secret: string): string {
  const payload = b64url(JSON.stringify(s));
  return `${payload}.${sign(payload, secret)}`;
}

/** Verifies signature, shape and expiry. Anything wrong yields null. */
export function decodeSession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): StaffSession | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as StaffSession;
    if (typeof s.sub !== 'string' || !(ROLES as readonly string[]).includes(s.role)) return null;
    if (typeof s.exp !== 'number' || s.exp * 1000 <= now) return null;
    return s;
  } catch {
    return null;
  }
}
