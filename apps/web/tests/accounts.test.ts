import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST as registerRoute } from '@/app/api/account/route';
import {
  DELETE as signOutRoute,
  GET as whoamiRoute,
  POST as signInRoute,
} from '@/app/api/account/session/route';
import {
  DELETE as removeAddressRoute,
  GET as listAddressesRoute,
  POST as addAddressRoute,
} from '@/app/api/account/addresses/route';
import { GET as historyRoute } from '@/app/api/account/orders/route';
import {
  DELETE as eraseRoute,
  GET as exportRoute,
} from '@/app/api/account/privacy/route';
import { POST as createOrderRoute } from '@/app/api/orders/route';
import { CUSTOMER_COOKIE, accountIdFrom, mintSession } from '@/lib/accounts/session';
import { ABSENT_ACCOUNT_HASH, hashPassword, verifyPassword } from '@/lib/accounts/passwords';
import { authenticate, findByEmail } from '@/lib/accounts/store';
import { readState } from '@/lib/demo-state';
import { readOrder, setOrderStatus } from '@/lib/order-store';
import type { Order } from '@bbq/types';
import {
  aProduct,
  blankState,
  bodyOf,
  customer,
  orderLine,
  orderRequest,
  registerCustomer,
  registration,
  request,
  withAccounts,
} from './fixtures';

/**
 * Customer accounts.
 *
 * Everything a person can do to their own record, and everything they must not
 * be able to do to somebody else's. The second half is the part worth the
 * effort: an order-history endpoint that takes whose history to return as a
 * parameter is an order-history endpoint that returns anybody's, and that
 * failure is invisible until it is a headline.
 */

beforeEach(blankState);

describe('with no session secret', () => {
  /**
   * Fails closed. Without a secret, sessions could be minted but not verified,
   * so accounts are switched off rather than half on — a locked feature is
   * recoverable, an unverifiable one is not.
   */
  it('refuses to register anyone', async () => {
    const response = await registerRoute(request('/api/account', { body: registration() }));
    expect(response.status).toBe(503);
  });

  it('refuses to sign anyone in', async () => {
    const response = await signInRoute(
      request('/api/account/session', { body: { email: customer.email, password: 'whatever' } }),
    );
    expect(response.status).toBe(503);
  });
});

describe('registering', () => {
  it('creates the account and signs them straight in', async () => {
    await withAccounts(async () => {
      const response = await registerRoute(request('/api/account', { body: registration() }));

      expect(response.status).toBe(201);
      expect(response.headers.get('set-cookie')).toContain(CUSTOMER_COOKIE);
    });
  });

  it('never answers with anything derived from the password', async () => {
    await withAccounts(async () => {
      const response = await registerRoute(request('/api/account', { body: registration() }));
      const body = await response.text();

      expect(body).not.toContain('a-long-enough-password');
      expect(body).not.toMatch(/passwordHash|scrypt/);
    });
  });

  it('refuses a second account on the same address', async () => {
    await withAccounts(async () => {
      await registerCustomer();
      const again = await registerRoute(request('/api/account', { body: registration() }));

      expect(again.status).toBe(409);
    });
  });

  /** An address book does not care about capitals, and neither does a person. */
  it('treats the same address in different case as the same address', async () => {
    await withAccounts(async () => {
      await registerCustomer();
      const again = await registerRoute(
        request('/api/account', { body: registration({ email: customer.email.toUpperCase() }) }),
      );

      expect(again.status).toBe(409);
    });
  });

  it('refuses a password short enough to guess', async () => {
    await withAccounts(async () => {
      const response = await registerRoute(
        request('/api/account', { body: registration({ password: 'short' }) }),
      );

      expect(response.status).toBe(400);
      const { fields } = await bodyOf<{ fields: { field: string }[] }>(response);
      expect(fields.some((issue) => issue.field === 'password')).toBe(true);
    });
  });

  it('refuses a mobile number that is not South African', async () => {
    await withAccounts(async () => {
      const response = await registerRoute(
        request('/api/account', { body: registration({ mobile: '+1 555 0100' }) }),
      );
      expect(response.status).toBe(400);
    });
  });
});

