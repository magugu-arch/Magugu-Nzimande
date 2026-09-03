import { afterEach, describe, expect, it } from 'vitest';
import {
  AccountError,
  addAddress,
  downloadMyData,
  eraseMe,
  myAddresses,
  myOrders,
  register,
  removeAddress,
  signIn,
  signOut,
  whoAmI,
} from '@/lib/account-api';
import { aProduct, customer, orderLine, stubFetch, type StubbedResponse } from './fixtures';

/**
 * The browser's view of the account endpoints.
 *
 * The whole account system existed as tested API routes with no interface —
 * ten days of work nobody could reach. This is the layer the interface calls,
 * kept separate from the component so it can be driven without a DOM, and it
 * is where a response the API did not promise has to fail.
 */

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

const serve = (reply: (path: string, init?: RequestInit) => StubbedResponse) => {
  restore = stubFetch(reply);
};

const anAccount = () => ({
  id: 'acc_1',
  name: customer.name,
  email: customer.email,
  mobile: customer.mobile,
  createdAt: new Date().toISOString(),
  points: 40,
});

const anAddress = () => ({
  id: 'adr_1',
  label: 'Home',
  address: '12 Oak Avenue',
  suburb: 'Sandton',
  note: '',
});

const anOrder = () => ({
  id: 'O-1',
  orderNumber: 'BBQ-260903-0001',
  storeId: 'ST-CRE',
  mode: 'Collection',
  status: 'completed',
  customer,
  accountId: 'acc_1',
  cancelledReason: null,
  placedAt: new Date().toISOString(),
  etaMinutes: 25,
  lines: [orderLine(aProduct())],
  totals: { subtotalCents: 100, discountCents: 0, deliveryCents: 0, totalCents: 100 },
  promoCode: null,
  address: null,
  suburb: null,
  postalCode: null,
  kitchenNote: '',
  pointsEarned: 1,
});

describe('signing in and up', () => {
  it('registers and comes back with the account', async () => {
    serve(() => ({ status: 201, body: { account: anAccount() } }));

    const account = await register({ ...customer, password: 'a-long-enough-password' });
    expect(account.email).toBe(customer.email);
  });

  it('signs in', async () => {
    serve(() => ({ body: { account: anAccount() } }));
    expect((await signIn(customer.email, 'pw')).id).toBe('acc_1');
  });

  /** Nobody signed in is an answer, not a failure. */
  it('answers null for nobody', async () => {
    serve(() => ({ body: { account: null } }));
    expect(await whoAmI()).toBeNull();
  });

  it('sends JSON when it posts', async () => {
    const seen: (RequestInit | undefined)[] = [];
    restore = stubFetch((_path, init) => {
      seen.push(init);
      return { body: { account: anAccount() } };
    });

    await signIn(customer.email, 'pw');
    expect(new Headers(seen[0]?.headers as HeadersInit).get('content-type')).toMatch(
      /application\/json/,
    );
  });
});

describe('when the API refuses', () => {
  it('throws an AccountError carrying the status', async () => {
    serve(() => ({ status: 409, body: { error: 'An account already uses that email address' } }));

    await expect(register({ ...customer, password: 'x' })).rejects.toBeInstanceOf(AccountError);
    await expect(register({ ...customer, password: 'x' })).rejects.toMatchObject({ status: 409 });
  });

  it('keeps the API’s own words, so the customer reads what went wrong', async () => {
    serve(() => ({ status: 401, body: { error: 'That email and password do not match' } }));
    await expect(signIn('a@b.com', 'pw')).rejects.toThrow(/do not match/);
  });

  /**
   * Field errors are carried through so a form can put the message beside the
   * input that caused it rather than at the top of the page.
   */
  it('carries field errors through', async () => {
    serve(() => ({
      status: 400,
      body: { error: 'Check the details', fields: [{ field: 'password', message: 'Too short' }] },
    }));

    await expect(register({ ...customer, password: 'x' })).rejects.toMatchObject({
      fields: [{ field: 'password', message: 'Too short' }],
    });
  });

  it('falls back to something sayable when the API sends no message', async () => {
    serve(() => ({ status: 500, body: {} }));
    await expect(whoAmI()).rejects.toThrow(/something went wrong/i);
  });

  it('does not mistake a non-string error for a message', async () => {
    serve(() => ({ status: 400, body: { error: { code: 42 } } }));
    await expect(whoAmI()).rejects.toThrow(/something went wrong/i);
  });
});

