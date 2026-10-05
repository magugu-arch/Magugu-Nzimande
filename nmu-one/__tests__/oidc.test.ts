/**
 * @jest-environment node
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  assertDiscovery,
  base64ToBase64Url,
  buildAuthorizeUrl,
  bytesToBase64Url,
  discoveryUrl,
  isHandoffReturn,
  readPaymentReturn,
  readRedirect,
} from '@/core/auth/oidc';
import { approve, exchange } from '../bff/src/auth';

describe('PKCE encoding (RFC 7636)', () => {
  it('turns the SHA-256 digest into the S256 challenge the server expects', () => {
    // The app gets a padded base64 digest from expo-crypto; the BFF compares
    // against Node's own base64url. Both must agree for every verifier.
    for (let i = 0; i < 50; i++) {
      const verifier = bytesToBase64Url(new Uint8Array(randomBytes(32)));
      const digest = createHash('sha256').update(verifier);
      const [b64, b64url] = [digest.copy().digest('base64'), digest.digest('base64url')];
      expect(base64ToBase64Url(b64)).toBe(b64url);
    }
  });

  it('encodes random bytes exactly as base64url, at every length', () => {
    for (let n = 0; n < 40; n++) {
      const bytes = new Uint8Array(randomBytes(n));
      expect(bytesToBase64Url(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
    }
  });

  it('gives a 43-character verifier from 32 random bytes', () => {
    expect(bytesToBase64Url(new Uint8Array(randomBytes(32)))).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('discovery', () => {
  it('finds the well-known document whatever the trailing slash', () => {
    expect(discoveryUrl('https://sso.example/')).toBe(
      'https://sso.example/.well-known/openid-configuration',
    );
  });

  it('refuses a document from another issuer or without PKCE', () => {
    const ok = { issuer: 'https://sso.example', authorization_endpoint: 'https://sso.example/a' };
    expect(assertDiscovery(ok, 'https://sso.example/')).toBe(ok);
    expect(() => assertDiscovery({ ...ok, issuer: 'https://evil.example' }, ok.issuer)).toThrow(
      /not the one/,
    );
    expect(() =>
      assertDiscovery({ ...ok, code_challenge_methods_supported: ['plain'] }, ok.issuer),
    ).toThrow(/PKCE/);
    expect(() => assertDiscovery({}, ok.issuer)).toThrow();
  });
});

describe('the authorization request and its redirect', () => {
  const req = {
    clientId: 'nmu-one',
    redirectUri: 'nmuone://auth/callback',
    codeChallenge: 'challenge',
    state: 'state-123',
  };

  it('asks for a code with S256 PKCE and the state', () => {
    const url = new URL(buildAuthorizeUrl('https://sso.example/authorize?tenant=nmu', req));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      tenant: 'nmu',
      response_type: 'code',
      client_id: 'nmu-one',
      redirect_uri: 'nmuone://auth/callback',
      scope: 'openid profile email',
      state: 'state-123',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
    });
  });

  it('accepts a code only with the state this app sent', () => {
    expect(readRedirect('nmuone://auth/callback?code=abc&state=state-123', 'state-123')).toEqual({
      kind: 'code',
      code: 'abc',
    });
    expect(readRedirect('nmuone://auth/callback?code=abc&state=other', 'state-123')).toEqual({
      kind: 'invalid',
      reason: 'state',
    });
    expect(readRedirect('https://a/auth/callback?state=s', 's')).toEqual({
      kind: 'invalid',
      reason: 'missing-code',
    });
    expect(readRedirect('https://a/auth/callback?error=access_denied&state=s', 's')).toEqual({
      kind: 'denied',
      error: 'access_denied',
    });
  });

  it('completes against the reference BFF, and only with the verifier', () => {
    const verifier = bytesToBase64Url(new Uint8Array(randomBytes(32)));
    const challenge = base64ToBase64Url(createHash('sha256').update(verifier).digest('base64'));
    const authorize = new URL(
      buildAuthorizeUrl('http://bff.test/dev-sso/authorize', {
        ...req,
        redirectUri: 'http://app.test/auth/callback',
        codeChallenge: challenge,
      }),
    );
    authorize.searchParams.set('persona', 'staff');
    const back = approve(authorize.searchParams);
    const outcome = readRedirect(back, req.state);
    if (outcome.kind !== 'code') throw new Error('expected a code');
    expect(
      exchange({
        code: outcome.code,
        codeVerifier: verifier,
        redirectUri: 'http://app.test/auth/callback',
      }),
    ).toBe('staff');
  });
});

describe('returns from the browser', () => {
  it('confirms a payment only when the provider approved that payment', () => {
    const back = 'nmuone://payments/return?paymentId=pay-1&status=approved';
    expect(readPaymentReturn(back, 'pay-1')).toBe('approved');
    expect(readPaymentReturn(back, 'pay-2')).toBe('cancelled');
    expect(readPaymentReturn(back.replace('approved', 'cancelled'), 'pay-1')).toBe('cancelled');
  });

  it('recognises the hand-off links and nothing else', () => {
    expect(isHandoffReturn('nmuone://auth/callback?code=1')).toBe(true);
    expect(isHandoffReturn('/payments/return?paymentId=1')).toBe(true);
    expect(isHandoffReturn('auth/callback')).toBe(true);
    expect(isHandoffReturn('/money/fees')).toBe(false);
    expect(isHandoffReturn('/auth/callbacks')).toBe(false);
  });
});