describe('the stored password', () => {
  it('is not the password', () => {
    const hash = hashPassword('a-long-enough-password');
    expect(hash).not.toContain('a-long-enough-password');
    expect(hash.startsWith('scrypt$')).toBe(true);
  });

  it('verifies the right one and refuses the wrong one', () => {
    const hash = hashPassword('a-long-enough-password');
    expect(verifyPassword('a-long-enough-password', hash)).toBe(true);
    expect(verifyPassword('a-long-enough-passwore', hash)).toBe(false);
  });

  /** Two people with one password must not share a hash. */
  it('is different every time, because the salt is', () => {
    expect(hashPassword('same-password-twice')).not.toBe(hashPassword('same-password-twice'));
  });

  /**
   * A corrupt row should refuse one sign-in, not crash the endpoint for
   * everybody — and certainly not tell the caller which rows are malformed.
   */
  it('refuses rather than throws on a stored value it cannot read', () => {
    for (const broken of ['', 'nonsense', 'scrypt$1$2$3', 'bcrypt$1$8$1$c2FsdA==$aGFzaA==']) {
      expect(() => verifyPassword('anything', broken), broken).not.toThrow();
      expect(verifyPassword('anything', broken), broken).toBe(false);
    }
  });

  /** A stored cost is an instruction to allocate memory, so it is bounded. */
  it('refuses a stored cost that would exhaust the process', () => {
    expect(verifyPassword('anything', 'scrypt$99999999$8$1$c2FsdA==$aGFzaA==')).toBe(false);
  });
});

describe('signing in', () => {
  it('works with the right password', async () => {
    await withAccounts(async () => {
      await registerCustomer();
      const response = await signInRoute(
        request('/api/account/session', {
          body: { email: customer.email, password: 'a-long-enough-password' },
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('set-cookie')).toContain(CUSTOMER_COOKIE);
    });
  });

  /**
   * The same reply for both. An endpoint that distinguishes "no such account"
   * from "wrong password" is a way to find out which of your customers' email
   * addresses are on it, which matters more for a restaurant than it sounds.
   */
  it('says the same thing for a wrong password and an unknown address', async () => {
    await withAccounts(async () => {
      await registerCustomer();

      const wrongPassword = await signInRoute(
        request('/api/account/session', {
          body: { email: customer.email, password: 'not-the-password' },
        }),
      );
      const unknownAddress = await signInRoute(
        request('/api/account/session', {
          body: { email: 'nobody@example.com', password: 'a-long-enough-password' },
        }),
      );

      expect(wrongPassword.status).toBe(unknownAddress.status);
      expect(await bodyOf(wrongPassword)).toEqual(await bodyOf(unknownAddress));
    });
  });

  /**
   * The half the reply cannot show.
   *
   * Matching status and body is not enough: an implementation that returns
   * early on an unknown address answers just as identically and roughly fifty
   * times faster, and the clock is then the oracle. `authenticate` verifies
   * against a hash of a password nobody has so both paths do the same work.
   *
   * Compared as a ratio rather than against a millisecond threshold, so the
   * test says "these two cost about the same" — which is the actual property —
   * instead of encoding how fast this machine happens to be.
   */
  it('spends the same work on an unknown address as on a wrong password', async () => {
    await withAccounts(async () => {
      await registerCustomer();

      const timed = (email: string) => {
        const started = performance.now();
        authenticate(email, 'not-the-password');
        return performance.now() - started;
      };

      // Once through first: the first scrypt call in a process pays for warm-up
      // that would otherwise land on whichever measurement went first.
      timed(customer.email);

      const known = timed(customer.email);
      const unknown = timed('nobody@example.com');

      expect(unknown / known, `known ${known}ms vs unknown ${unknown}ms`).toBeGreaterThan(0.25);
    });
  });

  /** The dummy hash has to be real work, or the defence above is decorative. */
  it('verifies the absent-account hash at the same cost as a real one', () => {
    const [format, cost, blockSize, parallelism] = ABSENT_ACCOUNT_HASH.split('$');
    const real = hashPassword('a-long-enough-password').split('$');

    expect([format, cost, blockSize, parallelism]).toEqual(real.slice(0, 4));
  });

  it('signs out, and says who nobody is afterwards', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      expect((await bodyOf<{ account: unknown }>(
        whoamiRoute(request('/api/account/session', { cookie })),
      )).account).not.toBeNull();

      const out = signOutRoute();
      expect(out.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    });
  });
});

