import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Account } from '@bbq/types';
import { findById, publicView } from './store';

/**
 * The customer's session.
 *
 * Same discipline as the operations console — signed cookie, constant-time
 * comparison, fails closed with no secret configured — but a separate cookie,
 * a separate secret and a separate module. An operator's session and a
 * customer's must not be interchangeable, and the cheapest way to guarantee
 * that is for neither to be able to mint the other's.
 *
 * The cookie carries an account id and an expiry, and nothing else. No name, no
 * email, no points: everything else is looked up per request, so a customer who
 * changes their details does not carry the old ones around until the cookie
 * expires, and a deleted account's cookie stops working immediately.
 */

const COOKIE = 'bbq_customer';
/** Long enough that a weekly regular is not signed out between orders. */
const SESSION_DAYS = 30;

export const CUSTOMER_COOKIE = COOKIE;

function secret(): string | null {
  const value = process.env.BBQ_SESSION_SECRET;
  return value && value.length >= 16 ? value : null;
}

/**
 * Whether accounts work on this deployment at all.
 *
 * With no secret, registration and sign-in both refuse. That locks customers
 * out of a feature, which is recoverable; the alternative is minting sessions
 * nobody can verify, which is not.
 */
export function areAccountsConfigured(): boolean {
  return secret() !== null;
}

function signingKey(value: string): Buffer {
  return createHmac('sha256', value).update('bb.q customer session v1').digest();
}

function sign(payload: string, value: string): string {
  return createHmac('sha256', signingKey(value)).update(payload).digest('hex');
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = createHmac('sha256', 'compare').update(a).digest();
  const right = createHmac('sha256', 'compare').update(b).digest();
  return timingSafeEqual(left, right);
}

export function mintSession(accountId: string, now = Date.now()): string | null {
  const value = secret();
  if (!value) return null;

  const expiresAt = now + SESSION_DAYS * 86_400_000;
  const payload = `${accountId}.${expiresAt}`;
  return `${payload}.${sign(payload, value)}`;
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  const attributes = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    // Lax rather than the console's Strict: a customer following a link to
    // their order from a confirmation email should arrive signed in, and a
    // top-level GET carrying this cookie is not a way to act on their behalf.
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === 'production') attributes.push('Secure');
  return attributes.join('; ');
}

export function signInCookie(accountId: string, now = Date.now()): string | null {
  const token = mintSession(accountId, now);
  return token === null ? null : sessionCookie(token, SESSION_DAYS * 86_400);
}

export const signOutCookie = (): string => sessionCookie('', 0);

/** The account id a token attests to, or null if it attests to nothing. */
export function accountIdFrom(token: string | null, now = Date.now()): string | null {
  const value = secret();
  if (!value || !token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [accountId, expiresAt, signature] = parts as [string, string, string];
  // Signature before expiry, so an expired forgery and an expired real token
  // are indistinguishable from outside.
  if (!constantTimeEquals(signature, sign(`${accountId}.${expiresAt}`, value))) return null;

  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now) return null;
  return accountId;
}

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

/**
 * The signed-in customer, or null.
 *
 * Looks the account up rather than trusting the cookie's contents, so a session
 * for an account that has since been erased resolves to nobody — which is what
 * makes erasure take effect at once instead of in thirty days.
 */
export function currentAccount(request: Request, now = Date.now()): Account | null {
  const id = accountIdFrom(tokenFrom(request), now);
  if (!id) return null;

  const stored = findById(id);
  return stored ? publicView(stored) : null;
}

/**
 * The signed-in customer during a server render.
 *
 * The same resolution as `currentAccount`, reading the cookie through
 * `next/headers` rather than off a Request. It exists so the account page can
 * render already signed in — a client effect that fetches who you are shows
 * everybody a loading state first, including the people who are not signed in
 * and have nothing to wait for.
 */
export async function currentAccountFromCookies(
  read: () => Promise<{ get(name: string): { value: string } | undefined }>,
  now = Date.now(),
): Promise<Account | null> {
  const token = (await read()).get(COOKIE)?.value ?? null;
  const id = accountIdFrom(token, now);
  if (!id) return null;

  const stored = findById(id);
  return stored ? publicView(stored) : null;
}

/** The guard an account-only endpoint runs first. A value, so it cannot fail open. */
export function refuseUnlessSignedIn(request: Request): Response | null {
  if (!areAccountsConfigured()) {
    return Response.json({ error: 'Accounts are not configured on this deployment.' }, { status: 503 });
  }
  if (!currentAccount(request)) {
    return Response.json({ error: 'Sign in to do that.' }, { status: 401 });
  }
  return null;
}