describe('a response the API did not promise', () => {
  /** The point of parsing rather than casting. */
  it('fails on a missing field rather than passing it on', async () => {
    const { email: _dropped, ...withoutEmail } = anAccount();
    void _dropped;
    serve(() => ({ body: { account: withoutEmail } }));

    await expect(signIn('a@b.com', 'pw')).rejects.toThrow(/unexpected/i);
  });

  it('fails when the envelope is missing', async () => {
    serve(() => ({ body: anAccount() }));
    await expect(signIn('a@b.com', 'pw')).rejects.toThrow(/unexpected/i);
  });

  it('fails on an address list that is not a list', async () => {
    serve(() => ({ body: { addresses: 'none' } }));
    await expect(myAddresses()).rejects.toThrow(/unexpected/i);
  });
});

describe('the address book', () => {
  it('lists them', async () => {
    serve(() => ({ body: { addresses: [anAddress()] } }));
    expect(await myAddresses()).toHaveLength(1);
  });

  it('adds one', async () => {
    serve(() => ({ status: 201, body: { address: anAddress() } }));
    expect((await addAddress({ label: 'Home', address: '12 Oak', suburb: 'Sandton', note: '' })).id)
      .toBe('adr_1');
  });

  /** An id containing a slash must not be able to reach a different route. */
  it('escapes the id it removes rather than pasting it in', async () => {
    const paths: string[] = [];
    restore = stubFetch((path) => {
      paths.push(path);
      return { body: { removed: true } };
    });

    await removeAddress('adr/../../admin');
    expect(paths[0]).not.toContain('/../');
  });
});

describe('order history', () => {
  it('comes from the server rather than the browser', async () => {
    const paths: string[] = [];
    restore = stubFetch((path) => {
      paths.push(path);
      return { body: { orders: [anOrder()] } };
    });

    const orders = await myOrders();
    expect(paths[0]).toBe('/api/account/orders');
    expect(orders[0]?.orderNumber).toBe('BBQ-260903-0001');
  });

  it('parses each order rather than trusting the array', async () => {
    serve(() => ({ body: { orders: [{ id: 'O-1' }] } }));
    await expect(myOrders()).rejects.toThrow(/unexpected/i);
  });
});

describe('the privacy requests', () => {
  it('erases through the right method, since a GET would be an export', async () => {
    const seen: (RequestInit | undefined)[] = [];
    restore = stubFetch((_path, init) => {
      seen.push(init);
      return { body: { erased: true } };
    });

    await eraseMe();
    expect(seen[0]?.method).toBe('DELETE');
  });

  it('hands back the export as a file', async () => {
    serve(() => ({ body: { account: anAccount(), orders: [], addresses: [] } }));

    const blob = await downloadMyData();
    expect(JSON.parse(await blob.text())).toMatchObject({ account: { id: 'acc_1' } });
  });

  /**
   * The download is started from a blob rather than by linking the endpoint, so
   * a refusal has to throw here. If it returned the body anyway the customer
   * would get a file called `bbq-chicken-my-data.json` containing an error.
   */
  it('refuses to hand back an error page as the export', async () => {
    serve(() => ({ status: 401, body: { error: 'Sign in first' } }));
    await expect(downloadMyData()).rejects.toBeInstanceOf(AccountError);
  });
});

describe('signing out', () => {
  /**
   * The method is the whole request. A POST to this path signs somebody *in*,
   * so getting it wrong would leave the session open on a shared phone.
   */
  it('deletes the session rather than posting to it', async () => {
    const seen: { path: string; init?: RequestInit }[] = [];
    restore = stubFetch((path, init) => {
      seen.push({ path, init });
      return { body: {} };
    });

    await signOut();
    expect(seen[0]?.path).toBe('/api/account/session');
    expect(seen[0]?.init?.method).toBe('DELETE');
  });

  /** Sign-out is what you do when something is already wrong; it cannot throw. */
  it('says it failed rather than throwing when the network is down', async () => {
    restore = stubFetch(() => {
      throw new Error('offline');
    });

    await expect(signOut()).resolves.toBe(false);
  });

  /**
   * The cookie is HttpOnly, so only the server can end the session. A refusal
   * that read as success would tell someone on a shared phone they had signed
   * out while their session stayed open.
   */
  it('does not claim success when the server refused', async () => {
    serve(() => ({ status: 500, body: {} }));
    expect(await signOut()).toBe(false);
  });

  it('confirms when the server ended the session', async () => {
    serve(() => ({ body: {} }));
    expect(await signOut()).toBe(true);
  });
});
