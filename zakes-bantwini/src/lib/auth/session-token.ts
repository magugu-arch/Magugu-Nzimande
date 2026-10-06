import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Admin session cookie: `<userId>.<expires>.<fingerprint>.<signature>`.
 * The fingerprint is derived from the user's password hash, so changing a
 * password signs out every existing session. Pure functions of the secret,
 * with no `server-only` import, so proxy.ts can verify them too.
 */
export const SESSION_COOKIE = 'zb_admin';
export const SESSION_HOURS = 8;

export function sessionSecret(): string {
  const secret = process.env.APP_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('APP_SECRET must be set (32+ characters) in production.');
  return 'development-only-secret-do-not-use-in-production';
}

export function fingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

function mac(payload: string): string {
  return createHmac('sha256', `${sessionSecret()}:admin-session`).update(payload).digest('base64url');
}

export function createSessionToken(userId: string, passwordHash: string, now = Date.now()): { token: string; expires: Date } {
  const expires = new Date(now + SESSION_HOURS * 3_600_000);
  const payload = `${userId}.${expires.getTime()}.${fingerprint(passwordHash)}`;
  return { token: `${payload}.${mac(payload)}`, expires };
}

export function readSessionToken(token: string | undefined, now = Date.now()): { userId: string; fingerprint: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [userId, exp, fp, sig] = parts as [string, string, string, string];
  const expected = Buffer.from(mac(`${userId}.${exp}.${fp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!/^\d+$/.test(exp) || Number(exp) < now) return null;
  return { userId, fingerprint: fp };
}
