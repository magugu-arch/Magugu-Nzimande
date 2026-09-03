/**
 * Uber's OAuth, and the token cache.
 *
 * Client-credentials: no user is involved, the application authenticates as
 * itself. The token lasts about a month, so fetching one per delivery would be
 * a needless round trip on every order — and rate limits are per client, so it
 * is not free either.
 *
 * Cached in memory rather than in the shared state file, deliberately. A token
 * is not state the workers have to agree about: each one fetching its own is
 * correct, costs a request per worker per month, and keeps a bearer token that
 * grants dispatch out of a JSON file on disk.
 */

const TOKEN_URL = 'https://auth.uber.com/oauth/v2/token';

/** The scope Uber Direct's delivery endpoints require. */
export const DELIVERY_SCOPE = 'eats.deliveries';

/**
 * Renewed this long before it actually expires.
 *
 * A token that is valid when checked and expired when the request lands is a
 * failed dispatch, and the window is exactly as wide as the network is slow.
 */
const EARLY_RENEWAL_MS = 5 * 60 * 1_000;

export type Credentials = { clientId: string; clientSecret: string };

type Cached = { token: string; expiresAt: number };

const cache = new Map<string, Cached>();

/** Test seam, and a way to drop a token that has been revoked. */
export function forgetTokens(): void {
  cache.clear();
}

export async function accessToken(
  credentials: Credentials,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<string | null> {
  // Keyed on the client id so two configurations in one process cannot hand
  // each other's token out.
  const held = cache.get(credentials.clientId);
  if (held && held.expiresAt - EARLY_RENEWAL_MS > now) return held.token;

  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    grant_type: 'client_credentials',
    scope: DELIVERY_SCOPE,
  });

  try {
    const response = await fetcher(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) return null;

    const parsed = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof parsed.access_token !== 'string' || parsed.access_token.length === 0) return null;

    // A missing or nonsensical expiry is treated as a short one rather than as
    // for ever: the cost of re-fetching is a request, and the cost of holding a
    // dead token is every dispatch until somebody restarts the process.
    const seconds = typeof parsed.expires_in === 'number' && parsed.expires_in > 0
      ? parsed.expires_in
      : 300;

    cache.set(credentials.clientId, { token: parsed.access_token, expiresAt: now + seconds * 1_000 });
    return parsed.access_token;
  } catch {
    return null;
  }
}
