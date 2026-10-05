/**
 * OIDC authorization code + PKCE (RFC 7636), the parts that are plain data:
 * building the authorization request and reading what comes back. Hashing,
 * random bytes and opening the browser are the platform's job
 * (src/features/auth/sso.ts), so everything here runs anywhere, tests
 * included.
 *
 * The app is a public client: it never holds a client secret. The code it
 * receives is useless without the verifier it kept, and the BFF exchanges
 * the pair with NMU SSO server-side (docs/INTEGRATIONS.md §Sign-in).
 */

export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  code_challenge_methods_supported?: string[];
}

export interface AuthorizeRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scope?: string;
}

/** A sign-in the app has started and must finish with the same verifier. */
export interface PendingSignIn {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  startedAt: number;
}

export type RedirectOutcome =
  | { kind: 'code'; code: string }
  | { kind: 'denied'; error: string }
  | { kind: 'invalid'; reason: 'state' | 'missing-code' };

/** A pending sign-in is abandoned after ten minutes, like the codes it waits for. */
export const PENDING_TTL_MS = 10 * 60_000;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 → base64url without padding (RFC 4648 §5). */
export function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Bytes → base64url without padding; no Buffer or btoa needed. */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) out += B64[c & 63];
  }
  return base64ToBase64Url(out);
}

export function discoveryUrl(issuer: string): string {
  return `${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`;
}

/** Checks a discovery document is usable for this flow before trusting it. */
export function assertDiscovery(doc: unknown, issuer: string): OidcDiscovery {
  const d = doc as Partial<OidcDiscovery> | null;
  if (!d || typeof d.authorization_endpoint !== 'string') {
    throw new Error('The sign-in service did not describe itself');
  }
  if (typeof d.issuer === 'string' && d.issuer.replace(/\/+$/, '') !== issuer.replace(/\/+$/, '')) {
    throw new Error('The sign-in service is not the one this app trusts');
  }
  const methods = d.code_challenge_methods_supported;
  if (methods && !methods.includes('S256')) {
    throw new Error('The sign-in service does not support PKCE');
  }
  return d as OidcDiscovery;
}

export function buildAuthorizeUrl(endpoint: string, req: AuthorizeRequest): string {
  const url = new URL(endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', req.clientId);
  url.searchParams.set('redirect_uri', req.redirectUri);
  url.searchParams.set('scope', req.scope ?? 'openid profile email');
  url.searchParams.set('state', req.state);
  url.searchParams.set('code_challenge', req.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

/** Query parameters from any URL, including custom schemes (nmuone://…). */
function queryOf(url: string): URLSearchParams {
  const q = url.indexOf('?');
  if (q < 0) return new URLSearchParams();
  const hash = url.indexOf('#', q);
  return new URLSearchParams(url.slice(q + 1, hash < 0 ? undefined : hash));
}

/**
 * Reads the redirect back from the identity provider. The state must be the
 * one this app sent, or the response belongs to someone else's sign-in.
 */
export function readRedirect(url: string, expectedState: string): RedirectOutcome {
  const q = queryOf(url);
  if (q.get('state') !== expectedState) return { kind: 'invalid', reason: 'state' };
  const error = q.get('error');
  if (error) return { kind: 'denied', error };
  const code = q.get('code');
  return code ? { kind: 'code', code } : { kind: 'invalid', reason: 'missing-code' };
}

/** The payment provider's return: approved only if it says so for this payment. */
export function readPaymentReturn(url: string, paymentId: string): 'approved' | 'cancelled' {
  const q = queryOf(url);
  return q.get('paymentId') === paymentId && q.get('status') === 'approved'
    ? 'approved'
    : 'cancelled';
}

/** Whether a deep link is one of the browser hand-offs the app finishes itself. */
export function isHandoffReturn(pathOrUrl: string): boolean {
  return /(^|[/:])(auth\/callback|payments\/return)(\?|#|$)/.test(pathOrUrl);
}
