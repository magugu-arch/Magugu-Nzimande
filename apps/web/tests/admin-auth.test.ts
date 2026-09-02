import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as availability } from '@/app/api/admin/availability/route';
import { GET as ordersGet, POST as ordersPost } from '@/app/api/admin/orders/route';
import { POST as services } from '@/app/api/admin/services/route';
import {
  DELETE as signOutRoute,
  GET as sessionGet,
  POST as signInRoute,
} from '@/app/api/admin/session/route';
import { SESSION_COOKIE, isValidToken, signIn } from '@/lib/admin-auth';
import { mutateState } from '@/lib/demo-state';

/**
 * The console's auth boundary, driven through the route handlers.
 *
 * The point of these is what happens to a caller who never signs in: the write
 * endpoints used to answer anyone who found the path.
 */

const PASSPHRASE = 'twice-fried-in-olive-oil';

const cookieValue = (setCookie: string | null) =>
  setCookie?.split(';')[0]?.split('=').slice(1).join('=') ?? '';

/** Signs in through the route and returns the Cookie header for later calls. */
async function operatorCookie(): Promise<string> {
  const response = await signInRoute(
    new Request('http://localhost/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ passphrase: PASSPHRASE }),
    }),
  );
  expect(response.status).toBe(200);
  return `${SESSION_COOKIE}=${cookieValue(response.headers.get('set-cookie'))}`;
}

const anonymous = (url: string, body?: unknown) =>
  new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const asOperator = (cookie: string, url: string, body?: unknown) =>
  new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

beforeEach(() => {
  process.env.BBQ_ADMIN_PASSWORD = PASSPHRASE;
  mutateState((state) => {
    state.consoleLock = { failures: 0, lockedUntil: null };
  });
});

afterEach(() => {
  delete process.env.BBQ_ADMIN_PASSWORD;
});

describe('a caller who has not signed in', () => {
  it('cannot read the order queue', async () => {
    const response = await ordersGet(anonymous('http://localhost/api/admin/orders'));
    expect(response.status).toBe(401);
  });

  it('cannot move an order', async () => {
    const response = await ordersPost(
      anonymous('http://localhost/api/admin/orders', { orderId: 'any', status: 'preparing' }),
    );
    expect(response.status).toBe(401);
  });

  it('cannot mark an item sold out', async () => {
    const response = await availability(
      anonymous('http://localhost/api/admin/availability', { slug: 'any', soldOut: true }),
    );
    expect(response.status).toBe(401);
  });

  it('cannot switch a store service off', async () => {
    const response = await services(
      anonymous('http://localhost/api/admin/services', {
        storeId: 'any',
        mode: 'Delivery',
        enabled: false,
      }),
    );
    expect(response.status).toBe(401);
  });

  /**
   * The guard has to run before the body is parsed. If a malformed body
   * answered 400 while a well-formed one answered 401, the difference would
   * map the console's schemas to anyone who asked.
   */
  it('is refused before its request body is even considered', async () => {
    const response = await services(
      anonymous('http://localhost/api/admin/services', { nonsense: true }),
    );
    expect(response.status).toBe(401);
  });
});

describe('signing in', () => {
  it('is refused with the wrong passphrase', async () => {
    const response = await signInRoute(
      anonymous('http://localhost/api/admin/session', { passphrase: 'guess' }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('mints a session with the right one', async () => {
    const cookie = await operatorCookie();
    expect(cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
  });

  it('sets a cookie no script can read and no other site can send', async () => {
    const response = await signInRoute(
      anonymous('http://localhost/api/admin/session', { passphrase: PASSPHRASE }),
    );
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\//);
  });

  it('never puts the passphrase in the session cookie', async () => {
    const cookie = await operatorCookie();
    expect(cookie).not.toContain(PASSPHRASE);
  });

  it('does not echo a submitted passphrase back in an error', async () => {
    const response = await signInRoute(
      anonymous('http://localhost/api/admin/session', { passphrase: 'hunter2' }),
    );
    expect(JSON.stringify(await response.json())).not.toContain('hunter2');
  });

  it('locks the console after repeated wrong attempts', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await signInRoute(anonymous('http://localhost/api/admin/session', { passphrase: 'no' }));
    }

    const locked = await signInRoute(
      anonymous('http://localhost/api/admin/session', { passphrase: 'no' }),
    );
    expect(locked.status).toBe(429);

    // And the lockout holds even for the correct passphrase, or it would be a
    // way to tell a right guess from a wrong one while locked.
    const right = await signInRoute(
      anonymous('http://localhost/api/admin/session', { passphrase: PASSPHRASE }),
    );
    expect(right.status).toBe(429);
  });

  it('forgets the failures once somebody gets it right', async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await signInRoute(anonymous('http://localhost/api/admin/session', { passphrase: 'no' }));
    }
    await operatorCookie();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await signInRoute(
        anonymous('http://localhost/api/admin/session', { passphrase: 'no' }),
      );
      expect(response.status).toBe(401);
    }
  });
});