describe('the session cookie', () => {
  it('is not readable by script and does not travel cross-site', async () => {
    await withAccounts(async () => {
      const response = await registerRoute(request('/api/account', { body: registration() }));
      const cookie = response.headers.get('set-cookie') ?? '';

      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
    });
  });

  it('resolves to the account it names', async () => {
    await withAccounts(async () => {
      const { id } = await registerCustomer();
      expect(accountIdFrom(mintSession(id))).toBe(id);
    });
  });

  it('refuses a token whose signature has been edited', async () => {
    await withAccounts(async () => {
      const { id } = await registerCustomer();
      const token = mintSession(id) ?? '';
      const [account, expiry] = token.split('.');

      expect(accountIdFrom(`${account}.${expiry}.${'0'.repeat(64)}`)).toBeNull();
    });
  });

  /** The signature covers the account id, so swapping it invalidates the token. */
  it('refuses a token repointed at somebody else', async () => {
    await withAccounts(async () => {
      const { id } = await registerCustomer();
      const other = await registerCustomer({ email: 'second@example.com' });
      const token = mintSession(id) ?? '';
      const [, expiry, signature] = token.split('.');

      expect(accountIdFrom(`${other.id}.${expiry}.${signature}`)).toBeNull();
    });
  });

  it('refuses an expired token', async () => {
    await withAccounts(async () => {
      const { id } = await registerCustomer();
      const token = mintSession(id, Date.now() - 40 * 86_400_000) ?? '';

      expect(accountIdFrom(token)).toBeNull();
    });
  });

  /**
   * Looked up rather than trusted, which is what makes erasure take effect now
   * instead of in thirty days.
   */
  it('stops working the moment the account is erased', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      await eraseRoute(request('/api/account/privacy', { cookie, method: 'DELETE' }));

      const who = await bodyOf<{ account: unknown }>(
        whoamiRoute(request('/api/account/session', { cookie })),
      );
      expect(who.account).toBeNull();
    });
  });
});

describe('the address book', () => {
  it('needs a session', async () => {
    await withAccounts(async () => {
      expect((await listAddressesRoute(request('/api/account/addresses'))).status).toBe(401);
    });
  });

  it('saves and lists an address', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      const saved = await addAddressRoute(
        request('/api/account/addresses', {
          cookie,
          body: { label: 'Home', address: '12 Oak Avenue', suburb: 'Sandton', note: '' },
        }),
      );

      expect(saved.status).toBe(201);
      const { addresses } = await bodyOf<{ addresses: { label: string }[] }>(
        await listAddressesRoute(request('/api/account/addresses', { cookie })),
      );
      expect(addresses.map((address) => address.label)).toEqual(['Home']);
    });
  });

  /**
   * Scoped to the session's account. Deleting somebody else's address answers
   * the same as deleting one that never existed, so the endpoint cannot be used
   * to find out which ids are real.
   */
  it('will not let one customer delete another’s address', async () => {
    await withAccounts(async () => {
      const mine = await registerCustomer();
      const theirs = await registerCustomer({ email: 'second@example.com' });

      const saved = await addAddressRoute(
        request('/api/account/addresses', {
          cookie: theirs.cookie,
          body: { label: 'Theirs', address: '9 Elm Road', suburb: 'Rosebank', note: '' },
        }),
      );
      const { address } = await bodyOf<{ address: { id: string } }>(saved);

      const attempt = await removeAddressRoute(
        request(`/api/account/addresses?id=${address.id}`, {
          cookie: mine.cookie,
          method: 'DELETE',
        }),
      );

      expect(attempt.status).toBe(404);
      const { addresses } = await bodyOf<{ addresses: unknown[] }>(
        await listAddressesRoute(request('/api/account/addresses', { cookie: theirs.cookie })),
      );
      expect(addresses, 'still theirs').toHaveLength(1);
    });
  });
});

