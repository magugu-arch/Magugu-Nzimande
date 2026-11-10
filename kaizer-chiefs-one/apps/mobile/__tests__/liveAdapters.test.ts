/**
 * The live client must turn every non-contract response into an honest
 * unavailable result, and must never call out without configuration.
 */
import { z } from 'zod';

const base = 'https://example.supabase.co';

function load(env: Record<string, string | undefined>) {
  jest.resetModules();
  const prev = { ...process.env };
  // Assigning undefined to process.env stores the string "undefined".
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/data/live/edge') as typeof import('@/data/live/edge');
  process.env = prev;
  return mod;
}

const ok = (data: unknown) => ({
  status: 'ok',
  data,
  provenance: {
    source: 'match-feed',
    providerRef: null,
    fetchedAt: '2026-11-10T10:00:00Z',
    updatedAt: null,
    state: 'live',
  },
});

describe('edge function client', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as { fetch: unknown }).fetch = fetchMock;
  });

  it('refuses without a backend address and makes no request', async () => {
    const { callFunction } = load({
      EXPO_PUBLIC_SUPABASE_URL: undefined,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined,
    });
    const r = await callFunction('match-data', '/x', z.string());
    expect(r).toMatchObject({ status: 'unavailable', reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates data against the contract', async () => {
    const { callFunction } = load({
      EXPO_PUBLIC_SUPABASE_URL: base,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    });
    fetchMock.mockResolvedValueOnce({ status: 200, json: async () => ok(42) });
    expect(await callFunction('f', '/x', z.string())).toMatchObject({
      status: 'unavailable',
      reason: 'error',
    });
    fetchMock.mockResolvedValueOnce({ status: 200, json: async () => ok('hello') });
    expect(await callFunction('f', '/x', z.string())).toMatchObject({
      status: 'ok',
      data: 'hello',
    });
  });

  it('passes the idempotency key and maps auth and network failures', async () => {
    const { callFunction } = load({
      EXPO_PUBLIC_SUPABASE_URL: base,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    });
    fetchMock.mockResolvedValueOnce({ status: 401, json: async () => ({}) });
    const r = await callFunction('rewards', '/me/redemptions', z.unknown(), {
      method: 'POST',
      idempotencyKey: 'k-1',
    });
    expect(r).toMatchObject({ reason: 'not_authenticated' });
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe('k-1');
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    expect(await callFunction('f', '/x', z.unknown())).toMatchObject({ reason: 'offline' });
  });

  it('passes provider unavailable answers through unchanged', async () => {
    const { callFunction } = load({
      EXPO_PUBLIC_SUPABASE_URL: base,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    });
    fetchMock.mockResolvedValueOnce({
      status: 503,
      json: async () => ({
        status: 'unavailable',
        reason: 'integration_pending',
        message: 'Feed not connected',
      }),
    });
    expect(await callFunction('f', '/x', z.unknown())).toEqual({
      status: 'unavailable',
      reason: 'integration_pending',
      message: 'Feed not connected',
    });
  });
});
