import {
  PENDING_TTL_MS,
  assertDiscovery,
  buildAuthorizeUrl,
  bytesToBase64Url,
  discoveryUrl,
  readRedirect,
  type PendingSignIn,
} from '@core/auth/oidc';
import type { ActionArgs, ActionName } from './actions';
import type { ConsoleData } from './seed';
import type { Operator } from './types';

/**
 * The console in live mode: staff sign in with NMU SSO (authorization code +
 * PKCE, the same flow as the app) and every read and change goes through
 * the BFF, which decides what the signed-in operator may do. Nothing is kept
 * in the browser except the session, for the life of the tab.
 */

export const liveConfig = {
  enabled: process.env.NEXT_PUBLIC_CONSOLE_MODE === 'live',
  bff: (process.env.NEXT_PUBLIC_BFF_BASE_URL ?? '').replace(/\/+$/, ''),
  issuer: process.env.NEXT_PUBLIC_OIDC_ISSUER ?? '',
  clientId: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || 'nmu-one-console',
};

export interface ConsoleSession {
  accessToken: string;
  expiresAt: string;
  operator: Pick<Operator, 'id' | 'name' | 'title'>;
}

const SESSION_KEY = 'nmu-one-console.session.v1';
const PENDING_KEY = 'nmu-one-console.sso.v1';

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readSession(): ConsoleSession | null {
  try {
    const raw = storage()?.getItem(SESSION_KEY);
    const s = raw ? (JSON.parse(raw) as ConsoleSession) : null;
    return s && new Date(s.expiresAt) > new Date() ? s : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  storage()?.removeItem(SESSION_KEY);
}

export class SignedOut extends Error {
  constructor() {
    super('Signed out');
    this.name = 'SignedOut';
  }
}

const redirectUri = () => `${window.location.origin}/auth/callback/`;

/** Sends the tab to NMU SSO; the sign-in finishes on /auth/callback/. */
export async function startSignIn(): Promise<void> {
  const res = await fetch(discoveryUrl(liveConfig.issuer), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('NMU SSO isn’t answering. Try again in a moment.');
  const discovery = assertDiscovery(await res.json(), liveConfig.issuer);
  const random = (n: number) => bytesToBase64Url(crypto.getRandomValues(new Uint8Array(n)));
  const pending: PendingSignIn = {
    state: random(16),
    codeVerifier: random(32),
    redirectUri: redirectUri(),
    startedAt: Date.now(),
  };
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(pending.codeVerifier),
  );
  storage()?.setItem(PENDING_KEY, JSON.stringify(pending));
  window.location.assign(
    buildAuthorizeUrl(discovery.authorization_endpoint, {
      clientId: liveConfig.clientId,
      redirectUri: pending.redirectUri,
      codeChallenge: bytesToBase64Url(new Uint8Array(digest)),
      state: pending.state,
      scope: 'openid profile email',
    }),
  );
}

/** Exchanges the code NMU SSO returned for a console session, once. */
export async function finishSignIn(href: string): Promise<ConsoleSession> {
  const raw = storage()?.getItem(PENDING_KEY);
  storage()?.removeItem(PENDING_KEY);
  const pending = raw ? (JSON.parse(raw) as PendingSignIn) : null;
  if (!pending || Date.now() - pending.startedAt > PENDING_TTL_MS) {
    throw new Error('This sign-in has expired. Start again.');
  }
  const outcome = readRedirect(href, pending.state);
  if (outcome.kind !== 'code') throw new Error('NMU SSO didn’t complete the sign-in.');
  const res = await fetch(`${liveConfig.bff}/v1/console/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: outcome.code,
      codeVerifier: pending.codeVerifier,
      redirectUri: pending.redirectUri,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    session?: { accessToken: string; expiresAt: string };
    operator?: Operator;
    message?: string;
  };
  if (!res.ok || !body.session || !body.operator) {
    throw new Error(body.message ?? 'That account can’t use the console.');
  }
  const session: ConsoleSession = {
    accessToken: body.session.accessToken,
    expiresAt: body.session.expiresAt,
    operator: { id: body.operator.id, name: body.operator.name, title: body.operator.title },
  };
  storage()?.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function call(path: string, init: RequestInit = {}) {
  const session = readSession();
  if (!session) throw new SignedOut();
  const res = await fetch(`${liveConfig.bff}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${session.accessToken}`,
    },
  });
  if (res.status === 401) {
    clearSession();
    throw new SignedOut();
  }
  return res;
}

export async function signOut() {
  try {
    await call('/v1/auth/sign-out', { method: 'POST', body: '{}' });
  } catch {
    // Signing out locally never depends on the network.
  }
  clearSession();
}

export async function fetchState(): Promise<ConsoleData> {
  const res = await call('/v1/console/state');
  if (!res.ok) throw new Error('The console service isn’t answering.');
  return (await res.json()) as ConsoleData;
}

export async function postAction<K extends ActionName>(
  name: K,
  args: ActionArgs[K],
): Promise<
  { ok: true; message: string; id?: string; data: ConsoleData } | { ok: false; message: string }
> {
  const res = await call(`/v1/console/actions/${name}`, {
    method: 'POST',
    body: JSON.stringify(args),
  });
  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    id?: string;
    data?: ConsoleData;
  };
  if (res.ok && body.data) {
    return {
      ok: true,
      message: body.message ?? 'Saved.',
      ...(body.id ? { id: body.id } : {}),
      data: body.data,
    };
  }
  return { ok: false, message: body.message ?? 'That didn’t save. Try again.' };
}
