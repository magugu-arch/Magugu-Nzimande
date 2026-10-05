import { createHash, randomBytes } from 'node:crypto';
import type { AuthSession, PersonaId } from '../../src/core/adapters/contracts';
import { OPERATORS } from '../../admin/src/lib/seed';
import { personas } from '../../src/core/fixtures/people';
import { HttpError } from './http';

/**
 * Sessions and sign-in.
 *
 * NMU ONE sessions are opaque bearer tokens issued here, never NMU SSO's own
 * tokens: the app holds a token that only this BFF understands, and the BFF
 * keeps whatever it needs to call NMU systems on the person's behalf.
 *
 * Sign-in is OIDC authorization code + PKCE. In production the code comes
 * from NMU SSO and is exchanged with NMU SSO's token endpoint here, as a
 * confidential client. For development this file also contains a stand-in
 * identity provider (/dev-sso/*) whose sign-in page offers the four demo
 * personas, so the whole flow can run end to end on a laptop.
 *
 * Two clients sign in here: the app (people: students, staff, parents,
 * alumni) and the operator console (staff operators). Each session records
 * which kind it is, so a console session can't read a student's data and an
 * app session can't run the console.
 */

const SESSION_MINUTES = Number(process.env.BFF_SESSION_MINUTES ?? 8 * 60);

export type SessionKind = 'person' | 'operator';

