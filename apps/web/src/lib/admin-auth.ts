import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mutateState, readState } from './demo-state';

/**
 * The operations console's auth boundary.
 *
 * One shared operator passphrase, not a staff directory. Real accounts — per
 * person, with roles, revocation and a password reset that reaches an inbox —
 * need a user store and an email sender that this deployment does not have.
 * What is here is the boundary itself: without it the console's write
 * endpoints were reachable by anyone who guessed the path, which is a
 * different problem from not knowing which cook pressed the button.
 *
 * Fails closed. With no passphrase configured the console refuses everyone
 * rather than admitting everyone: a deployment that forgets the variable gets
 * a locked console, which is recoverable, instead of a world-writable one,
 * which is not.
 */

const COOKIE = 'bbq_ops';
/** A shift, not a fortnight. An unattended console in a kitchen locks itself. */
const SESSION_HOURS = 8;
const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 15;

export const SESSION_COOKIE = COOKIE;

/** The configured passphrase, or null when the console is switched off. */
function passphrase(): string | null {
  const value = process.env.BBQ_ADMIN_PASSWORD;
  return value && value.length > 0 ? value : null;
}

export function isConsoleConfigured(): boolean {
  return passphrase() !== null;
}

/**
 * The signing key is derived from the passphrase rather than configured
 * separately, so there is one secret to deploy and rotating it ends every
 * live session by construction.
 */
function signingKey(secret: string): Buffer {
  return createHmac('sha256', secret).update('bb.q ops session v1').digest();
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', signingKey(secret)).update(payload).digest('hex');
}

/** Compares two strings without leaking where they first differ. */
function constantTimeEquals(a: string, b: string): boolean {
  // Hashed first so the buffers are always the same length: timingSafeEqual
  // throws on a length mismatch, and throwing is itself a signal.
  const left = createHmac('sha256', 'compare').update(a).digest();
  const right = createHmac('sha256', 'compare').update(b).digest();
  return timingSafeEqual(left, right);
}

export type SignInResult =
  | { ok: true; cookie: string }
  | { ok: false; status: number; error: string };

/** Failed attempts are counted in the shared state so every worker agrees. */
function lockedUntil(): number {
  const value = readState().consoleLock;
  if (!value?.lockedUntil) return 0;
  const until = Date.parse(value.lockedUntil);
  return Number.isNaN(until) ? 0 : until;
}

function recordFailure(now: number): void {
  mutateState((state) => {
    const previous = state.consoleLock ?? { failures: 0, lockedUntil: null };
    const failures = previous.failures + 1;
    state.consoleLock =
      failures >= MAX_FAILURES
        ? { failures: 0, lockedUntil: new Date(now + LOCKOUT_MINUTES * 60_000).toISOString() }
        : { failures, lockedUntil: null };
  });
}

function clearFailures(): void {
  mutateState((state) => {
    state.consoleLock = { failures: 0, lockedUntil: null };
  });
}

/**
 * Checks a passphrase and mints a session.
 *
 * Wrong attempts are counted and lock the console for a quarter of an hour, so
 * a passphrase short enough for a kitchen to remember is not also short enough
 * to guess over a lunch service.
 */
export function signIn(candidate: string, now = Date.now()): SignInResult {
  const secret = passphrase();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: 'The console has no passphrase configured, so nobody can sign in.',
    };
  }

  const until = lockedUntil();
  if (until > now) {
    const minutes = Math.ceil((until - now) / 60_000);
    return {
      ok: false,
      status: 429,
      error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    };
  }

  if (!constantTimeEquals(candidate, secret)) {
    recordFailure(now);
    return { ok: false, status: 401, error: 'That passphrase is not right.' };
  }

  clearFailures();
  return { ok: true, cookie: sessionCookie(mintToken(secret, now), SESSION_HOURS * 3_600) };
}

function mintToken(secret: string, now: number): string {
  const expiresAt = now + SESSION_HOURS * 3_600_000;
  // The nonce makes two sessions minted in the same millisecond distinct, so
  // one operator signing out cannot be confused with another.
  const payload = `${expiresAt}.${randomBytes(9).toString('hex')}`;
  return `${payload}.${sign(payload, secret)}`;
}

function sessionCookie(value: string, maxAgeSeconds: number): string {
  const attributes = [
    `${COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    // Strict rather than Lax: nothing should ever arrive at the console from
    // another site, so a cross-site request carrying the cookie is a mistake.
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === 'production') attributes.push('Secure');
  return attributes.join('; ');
}

export function signOutCookie(): string {
  return sessionCookie('', 0);
}

/** Whether a token is one this server signed and has not yet expired. */
export function isValidToken(token: string | null, now = Date.now()): boolean {
  const secret = passphrase();
  if (!secret || !token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [expiresAt, nonce, signature] = parts as [string, string, string];
  const expected = sign(`${expiresAt}.${nonce}`, secret);
  // Signature first: an expired-but-unsigned token and an expired-and-signed
  // one should be indistinguishable from outside.
  if (!constantTimeEquals(signature, expected)) return false;

  const expiry = Number(expiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

/** Reads our cookie out of a request's Cookie header. */
export function tokenFrom(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;

  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    if (pair.slice(0, index).trim() === COOKIE) return pair.slice(index + 1).trim();
  }
  return null;
}

export function isSignedIn(request: Request, now = Date.now()): boolean {
  return isValidToken(tokenFrom(request), now);
}

/**
 * The guard every console endpoint runs first. Returns a response to send
 * when the caller may not proceed, and null when they may.
 *
 * Deliberately a value rather than a thrown error: a route that forgets to
 * catch would otherwise fail open.
 */
export function refuseUnlessOperator(request: Request): Response | null {
  if (!isConsoleConfigured()) {
    return Response.json(
      { error: 'The operations console is not configured on this deployment.' },
      { status: 503 },
    );
  }
  if (!isSignedIn(request)) {
    return Response.json({ error: 'Sign in to use the console.' }, { status: 401 });
  }
  return null;
}