describe('order history', () => {
  async function placeAs(cookie: string | undefined) {
    return createOrderRoute(
      request('/api/orders', {
        ...(cookie ? { cookie } : {}),
        body: orderRequest([orderLine(aProduct())]),
      }),
    );
  }

  it('shows a customer their own orders', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      await placeAs(cookie);

      const { orders } = await bodyOf<{ orders: unknown[] }>(
        await historyRoute(request('/api/account/orders', { cookie })),
      );
      expect(orders).toHaveLength(1);
    });
  });

  /** The one that must never regress. */
  it('shows a customer nobody else’s', async () => {
    await withAccounts(async () => {
      const mine = await registerCustomer();
      const theirs = await registerCustomer({ email: 'second@example.com' });

      await placeAs(theirs.cookie);

      const { orders } = await bodyOf<{ orders: unknown[] }>(
        await historyRoute(request('/api/account/orders', { cookie: mine.cookie })),
      );
      expect(orders).toHaveLength(0);
    });
  });

  /** A guest order belongs to nobody, rather than to everybody. */
  it('does not hand a guest’s order to the first customer who asks', async () => {
    await withAccounts(async () => {
      await placeAs(undefined);
      const { cookie } = await registerCustomer();

      const { orders } = await bodyOf<{ orders: unknown[] }>(
        await historyRoute(request('/api/account/orders', { cookie })),
      );
      expect(orders).toHaveLength(0);
    });
  });

  it('needs a session at all', async () => {
    await withAccounts(async () => {
      expect((await historyRoute(request('/api/account/orders'))).status).toBe(401);
    });
  });
});

describe('the order itself', () => {
  it('now carries the customer it was placed by', async () => {
    const response = await createOrderRoute(
      request('/api/orders', { body: orderRequest([orderLine(aProduct())]) }),
    );
    const { order } = await bodyOf<{ order: { customer: { email: string } } }>(response);

    // Collected and validated at checkout since the beginning, and dropped on
    // the floor until now: the kitchen had no way to ring anybody.
    expect(order.customer.email).toBe(customer.email);
  });

  /**
   * Points post when the order completes, not when it is placed.
   *
   * They used to be credited at placement, which meant a signed-in customer
   * could place an order, take the points and cancel it — and it contradicted
   * the rewards page, which says points post once an order is completed.
   */
  it('does not credit points for an order that has only been placed', async () => {
    await withAccounts(async () => {
      const { cookie, id } = await registerCustomer();
      await createOrderRoute(
        request('/api/orders', { cookie, body: orderRequest([orderLine(aProduct())]) }),
      );

      expect(findByEmail(customer.email)?.id).toBe(id);
      expect(findByEmail(customer.email)?.points).toBe(0);
    });
  });

  it('posts them onto the account when the order completes', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      const placed = await bodyOf<{ order: Order }>(
        await createOrderRoute(
          request('/api/orders', { cookie, body: orderRequest([orderLine(aProduct())]) }),
        ),
      );

      setOrderStatus(placed.order.id, 'completed');

      expect(findByEmail(customer.email)?.points).toBe(placed.order.pointsEarned);
      expect(readOrder(placed.order.id)?.pointsPostedAt).not.toBeNull();
    });
  });

  /** The loop this closes: place, take the points, cancel, keep them. */
  it('posts nothing for an order that was cancelled', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      const placed = await bodyOf<{ order: Order }>(
        await createOrderRoute(
          request('/api/orders', { cookie, body: orderRequest([orderLine(aProduct())]) }),
        ),
      );

      setOrderStatus(placed.order.id, 'cancelled', 'The customer changed their mind');

      expect(findByEmail(customer.email)?.points).toBe(0);
    });
  });

  /** An operator can set a completed order to completed again. */
  it('does not post the same order twice', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      const placed = await bodyOf<{ order: Order }>(
        await createOrderRoute(
          request('/api/orders', { cookie, body: orderRequest([orderLine(aProduct())]) }),
        ),
      );

      setOrderStatus(placed.order.id, 'completed');
      setOrderStatus(placed.order.id, 'completed');

      expect(findByEmail(customer.email)?.points).toBe(placed.order.pointsEarned);
    });
  });

  /** A guest has no account for them to land on. */
  it('posts nothing for a guest, and does not fall over trying', async () => {
    const placed = await bodyOf<{ order: Order }>(
      await createOrderRoute(request('/api/orders', { body: orderRequest([orderLine(aProduct())]) })),
    );

    setOrderStatus(placed.order.id, 'completed');
    expect(readOrder(placed.order.id)?.pointsPostedAt).toBeNull();
  });
});