interface Session {
  userId: string;
  kind: SessionKind;
  refreshToken: string;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const refreshTokens = new Map<string, string>(); // refresh → access

const token = () => randomBytes(32).toString('base64url');

export function issueSession(userId: string, kind: SessionKind = 'person'): AuthSession {
  const accessToken = token();
  const refreshToken = token();
  const expiresAt = Date.now() + SESSION_MINUTES * 60_000;
  sessions.set(accessToken, { userId, kind, refreshToken, expiresAt });
  refreshTokens.set(refreshToken, accessToken);
  return { accessToken, refreshToken, expiresAt: new Date(expiresAt).toISOString(), userId };
}

export function sessionFor(
  authorization: string | undefined,
  kind: SessionKind = 'person',
): Session {
  const bearer = authorization?.match(/^Bearer (.+)$/)?.[1];
  const session = bearer ? sessions.get(bearer) : undefined;
  if (!session || session.expiresAt <= Date.now()) {
    if (bearer) sessions.delete(bearer);
    throw new HttpError(401, 'unauthorised', 'Sign in again');
  }
  if (session.kind !== kind) {
    throw new HttpError(
      403,
      'forbidden',
      kind === 'operator' ? 'Sign in to the console with a staff account' : 'Not an app session',
    );
  }
  return session;
}

export function refresh(refreshToken: unknown): AuthSession {
  const access = typeof refreshToken === 'string' ? refreshTokens.get(refreshToken) : undefined;
  const old = access ? sessions.get(access) : undefined;
  if (!access || !old) throw new HttpError(401, 'unauthorised', 'Sign in again');
  sessions.delete(access);
  refreshTokens.delete(refreshToken as string);
  return issueSession(old.userId, old.kind);
}

export function revoke(authorization: string | undefined): void {
  const bearer = authorization?.match(/^Bearer (.+)$/)?.[1];
  const session = bearer ? sessions.get(bearer) : undefined;
  if (bearer && session) {
    sessions.delete(bearer);
    refreshTokens.delete(session.refreshToken);
  }
}

// ── Development identity provider ───────────────────────────────────────────

export type SignInClient = 'app' | 'console';
const CONSOLE_CLIENT = 'nmu-one-console';

interface PendingCode {
  client: SignInClient;
  /** A demo persona (app) or an operator id (console). */
  subject: string;
  challenge: string;
  redirectUri: string;
  expiresAt: number;
}

const codes = new Map<string, PendingCode>();
export const PERSONAS = Object.keys(personas) as PersonaId[];

export function discovery(base: string) {
  return {
    issuer: base,
    authorization_endpoint: `${base}/dev-sso/authorize`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
  };
}

const clientOf = (query: URLSearchParams): SignInClient =>
  query.get('client_id') === CONSOLE_CLIENT ? 'console' : 'app';

export function approve(query: URLSearchParams): string {
  const client = clientOf(query);
  const subject = query.get('persona');
  const redirectUri = query.get('redirect_uri');
  const challenge = query.get('code_challenge');
  const known =
    client === 'console'
      ? OPERATORS.some((o) => o.id === subject)
      : PERSONAS.includes(subject as PersonaId);
  if (!subject || !known || !redirectUri || !challenge) {
    throw new HttpError(400, 'invalid', 'Incomplete authorization request');
  }
  if (query.get('code_challenge_method') !== 'S256') {
    throw new HttpError(400, 'invalid', 'PKCE with S256 is required');
  }
  const code = token();
  codes.set(code, { client, subject, challenge, redirectUri, expiresAt: Date.now() + 60_000 });
  const url = new URL(redirectUri);
  url.searchParams.set('code', code);
  const state = query.get('state');
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

/**
 * The code exchange: single use, short-lived, bound to the PKCE verifier,
 * the redirect and the client that asked for it.
 */
export function exchange(
  body: { code?: unknown; codeVerifier?: unknown; redirectUri?: unknown },
  client: SignInClient,
): string {
  const pending = typeof body.code === 'string' ? codes.get(body.code) : undefined;
  if (typeof body.code === 'string') codes.delete(body.code);
  if (!pending || pending.expiresAt <= Date.now()) {
    throw new HttpError(401, 'unauthorised', 'Sign-in code is invalid or expired');
  }
  const verifier = typeof body.codeVerifier === 'string' ? body.codeVerifier : '';
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  if (
    challenge !== pending.challenge ||
    body.redirectUri !== pending.redirectUri ||
    client !== pending.client
  ) {
    throw new HttpError(401, 'unauthorised', 'Sign-in code does not match this app');
  }
  return pending.subject;
}

export function authorizePage(query: URLSearchParams): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const params = new URLSearchParams(query);
  const forConsole = clientOf(query) === 'console';
  const people: [string, string][] = forConsole
    ? OPERATORS.map((o) => [o.id, `${o.name} · ${o.title}`])
    : [
        ['student', 'Thandi Mokoena · student'],
        ['staff', 'Dr Sipho Ndlovu · staff'],
        ['parent', 'Nomsa Mokoena · parent'],
        ['alumni', 'Lwazi Dube · alumni'],
      ];
  const links = people
    .map(([id, label]) => {
      params.set('persona', id);
      return `<a class="who" href="/dev-sso/approve?${esc(params.toString())}" data-persona="${id}">${esc(label)}</a>`;
    })
    .join('');
  return `<!doctype html><html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">
<title>Development sign-in</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#141C2B;color:#fff;font:16px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}
  main{width:min(420px,calc(100vw - 32px));display:grid;gap:12px}
  h1{margin:0;font-size:24px} p{margin:0;color:#C3CCDA}
  .who{display:block;padding:14px 16px;border-radius:12px;background:#FFFFFF;color:#141C2B;text-decoration:none;font-weight:700}
  .who:focus-visible{outline:3px solid #FFCC00;outline-offset:2px}
  small{color:#C3CCDA}
</style></head><body><main>
<h1>Development sign-in</h1>
<p>This page stands in for NMU SSO on a development BFF. Choose who to sign in as${forConsole ? ' to the operator console' : ''}.</p>
${links}
<small>Synthetic identities only. Production uses NMU SSO.</small>
</main></body></html>`;
}

// ── Development payment provider ────────────────────────────────────────────

const paymentReturns = new Map<string, { returnUrl: string; approved: boolean }>();

const PURPOSE_WORDS: Record<string, string> = {
  fees: 'Student fees',
  order: 'A campus food order',
  ticket: 'An event ticket',
  donation: 'A gift to the NMU bursary fund',
};

export function holdPayment(paymentId: string, returnUrl: string): void {
  paymentReturns.set(paymentId, { returnUrl, approved: false });
}

export function paymentApproved(paymentId: string): boolean {
  const held = paymentReturns.get(paymentId);
  return !held || held.approved;
}

export function decidePayment(paymentId: string, approved: boolean): string {
  const held = paymentReturns.get(paymentId);
  if (!held) throw new HttpError(404, 'not-found', 'Unknown payment');
  held.approved = approved;
  const url = new URL(held.returnUrl);
  url.searchParams.set('paymentId', paymentId);
  url.searchParams.set('status', approved ? 'approved' : 'cancelled');
  return url.toString();
}

export function paymentPage(paymentId: string, amount: string, purpose: string): string {
  return `<!doctype html><html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">
<title>Development payment</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F3F3EE;color:#141C2B;font:16px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}
  main{width:min(420px,calc(100vw - 32px));display:grid;gap:12px;padding:24px;border-radius:16px;background:#fff}
  h1{margin:0;font-size:22px} p{margin:0} .amount{font-size:34px;font-weight:800}
  a{display:block;padding:14px;border-radius:999px;text-align:center;font-weight:800;text-decoration:none}
  .pay{background:#141C2B;color:#fff} .cancel{border:2px solid #141C2B;color:#141C2B}
  small{color:#545B6B}
</style></head><body><main>
<h1>Development payment page</h1>
<span class="amount">${amount}</span><p>${PURPOSE_WORDS[purpose] ?? 'A payment to the university'}.</p><p>This page stands in for the university's approved payment provider.</p>
<a class="pay" href="/dev-pay/${paymentId}/approve" data-action="approve">Pay ${amount}</a>
<a class="cancel" href="/dev-pay/${paymentId}/cancel" data-action="cancel">Cancel</a>
<small>No real money moves. Card details are never seen by NMU ONE.</small>
</main></body></html>`;
}
