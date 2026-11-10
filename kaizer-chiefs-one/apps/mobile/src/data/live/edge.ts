import { z } from 'zod';
import {
  provenanceSchema,
  UNAVAILABLE_REASONS,
  unavailable,
  type ProviderResult,
} from '@kc-one/contracts';
import { backend } from '@/config/env';

/**
 * Client for the backend's provider functions (supabase/functions/*). The
 * functions hold every provider credential; this app only ever sends the
 * public anon key and, when signed in, the supporter's own access token.
 *
 * Every response is validated against the shared contract before a screen
 * sees it, so a malformed or unexpected payload becomes an honest error
 * instead of a half-rendered screen.
 */
const envelope = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), data: z.unknown(), provenance: provenanceSchema }),
  z.object({
    status: z.literal('unavailable'),
    reason: z.enum(UNAVAILABLE_REASONS),
    message: z.string(),
  }),
]);

let accessTokenProvider: () => string | null = () => null;

/** Wired by the live auth adapter once an identity provider is approved. */
export function setAccessTokenProvider(fn: () => string | null) {
  accessTokenProvider = fn;
}

export async function callFunction<T>(
  fn: string,
  path: string,
  schema: z.ZodType<T>,
  init: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: unknown;
    idempotencyKey?: string;
    timeoutMs?: number;
  } = {},
): Promise<ProviderResult<T>> {
  if (!backend.supabaseUrl || !backend.anonKey) {
    return unavailable('not_configured', 'This build has no backend address configured.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 12_000);
  const token = accessTokenProvider();
  try {
    const res = await fetch(`${backend.supabaseUrl}/functions/v1/${fn}${path}`, {
      method: init.method ?? 'GET',
      signal: controller.signal,
      headers: {
        apikey: backend.anonKey,
        Authorization: `Bearer ${token ?? backend.anonKey}`,
        'Content-Type': 'application/json',
        ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : null),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (res.status === 401) return unavailable('not_authenticated', 'Sign in to continue.');
    const json: unknown = await res.json().catch(() => null);
    const parsed = envelope.safeParse(json);
    if (!parsed.success)
      return unavailable('error', 'The service sent a response this app does not understand.');
    if (parsed.data.status === 'unavailable') return parsed.data;
    const data = schema.safeParse(parsed.data.data);
    if (!data.success) return unavailable('error', 'The service sent data that failed validation.');
    return { status: 'ok', data: data.data, provenance: parsed.data.provenance };
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return unavailable(
      aborted ? 'error' : 'offline',
      aborted ? 'The service took too long to answer.' : 'Check your connection and try again.',
    );
  } finally {
    clearTimeout(timer);
  }
}
