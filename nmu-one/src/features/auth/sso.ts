import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  PENDING_TTL_MS,
  assertDiscovery,
  base64ToBase64Url,
  buildAuthorizeUrl,
  bytesToBase64Url,
  discoveryUrl,
  readRedirect,
  type PendingSignIn,
} from '@/core/auth/oidc';
import { config } from '@/core/config';

/**
 * Sign-in with NMU SSO (brief §15): OIDC authorization code + PKCE.
 *
 * - iOS and Android open the system's authentication session (shared
 *   cookies, so someone already signed in to NMU in their browser isn't asked
 *   again), and the redirect comes straight back to the waiting promise.
 * - The web build hands the whole tab to NMU SSO and finishes on
 *   /auth/callback. Mobile browsers block pop-ups that open after any
 *   waiting, so a redirect is the dependable choice there.
 *
 * Either way the app ends up holding a one-time code and the verifier only it
 * knows, which the BFF exchanges for an NMU ONE session.
 */

export interface CodeExchange {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

/** The person closed the sign-in window or declined: not an error to report. */
export class SignInCancelled extends Error {
  constructor() {
    super('Sign-in was cancelled');
    this.name = 'SignInCancelled';
  }
}

const PENDING_KEY = 'nmu-one.sso.pending.v1';

/** Live builds sign in through NMU SSO once its issuer and client are configured. */
export function ssoEnabled(): boolean {
  return config.dataMode === 'live' && !!config.oidc.issuer && !!config.oidc.clientId;
}

export const redirectUri = () => Linking.createURL('/auth/callback');

async function prepare(): Promise<{ url: string; pending: PendingSignIn }> {
  const issuer = config.oidc.issuer;
  const clientId = config.oidc.clientId;
  if (!issuer || !clientId) throw new Error('NMU SSO is not configured');

  const res = await fetch(discoveryUrl(issuer), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`NMU SSO discovery failed (${res.status})`);
  const discovery = assertDiscovery(await res.json(), issuer);

  const codeVerifier = bytesToBase64Url(Crypto.getRandomBytes(32));
  const state = bytesToBase64Url(Crypto.getRandomBytes(16));
  const codeChallenge = base64ToBase64Url(
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    }),
  );
  const pending: PendingSignIn = {
    state,
    codeVerifier,
    redirectUri: redirectUri(),
    startedAt: Date.now(),
  };
  const url = buildAuthorizeUrl(discovery.authorization_endpoint, {
    clientId,
    redirectUri: pending.redirectUri,
    codeChallenge,
    state,
  });
  return { url, pending };
}

function toExchange(url: string, pending: PendingSignIn): CodeExchange {
  const outcome = readRedirect(url, pending.state);
  if (outcome.kind === 'denied') {
    if (outcome.error === 'access_denied') throw new SignInCancelled();
    throw new Error(`NMU SSO declined the sign-in (${outcome.error})`);
  }
  if (outcome.kind === 'invalid') {
    throw new Error(
      outcome.reason === 'state'
        ? 'This sign-in response was not for this app'
        : 'NMU SSO did not return a sign-in code',
    );
  }
  return {
    code: outcome.code,
    codeVerifier: pending.codeVerifier,
    redirectUri: pending.redirectUri,
  };
}

/**
 * Starts sign-in. On iOS and Android this resolves with the code to exchange;
 * on the web the tab leaves for NMU SSO and this resolves with 'redirecting'.
 */
export async function startSignIn(): Promise<CodeExchange | 'redirecting'> {
  const { url, pending } = await prepare();

  if (Platform.OS === 'web') {
    try {
      globalThis.sessionStorage?.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch {
      throw new Error('This browser is blocking the storage sign-in needs');
    }
    globalThis.location.assign(url);
    return 'redirecting';
  }

  const result = await WebBrowser.openAuthSessionAsync(url, pending.redirectUri);
  if (result.type !== 'success') throw new SignInCancelled();
  return toExchange(result.url, pending);
}

/**
 * Web only: finishes a sign-in on /auth/callback. The pending request is read
 * once and removed, so a reload or a shared link can't replay it.
 */
export function finishWebSignIn(href: string): CodeExchange {
  let pending: PendingSignIn | null = null;
  try {
    const raw = globalThis.sessionStorage?.getItem(PENDING_KEY);
    globalThis.sessionStorage?.removeItem(PENDING_KEY);
    pending = raw ? (JSON.parse(raw) as PendingSignIn) : null;
  } catch {
    pending = null;
  }
  if (!pending || Date.now() - pending.startedAt > PENDING_TTL_MS) {
    throw new Error('This sign-in has expired. Start again from the sign-in screen.');
  }
  return toExchange(href, pending);
}
