// Shared helpers for provider functions (Deno, Supabase Edge Runtime).
//
// Every response uses the envelope the app validates:
//   { status: 'ok', data, provenance } | { status: 'unavailable', reason, message }
// Provider credentials are read from function secrets and never returned,
// logged or forwarded to the client.

export type UnavailableReason =
  | 'integration_pending'
  | 'not_configured'
  | 'offline'
  | 'error'
  | 'not_authenticated'
  | 'not_eligible'
  | 'demo_restricted';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

export function ok(data: unknown, source: string, updatedAt: string | null = null): Response {
  const provenance = {
    source,
    providerRef: null,
    fetchedAt: new Date().toISOString(),
    updatedAt,
    state: 'live',
  };
  return new Response(JSON.stringify({ status: 'ok', data, provenance }), {
    status: 200,
    headers: JSON_HEADERS,
  });
}

export function unavailable(reason: UnavailableReason, message: string, status = 503): Response {
  return new Response(JSON.stringify({ status: 'unavailable', reason, message }), {
    status,
    headers: JSON_HEADERS,
  });
}

/**
 * Read required secrets. A missing one is reported by name (never value) and
 * the caller answers integration_pending instead of guessing.
 */
export function requireSecrets<K extends string>(
  names: readonly K[],
): { ok: true; values: Record<K, string> } | { ok: false; missing: K[] } {
  const values = {} as Record<K, string>;
  const missing: K[] = [];
  for (const name of names) {
    const v = Deno.env.get(name);
    if (v && v.trim()) values[name] = v;
    else missing.push(name);
  }
  return missing.length ? { ok: false, missing } : { ok: true, values };
}

/** Log without tokens, keys or personal data. */
export function logEvent(
  event: string,
  detail: Record<string, string | number | boolean | null> = {},
) {
  console.log(JSON.stringify({ event, ...detail, at: new Date().toISOString() }));
}