describe('a signed-in operator', () => {
  it('can read the queue', async () => {
    const cookie = await operatorCookie();
    const response = await ordersGet(asOperator(cookie, 'http://localhost/api/admin/orders'));

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty('orders');
  });

  it('gets past the guard into the route’s own validation', async () => {
    const cookie = await operatorCookie();
    const response = await services(
      asOperator(cookie, 'http://localhost/api/admin/services', { nonsense: true }),
    );

    // 400, not 401: the guard passed and the schema refused.
    expect(response.status).toBe(400);
  });

  it('is signed out again by the session endpoint', async () => {
    const cookie = await operatorCookie();
    const out = await signOutRoute(
      new Request('http://localhost/api/admin/session', { method: 'DELETE', headers: { cookie } }),
    );

    expect(out.headers.get('set-cookie')).toMatch(/Max-Age=0/);
  });
});

describe('the session token itself', () => {
  it('is refused when its signature is edited', () => {
    const result = signIn(PASSPHRASE);
    if (!result.ok) throw new Error('expected a session');
    const token = cookieValue(result.cookie);

    const [expiry, nonce] = token.split('.');
    expect(isValidToken(`${expiry}.${nonce}.${'0'.repeat(64)}`)).toBe(false);
  });

  it('is refused when its expiry is pushed out', () => {
    const result = signIn(PASSPHRASE);
    if (!result.ok) throw new Error('expected a session');
    const [, nonce, signature] = cookieValue(result.cookie).split('.');

    // The expiry is inside what is signed, so moving it breaks the signature.
    expect(isValidToken(`${Date.now() + 9_999_999}.${nonce}.${signature}`)).toBe(false);
  });

  it('expires', () => {
    const result = signIn(PASSPHRASE);
    if (!result.ok) throw new Error('expected a session');
    const token = cookieValue(result.cookie);

    expect(isValidToken(token)).toBe(true);
    expect(isValidToken(token, Date.now() + 9 * 3_600_000)).toBe(false);
  });

  it('stops working when the passphrase is rotated', () => {
    const result = signIn(PASSPHRASE);
    if (!result.ok) throw new Error('expected a session');
    const token = cookieValue(result.cookie);

    process.env.BBQ_ADMIN_PASSWORD = 'a-different-passphrase';
    expect(isValidToken(token)).toBe(false);
  });

  it('is not accepted as a bare word', () => {
    expect(isValidToken('true')).toBe(false);
    expect(isValidToken('')).toBe(false);
    expect(isValidToken(null)).toBe(false);
  });
});

describe('a deployment with no passphrase set', () => {
  beforeEach(() => {
    delete process.env.BBQ_ADMIN_PASSWORD;
  });

  /** Fails closed. The console locks rather than opening. */
  it('refuses the write endpoints outright', async () => {
    const response = await availability(
      anonymous('http://localhost/api/admin/availability', { slug: 'any', soldOut: true }),
    );
    expect(response.status).toBe(503);
  });

  it('lets nobody sign in', async () => {
    const response = await signInRoute(
      anonymous('http://localhost/api/admin/session', { passphrase: 'anything' }),
    );
    expect(response.status).toBe(503);
  });

  it('reports itself as unconfigured rather than pretending', async () => {
    const response = await sessionGet(anonymous('http://localhost/api/admin/session'));
    expect(await response.json()).toEqual({ configured: false, signedIn: false });
  });
});
