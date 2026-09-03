import { beforeEach, describe, expect, it } from 'vitest';
import { POST as requestRoute, PUT as completeRoute } from '@/app/api/account/reset/route';
import { POST as signInRoute } from '@/app/api/account/session/route';
import { completeReset, liveResetCount, requestReset } from '@/lib/accounts/reset';
import { readAudit } from '@/lib/catalogue-state';
import { readState } from '@/lib/demo-state';
import {
  blankState,
  bodyOf,
  customer,
  registerCustomer,
  request,
  withAccounts,
} from './fixtures';

/**
 * Password reset — the half that needs no provider.
 *
 * A reset is a token minted, delivered and spent. Only delivery needs a
 * messaging contract, and it goes through the notification seam like everything
 * else, which on this deployment writes to the audit log rather than an inbox.
 *
 * Almost everything here is about what the endpoint must *not* do. A reset flow
 * is the most attacked part of any account system, because it is the one place
 * that grants access to somebody who cannot already prove who they are.
 */

const NEW_PASSWORD = 'a-brand-new-password';

beforeEach(blankState);

describe('asking for a reset', () => {
  it('mints one for an address that exists', async () => {
    await withAccounts(async () => {
      await registerCustomer();
      const reset = requestReset(customer.email);

      expect(reset?.token).toBeTruthy();
      expect(liveResetCount()).toBe(1);
    });
  });

  it('mints nothing for an address that does not', () => {
    expect(requestReset('nobody@example.com')).toBeNull();
    expect(liveResetCount()).toBe(0);
  });

  /**
   * The reply is identical either way, including for an address that is not an
   * address at all. Anything else turns this into a way to find out who has an
   * account here, which is exactly the list an attacker wants first.
   */
  it('says the same thing whether or not anybody has the address', async () => {
    await withAccounts(async () => {
      await registerCustomer();

      const real = await requestRoute(
        request('/api/account/reset', { body: { email: customer.email } }),
      );
      const invented = await requestRoute(
        request('/api/account/reset', { body: { email: 'nobody@example.com' } }),
      );
      const nonsense = await requestRoute(
        request('/api/account/reset', { body: { email: 'not-an-address' } }),
      );

      expect([real.status, invented.status, nonsense.status]).toEqual([200, 200, 200]);

      // Read once each. A Response body is a stream, so comparing `real`
      // against two others by reading it twice fails on the second read rather
      // than on the thing being tested.
      const [a, b, c] = await Promise.all([bodyOf(real), bodyOf(invented), bodyOf(nonsense)]);
      expect(a).toEqual(b);
      expect(a).toEqual(c);
    });
  });

  /** The token is delivered, never returned. Returning it is the whole attack. */
  it('never puts the token in the response', async () => {
    await withAccounts(async () => {
      await registerCustomer();
      const response = await requestRoute(
        request('/api/account/reset', { body: { email: customer.email } }),
      );

      const body = await response.text();
      const [stored] = readState().passwordResets;

      expect(stored).toBeTruthy();
      expect(body).not.toContain(stored?.tokenHash);
      expect(body.length, 'the reply carries nothing but an acknowledgement').toBeLessThan(64);
    });
  });

  /**
   * Only a hash is kept. A leaked copy of the state file is then a list of
   * useless strings rather than a way into every account on it.
   */
  it('stores a hash and not the token', async () => {
    await withAccounts(async () => {
      await registerCustomer();
      const reset = requestReset(customer.email);
      const [stored] = readState().passwordResets;

      expect(stored?.tokenHash).not.toBe(reset?.token);
      expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  /**
   * One live reset per account. A second request invalidates the first, so a
   * customer who clicks twice cannot be confused about which link works and
   * nobody can bank a supply of them.
   */
  it('replaces the previous one rather than adding to it', async () => {
    await withAccounts(async () => {
      await registerCustomer();
      const first = requestReset(customer.email);
      const second = requestReset(customer.email);

      expect(liveResetCount()).toBe(1);
      expect(completeReset(first?.token ?? '', NEW_PASSWORD).ok, 'the old one is dead').toBe(false);
      expect(completeReset(second?.token ?? '', NEW_PASSWORD).ok).toBe(true);
    });
  });

  it('writes the message to the log rather than pretending to send it', async () => {
    await withAccounts(async () => {
      await registerCustomer();
      await requestRoute(request('/api/account/reset', { body: { email: customer.email } }));

      expect(readAudit().some((entry) => entry.who === 'notifications')).toBe(true);
    });
  });
});

describe('spending a reset', () => {
  async function aReset() {
    await registerCustomer();
    return requestReset(customer.email)?.token ?? '';
  }

  it('sets the new password', async () => {
    await withAccounts(async () => {
      const token = await aReset();
      expect(completeReset(token, NEW_PASSWORD).ok).toBe(true);

      const signedIn = await signInRoute(
        request('/api/account/session', {
          body: { email: customer.email, password: NEW_PASSWORD },
        }),
      );
      expect(signedIn.status).toBe(200);
    });
  });

  it('stops the old password working', async () => {
    await withAccounts(async () => {
      const token = await aReset();
      completeReset(token, NEW_PASSWORD);

      const withOld = await signInRoute(
        request('/api/account/session', {
          body: { email: customer.email, password: 'a-long-enough-password' },
        }),
      );
      expect(withOld.status).toBe(401);
    });
  });

  /**
   * Single use. Reset links sit in inboxes for years, and one that still works
   * after the password has changed is a second key left under the mat.
   */
  it('cannot be spent twice', async () => {
    await withAccounts(async () => {
      const token = await aReset();

      expect(completeReset(token, NEW_PASSWORD).ok).toBe(true);
      expect(completeReset(token, 'another-new-password').ok).toBe(false);
      expect(liveResetCount()).toBe(0);
    });
  });

  it('refuses a token that was never minted', () => {
    expect(completeReset('not-a-real-token', NEW_PASSWORD).ok).toBe(false);
  });

  it('refuses one that has expired', async () => {
    await withAccounts(async () => {
      const token = await aReset();
      const anHourAndABitLater = Date.now() + 61 * 60 * 1_000;

      expect(completeReset(token, NEW_PASSWORD, anHourAndABitLater).ok).toBe(false);
    });
  });

  /** Expired and never-existed must be indistinguishable from outside. */
  it('says the same thing for an expired token and an invented one', async () => {
    await withAccounts(async () => {
      const token = await aReset();
      const later = Date.now() + 61 * 60 * 1_000;

      const expired = completeReset(token, NEW_PASSWORD, later);
      const invented = completeReset('never-existed', NEW_PASSWORD, later);

      expect(expired).toEqual(invented);
    });
  });

  it('will not set a password short enough to guess', async () => {
    await withAccounts(async () => {
      const token = await aReset();
      const response = await completeRoute(
        request('/api/account/reset', { method: 'PUT', body: { token, password: 'short' } }),
      );

      expect(response.status).toBe(400);
      expect(completeReset(token, NEW_PASSWORD).ok, 'and the token is unspent').toBe(true);
    });
  });

  /**
   * Someone holding the link but not the inbox should have to prove they know
   * the password they just set. Signing them in here would skip that.
   */
  it('does not sign them in', async () => {
    await withAccounts(async () => {
      const token = await aReset();
      const response = await completeRoute(
        request('/api/account/reset', { method: 'PUT', body: { token, password: NEW_PASSWORD } }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('set-cookie')).toBeNull();
    });
  });
});

describe('with accounts switched off', () => {
  it('refuses both halves', async () => {
    const asked = await requestRoute(
      request('/api/account/reset', { body: { email: customer.email } }),
    );
    const spent = await completeRoute(
      request('/api/account/reset', { method: 'PUT', body: { token: 'x', password: NEW_PASSWORD } }),
    );

    expect([asked.status, spent.status]).toEqual([503, 503]);
  });
});
