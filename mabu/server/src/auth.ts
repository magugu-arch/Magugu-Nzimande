/**
 * Passwordless sign-in for the live server: a six-digit code by email, then a
 * bearer session. Codes and tokens are stored only as SHA-256 hashes.
 *
 * Limits: a code lives 10 minutes and allows 5 attempts; an address may ask
 * for 5 codes per 15 minutes and one client IP for 20 per hour. Sessions last
 * 60 days and are renewed as they are used.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../src/domain/shared/errors';
import type { ServerStore } from './store';

export const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
export const SESSION_TTL_MS = 60 * 24 * 60 * 60_000;

export interface EmailSender {
  /** Sends a transactional email; resolves when the provider has accepted it. */
  send(to: string, subject: string, text: string): Promise<void>;
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** A fixed-window counter per key. One process, so memory is the right home. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  take(key: string, now: number): boolean {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }
}

const tooMany = () =>
  new DomainError(
    'RATE_LIMITED',
    'Too many codes requested. Please wait a few minutes and try again.',
    'otp rate limit',
  );

export class Auth {
  private perEmail = new RateLimiter(5, 15 * 60_000);
  private perIp = new RateLimiter(20, 60 * 60_000);

  constructor(
    private readonly store: ServerStore,
    private readonly email: EmailSender | null,
    private readonly now: () => Date,
  ) {}

  async requestCode(rawEmail: string, ip: string): Promise<void> {
    const email = normaliseEmail(rawEmail);
    const t = this.now().getTime();
    if (!this.perIp.take(ip, t) || !this.perEmail.take(email, t)) throw tooMany();
    if (!this.email) {
      throw new DomainError(
        'NOT_CONFIGURED',
        'Sign-in by email is not available just yet. Please contact our reservations team.',
        'no email sender configured',
      );
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.store.putOtp({
      email,
      codeHash: sha256(`${email}:${code}`),
      expiresAt: new Date(t + CODE_TTL_MS).toISOString(),
      attempts: 0,
      sentAt: new Date(t).toISOString(),
    });
    await this.email.send(
      email,
      'Your Mábu sign-in code',
      `Your Mábu sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not ask for it, you can ignore this email.`,
    );
  }

  /** Throws unless the code is right; a right code is consumed. */
  async verifyCode(rawEmail: string, code: string): Promise<void> {
    const email = normaliseEmail(rawEmail);
    const wrong = new DomainError(
      'VALIDATION',
      'That code is not right. Please check it and try again.',
      'otp',
    );
    const record = await this.store.getOtp(email);
    if (!record) throw wrong;
    if (new Date(record.expiresAt).getTime() <= this.now().getTime()) {
      await this.store.deleteOtp(email);
      throw new DomainError('EXPIRED', 'That code has expired. Please ask for a new one.', 'otp');
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      await this.store.deleteOtp(email);
      throw new DomainError(
        'RATE_LIMITED',
        'Too many attempts. Please ask for a new code.',
        'otp attempts',
      );
    }
    const expected = Buffer.from(record.codeHash, 'hex');
    const given = Buffer.from(sha256(`${email}:${code.trim()}`), 'hex');
    if (!timingSafeEqual(expected, given)) {
      await this.store.putOtp({ ...record, attempts: record.attempts + 1 });
      throw wrong;
    }
    await this.store.deleteOtp(email);
  }

  async createSession(guestId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const t = this.now().getTime();
    await this.store.putSession({
      tokenHash: sha256(token),
      guestId,
      createdAt: new Date(t).toISOString(),
      expiresAt: new Date(t + SESSION_TTL_MS).toISOString(),
      lastSeenAt: new Date(t).toISOString(),
    });
    return token;
  }

  /** The guest id behind a bearer token, or null. Renews a session in use. */
  async resolve(token: string | undefined): Promise<string | null> {
    if (!token) return null;
    const hash = sha256(token);
    const session = await this.store.getSession(hash);
    if (!session) return null;
    const t = this.now().getTime();
    if (new Date(session.expiresAt).getTime() <= t) {
      await this.store.deleteSession(hash);
      return null;
    }
    // Renew at most daily, so reads do not write on every call.
    if (t - new Date(session.lastSeenAt).getTime() > 24 * 60 * 60_000) {
      await this.store.putSession({
        ...session,
        lastSeenAt: new Date(t).toISOString(),
        expiresAt: new Date(t + SESSION_TTL_MS).toISOString(),
      });
    }
    return session.guestId;
  }

  async endSession(token: string | undefined): Promise<void> {
    if (token) await this.store.deleteSession(sha256(token));
  }
}

export function normaliseEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) {
    throw new DomainError('VALIDATION', 'Please enter a valid email address.', 'email');
  }
  return e;
}
