import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The rule from the brief: a success message only when delivery succeeded.
 * SITE_MODE is read when the module loads, so each case loads it fresh.
 */
async function loadDelivery(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import('@/lib/delivery');
}

const keys = [
  'NEXT_PUBLIC_SITE_MODE',
  'ENQUIRY_WEBHOOK_URL',
  'CONTACT_WEBHOOK_URL',
  'NEWSLETTER_WEBHOOK_URL',
  'WEBHOOK_SIGNING_SECRET',
];
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const meta = { sourcePage: '/speaking' };

describe('deliver', () => {
  it('in preview with no webhook, logs field names only and says so', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { deliver } = await loadDelivery({
      NEXT_PUBLIC_SITE_MODE: undefined,
      ENQUIRY_WEBHOOK_URL: undefined,
    });
    const result = await deliver(
      'speaking',
      { email: 'private@example.com', name: 'Private Person' },
      meta,
    );
    expect(result).toEqual({ ok: true, channel: 'preview-log' });
    const logged = info.mock.calls.flat().join(' ');
    expect(logged).toContain('email, name');
    expect(logged).not.toContain('private@example.com');
    expect(logged).not.toContain('Private Person');
  });

  it('in production with no webhook, refuses rather than pretending', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { deliver } = await loadDelivery({
      NEXT_PUBLIC_SITE_MODE: 'production',
      ENQUIRY_WEBHOOK_URL: undefined,
    });
    expect(await deliver('speaking', { a: 1 }, meta)).toEqual({
      ok: false,
      reason: 'not-configured',
    });
  });

  it('reports failure when the webhook answers with an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    const { deliver } = await loadDelivery({ ENQUIRY_WEBHOOK_URL: 'https://hooks.example.com/x' });
    expect(await deliver('speaking', { a: 1 }, meta)).toEqual({ ok: false, reason: 'failed' });
  });

  it('signs the body when a secret is set, and succeeds on 2xx', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response('', { status: 202 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { deliver, sign } = await loadDelivery({
      NEWSLETTER_WEBHOOK_URL: 'https://hooks.example.com/n',
      WEBHOOK_SIGNING_SECRET: 's3cret',
    });
    expect(await deliver('newsletter', { email: 'a@example.com' }, meta)).toEqual({
      ok: true,
      channel: 'webhook',
    });
    const init = fetchMock.mock.calls[0]![1];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-signature-sha256']).toBe(sign(init.body as string, 's3cret'));
  });

  it('sends contact messages to the enquiry webhook when no contact one is set', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response('', { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { deliver } = await loadDelivery({
      CONTACT_WEBHOOK_URL: undefined,
      ENQUIRY_WEBHOOK_URL: 'https://hooks.example.com/e',
    });
    await deliver('contact', { a: 1 }, meta);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://hooks.example.com/e');
  });
});
