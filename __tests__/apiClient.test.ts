import { config } from '@/constants/config';
import {
  ApiRequestError,
  request,
  resetSessionState,
  setSessionExpiredHandler,
} from '@/services/apiClient';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeTokens,
} from '@/services/secureStorage';

/**
 * Everything here is about the unauthenticated path, which mock mode never
 * reaches — `config.useMockApi` short-circuits every service before it gets to
 * `request`. That is exactly why this was never noticed: a 401 cannot happen
 * against the mock layer, so nothing exercised the handling that was missing.
 */

const jsonResponse = (status: number, body: unknown = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const fetchMock = jest.fn();

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(async () => {
  fetchMock.mockReset();
  resetSessionState();
  await clearTokens();
});

const url = (path: string) => `${config.apiBaseUrl}${path}`;

describe('request', () => {
  it('sends the stored access token', async () => {
    await storeTokens('access-1', 'refresh-1');
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await request('/v1/menu');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
  });

  it('leaves the header off an anonymous request', async () => {
    await storeTokens('access-1', 'refresh-1');
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await request('/v1/auth/sign-in', { method: 'POST', anonymous: true });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

describe('an expired access token', () => {
  it('refreshes once and replays the original request', async () => {
    await storeTokens('stale', 'refresh-1');

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh', refreshToken: 'refresh-2' }))
      .mockResolvedValueOnce(jsonResponse(200, { points: 420 }));

    await expect(request('/v1/loyalty')).resolves.toEqual({ points: 420 });

    expect(fetchMock.mock.calls.map(([target]) => target)).toEqual([
      url('/v1/loyalty'),
      url('/v1/auth/refresh'),
      url('/v1/loyalty'),
    ]);

    // The replay carries the new token, not the one that was just refused.
    const [, replay] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect((replay.headers as Record<string, string>).Authorization).toBe('Bearer fresh');
  });

  it('stores the rotated refresh token, not just the access token', async () => {
    await storeTokens('stale', 'refresh-1');

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh', refreshToken: 'refresh-2' }))
      .mockResolvedValueOnce(jsonResponse(200, {}));

    await request('/v1/loyalty');

    // A backend that rotates refresh tokens invalidates the old one. Keeping
    // it would mean the next refresh fails and the customer is signed out.
    expect(await getRefreshToken()).toBe('refresh-2');
    expect(await getAccessToken()).toBe('fresh');
  });

  /**
   * The failure mode this exists for. Open the app on a stale token and the
   * menu, the loyalty balance and the active order all 401 in the same tick.
   * Three refreshes against a backend that rotates tokens means two of them
   * present an already-spent token and the session dies.
   */
  it('refreshes once for a burst of simultaneous failures', async () => {
    await storeTokens('stale', 'refresh-1');

    fetchMock.mockImplementation(async (target: string) => {
      if (target === url('/v1/auth/refresh')) {
        return jsonResponse(200, { accessToken: 'fresh', refreshToken: 'refresh-2' });
      }
      const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer fresh' ? jsonResponse(200, {}) : jsonResponse(401);
    });

    await Promise.all([request('/v1/menu'), request('/v1/loyalty'), request('/v1/orders')]);

    const refreshCalls = fetchMock.mock.calls.filter(
      ([target]) => target === url('/v1/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it('ends the session when there is no refresh token to use', async () => {
    // An access token and nothing to renew it with. The fixture used to store
    // neither, which made this the guest case wearing an expiry's name — and
    // it passed only because the client could not tell the two apart either.
    await storeTokens('stale', '');
    const onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
    fetchMock.mockResolvedValue(jsonResponse(401));

    await expect(request('/v1/loyalty')).rejects.toMatchObject({ code: 'session_expired' });

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // never attempted a refresh
  });

  it('ends the session when the refresh itself is refused', async () => {
    await storeTokens('stale', 'expired-refresh');
    const onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);

    fetchMock.mockResolvedValueOnce(jsonResponse(401)).mockResolvedValueOnce(jsonResponse(401)); // the refresh

    await expect(request('/v1/loyalty')).rejects.toMatchObject({ code: 'session_expired' });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('clears the keychain when the session ends', async () => {
    await storeTokens('stale', 'expired-refresh');
    fetchMock.mockResolvedValue(jsonResponse(401));

    await expect(request('/v1/loyalty')).rejects.toThrow(ApiRequestError);

    // Tokens that are known dead must not sit in the keychain waiting to be
    // sent on the next launch.
    expect(await getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it('gives up rather than looping when the fresh token is refused too', async () => {
    await storeTokens('stale', 'refresh-1');

    fetchMock.mockImplementation(async (target: string) =>
      target === url('/v1/auth/refresh')
        ? jsonResponse(200, { accessToken: 'fresh', refreshToken: 'refresh-2' })
        : jsonResponse(401),
    );

    await expect(request('/v1/loyalty')).rejects.toMatchObject({ code: 'session_expired' });

    // Original, refresh, replay — and then it stops.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not refresh on an anonymous 401, which is a wrong password', async () => {
    await storeTokens('stale', 'refresh-1');
    fetchMock.mockResolvedValue(
      jsonResponse(401, { code: 'invalid_credentials', message: 'No match.' }),
    );

    await expect(
      request('/v1/auth/sign-in', { method: 'POST', anonymous: true }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores a refresh response that is missing a token', async () => {
    await storeTokens('stale', 'refresh-1');
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh' })); // no refreshToken

    await expect(request('/v1/loyalty')).rejects.toMatchObject({ code: 'session_expired' });
    // A half-written keychain is worse than an empty one.
    expect(await getAccessToken()).toBeNull();
  });

  it('leaves other error codes alone', async () => {
    await storeTokens('access-1', 'refresh-1');
    fetchMock.mockResolvedValue(jsonResponse(500, {}));

    await expect(request('/v1/menu')).rejects.toMatchObject({ code: 'http_500' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * A guest never signed in, so a 401 on their request cannot be an expiry.
 *
 * Treating it as one does real damage. The expiry handler forgets the
 * customer: it empties the basket, drops the delivery address and routes to
 * sign-in. A guest who browsed the menu, built an order and pressed pay would
 * lose the lot and be told "Your session has expired" — which they would have
 * every right to find baffling, never having had one.
 *
 * Whether a guest may order at all is a decision for the backend and the
 * business. Whichever way that goes, this is the wrong way to say no.
 */
describe('a 401 for somebody who was never signed in', () => {
  it('asks them to sign in rather than claiming their session expired', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401));

    await expect(request('/v1/orders', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'sign_in_required',
    });
  });

  it('does not tear down a session that never existed', async () => {
    const expired = jest.fn();
    setSessionExpiredHandler(expired);
    fetchMock.mockResolvedValueOnce(jsonResponse(401));

    await request('/v1/orders', { method: 'POST', body: {} }).catch(() => {});

    // The handler is what empties the basket and forgets the address.
    expect(expired).not.toHaveBeenCalled();
    setSessionExpiredHandler(null);
  });

  it('never spends a refresh attempt when there is no token to refresh', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401));

    await request('/v1/orders', { method: 'POST', body: {} }).catch(() => {});

    // One call. No trip to /v1/auth/refresh with nothing to send.
    expect(fetchMock.mock.calls.map(([target]) => target)).toEqual([url('/v1/orders')]);
  });

  /** A real expiry must still behave exactly as it did. */
  it('still ends a session that genuinely had a token', async () => {
    await storeTokens('stale', 'refresh-1');
    const expired = jest.fn();
    setSessionExpiredHandler(expired);

    fetchMock.mockResolvedValueOnce(jsonResponse(401)).mockResolvedValueOnce(jsonResponse(401));

    await expect(request('/v1/loyalty')).rejects.toMatchObject({ code: 'session_expired' });
    expect(expired).toHaveBeenCalled();
    setSessionExpiredHandler(null);
  });
});
