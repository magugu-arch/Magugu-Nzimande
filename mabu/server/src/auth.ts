/**
 * Passwordless sign-in for the live server: a six-digit code by email, then a
 * bearer session. Codes and tokens are stored only as SHA-256 hashes, so the
 * database cannot be read to sign in as anybody.
 *
 * Limits: a code lives 10 minutes and allows 5 attempts; an address may ask
 * for 5 codes per 15 minutes, one client address for 20 per hour, and may try
 * 20 codes an hour. A guest's session lasts 60 days of use and 180 days in
 * all; a staff or admin session lasts 12 hours of use and 7 days in all,
 * because those sessions can see other people's bookings.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../src/domain/shared/errors';
import { RateLimiter } from './security';
import type { ServerStore, SessionRecord } from './store';

export const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;
const DAY = 24 * 60 * 60_000;

/** Idle life and hard life, per role. */
export const SESSION_LIFE = {
  guest: { idleMs: 60 * DAY, absoluteMs: 180 * DAY },
  staff: { idleMs: 12 * 60 * 60_000, absoluteMs: 7 * DAY },
  admin: { idleMs: 12 * 60 * 60_000, absoluteMs: 7 * DAY },
} as const;

/** Kept for callers that only want the guest default. */
export const SESSION_TTL_MS = SESSION_LIFE.guest.idleMs;

/** How recently a staff member must have signed in to change money or policy. */
export const FRESH_SESSION_MS = 30 * 60_000;

export interface EmailSender {
  /** Sends a transactional email; resolves when the provider has accepted it. */
  send(to: string, subject: string, text: string): Promise<void>;
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const tooMany = () =>
  new DomainError(
    'RATE_LIMITED',
    'Too many codes requested. Please wait a few minutes and try again.',
    'otp rate limit',
  );

export class Auth {
  private perEmail = new RateLimiter(5, 15 * 60_000);
  private perIp = new RateLimiter(20, 60 * 60_000);
  private verifyPerIp = new RateLimiter(20, 60 * 60_000);

  constructor(
    private readonly store: ServerStore,
    private readonly email: EmailSender | null,
    private readonly now: () => Date,
    /** Salts the stored address hash, so the hashes cannot be looked up. */
    private readonly ipSalt: string = randomBytes(16).toString('hex'),
    /**
     * The role the guest holds now. A session's life follows it, so promoting
     * someone to staff shortens their existing sessions at once rather than
     * leaving them with a guest's sixty days.
     */
    private readonly roleOf?: (guestId: string) => string,
  ) {}

  hashIp(ip: string): string {
    return sha256(`${this.ipSalt}:${ip}`);
  }

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
  async verifyCode(rawEmail: string, code: string, ip = 'unknown'): Promise<void> {
    const email = normaliseEmail(rawEmail);
    if (!this.verifyPerIp.take(ip, this.now().getTime())) {
      throw new DomainError(
        'RATE_LIMITED',
        'Too many attempts. Please wait a few minutes and try again.',
        'otp verify rate limit',
      );
    }
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

  /**
   * Opens a session. Returns the token and whether this device is one the
   * guest has used before, so the caller can tell them about a new sign-in.
   */
  async createSession(
    guestId: string,
    context: { role?: string; label?: string; ip?: string } = {},
  ): Promise<{ token: string; newDevice: boolean }> {
    const token = randomBytes(32).toString('base64url');
    const t = this.now().getTime();
    const role = context.role === 'staff' || context.role === 'admin' ? context.role : 'guest';
    const life = SESSION_LIFE[role];
    const ipHash = context.ip ? this.hashIp(context.ip) : undefined;
    const known = await this.store.listSessions(guestId);
    const newDevice =
      known.length > 0 && !known.some((s) => s.label === context.label && s.ipHash === ipHash);
    await this.store.putSession({
      tokenHash: sha256(token),
      guestId,
      createdAt: new Date(t).toISOString(),
      expiresAt: new Date(t + life.idleMs).toISOString(),
      absoluteExpiresAt: new Date(t + life.absoluteMs).toISOString(),
      lastSeenAt: new Date(t).toISOString(),
      role,
      label: context.label,
      ipHash,
    });
    return { token, newDevice };
  }

  /**
   * The session behind a bearer token, or null when it is unknown, idle for
   * too long, or past its hard expiry. A session in use is renewed, but never
   * beyond that hard expiry.
   */
  async resolve(token: string | undefined): Promise<SessionRecord | null> {
    if (!token) return null;
    const hash = sha256(token);
    const session = await this.store.getSession(hash);
    if (!session) return null;
    const t = this.now().getTime();
    const role = this.roleOf?.(session.guestId) ?? session.role ?? 'guest';
    const life = SESSION_LIFE[role as keyof typeof SESSION_LIFE] ?? SESSION_LIFE.guest;
    // Both limits are measured against the role held now, so a guest session
    // that became a staff session is held to the staff limits from that moment.
    const absolute = Math.min(
      session.absoluteExpiresAt ? new Date(session.absoluteExpiresAt).getTime() : Infinity,
      new Date(session.createdAt).getTime() + life.absoluteMs,
    );
    const idleDeadline = new Date(session.lastSeenAt).getTime() + life.idleMs;
    if (Math.min(new Date(session.expiresAt).getTime(), idleDeadline) <= t || absolute <= t) {
      await this.store.deleteSession(hash);
      return null;
    }
    // Renew at most hourly, so reads do not write on every call.
    if (t - new Date(session.lastSeenAt).getTime() > 60 * 60_000) {
      await this.store.putSession({
        ...session,
        role,
        lastSeenAt: new Date(t).toISOString(),
        expiresAt: new Date(Math.min(t + life.idleMs, absolute)).toISOString(),
      });
    }
    return session;
  }

  /** The guest's own list of sign-ins. No token or address ever leaves here. */
  async sessions(guestId: string, currentToken?: string) {
    const current = currentToken ? sha256(currentToken) : undefined;
    const now = this.now().getTime();
    return (await this.store.listSessions(guestId))
      .filter((s) => new Date(s.expiresAt).getTime() > now)
      .map((s) => ({
        id: s.tokenHash.slice(0, 12),
        label: s.label ?? 'Unknown device',
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        expiresAt: s.expiresAt,
        current: s.tokenHash === current,
      }))
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  /** Ends every other session (a lost phone), or all of them. */
  async revoke(guestId: string, keepToken?: string): Promise<number> {
    return this.store.deleteSessionsFor(guestId, keepToken ? sha256(keepToken) : undefined);
  }

  async endSession(token: string | undefined): Promise<void> {
    if (token) await this.store.deleteSession(sha256(token));
  }

  /** Tells a guest their account was opened on a device it had not seen. */
  async alertNewSignIn(to: string, label: string, when: Date): Promise<void> {
    if (!this.email) return;
    await this.email
      .send(
        to,
        'A new sign-in to your Mábu account',
        `Your Mábu account was opened on ${label} at ${when.toISOString().slice(11, 16)} on ${when
          .toISOString()
          .slice(
            0,
            10,
          )}.\n\nIf that was you, there is nothing to do. If it was not, open the app and choose "Sign out everywhere else" under Profile → Sign-ins and devices, and tell us at reservations@maburestaurant.com.`,
      )
      .catch(() => undefined);
  }
}

export function normaliseEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) {
    throw new DomainError('VALIDATION', 'Please enter a valid email address.', 'email');
  }
  return e;
}
