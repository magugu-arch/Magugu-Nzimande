import 'server-only';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export function newId(): string {
  return randomUUID();
}

/** 256-bit URL-safe token for client portal links. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The server secret everything else is keyed from. Required in production. */
export function appSecret(): string {
  const secret = process.env.APP_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('APP_SECRET must be set (32+ characters) in production.');
  return 'development-only-secret-do-not-use-in-production';
}

/** Keyed hash for values we must be able to match but never want to store, like IPs. */
export function keyedHash(value: string, purpose: string): string {
  return createHmac('sha256', `${appSecret()}:${purpose}`).update(value).digest('hex');
}

export function sign(payload: string, purpose: string): string {
  return createHmac('sha256', `${appSecret()}:${purpose}`).update(payload).digest('base64url');
}