describe('a data-subject request', () => {
  it('hands over everything held about the person', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      await createOrderRoute(
        request('/api/orders', { cookie, body: orderRequest([orderLine(aProduct())]) }),
      );

      const response = await exportRoute(request('/api/account/privacy', { cookie }));
      expect(response.status).toBe(200);
      expect(response.headers.get('content-disposition')).toContain('attachment');

      const data = await bodyOf<{ account: unknown; orders: unknown[] }>(response);
      expect(data.account).toBeTruthy();
      expect(data.orders).toHaveLength(1);
    });
  });

  it('needs a session, so nobody exports anybody else', async () => {
    await withAccounts(async () => {
      expect((await exportRoute(request('/api/account/privacy'))).status).toBe(401);
    });
  });

  /**
   * Erasure that keeps the sale. Deleting the transaction record to honour a
   * deletion request breaches the obligation to retain it, so the order stays
   * and the person is taken off it.
   */
  it('erases the customer and unlinks the order without destroying it', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      await createOrderRoute(
        request('/api/orders', { cookie, body: orderRequest([orderLine(aProduct())]) }),
      );

      const response = await eraseRoute(
        request('/api/account/privacy', { cookie, method: 'DELETE' }),
      );
      expect(response.status).toBe(200);

      const state = readState();
      expect(state.accounts, 'the person is gone').toHaveLength(0);
      expect(state.orders, 'the sale is not').toHaveLength(1);
      expect(state.orders[0]?.accountId).toBeNull();
      expect(state.orders[0]?.customer.email).not.toBe(customer.email);
    });
  });

  it('signs them out as it goes', async () => {
    await withAccounts(async () => {
      const { cookie } = await registerCustomer();
      const response = await eraseRoute(
        request('/api/account/privacy', { cookie, method: 'DELETE' }),
      );

      expect(response.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    });
  });
});

describe('the rewards page shows one balance', () => {
  const source = (file: string) => readFileSync(path.resolve(__dirname, '../src', file), 'utf8');

  /**
   * There were two numbers for the same thing: the rewards page counted this
   * browser's completed orders under the heading "your balance", while the
   * account page showed the figure the server keeps. They disagree for anybody
   * signed in, and on a new phone the browser's answer is zero.
   */
  it('reads the account on the server rather than counting in the browser', () => {
    const page = source('app/rewards/page.tsx');
    expect(page).toContain('currentAccountFromCookies');
    expect(page).toContain('accountPoints');
    // Prerendering it would bake one visitor's balance into the markup.
    expect(page).toContain("dynamic = 'force-dynamic'");
  });

  it('labels the device-local figure as such rather than calling it the balance', () => {
    const balance = source('components/rewards/RewardsBalance.tsx');
    expect(balance).toContain('On this device');
    expect(balance).toContain('accountPoints');
  });
});
