import { AccountSchema, OrderSchema, SavedAddressSchema, z } from '@bbq/types';
import type { Account, NewAddress, Order, SavedAddress } from '@bbq/types';

/**
 * The browser's view of the account endpoints.
 *
 * Every response is parsed through its schema rather than cast, for the same
 * reason `client-api.ts` does it: a shape the API did not promise should fail
 * here, next to the request, and not three components later where the symptom
 * is a blank panel.
 *
 * The logic lives here rather than in the component so it can be tested without
 * a DOM. The component that uses it is deliberately thin.
 */

export class AccountError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'AccountError';
  }
}

const AccountReply = z.object({ account: AccountSchema });
const MaybeAccountReply = z.object({ account: AccountSchema.nullable() });
const AddressesReply = z.object({ addresses: z.array(SavedAddressSchema) });
const AddressReply = z.object({ address: SavedAddressSchema });
const OrdersReply = z.object({ orders: z.array(OrderSchema) });

type ErrorBody = { error?: unknown; fields?: unknown };

async function call<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    const message =
      typeof body.error === 'string' ? body.error : 'Something went wrong. Try again.';

    // Field errors are carried through so a form can put the message beside the
    // input that caused it rather than at the top of the page.
    const fields = Array.isArray(body.fields)
      ? (body.fields as { field: string; message: string }[])
      : [];

    throw new AccountError(message, response.status, fields);
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new AccountError('The server sent something unexpected.', response.status);
  }
  return parsed.data;
}

export async function register(input: {
  name: string;
  email: string;
  mobile: string;
  password: string;
}): Promise<Account> {
  return (await call('/api/account', AccountReply, { method: 'POST', body: JSON.stringify(input) }))
    .account;
}

export async function signIn(email: string, password: string): Promise<Account> {
  return (
    await call('/api/account/session', AccountReply, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  ).account;
}

/**
 * Ends the session, reporting whether the server agreed.
 *
 * The session cookie is HttpOnly, so only the server can clear it. That makes
 * the return value matter: if this call did not reach the server the person is
 * still signed in, and a screen that cleared itself anyway would tell someone on
 * a shared phone they had signed out when they had not. It does not throw,
 * because the caller is a button — an exception here just makes it look dead.
 */
export async function signOut(): Promise<boolean> {
  try {
    return (await fetch('/api/account/session', { method: 'DELETE' })).ok;
  } catch {
    return false;
  }
}

/** Null when nobody is signed in, which is an answer rather than an error. */
export async function whoAmI(): Promise<Account | null> {
  return (await call('/api/account/session', MaybeAccountReply)).account;
}

export async function myAddresses(): Promise<SavedAddress[]> {
  return (await call('/api/account/addresses', AddressesReply)).addresses;
}

export async function addAddress(input: NewAddress): Promise<SavedAddress> {
  return (
    await call('/api/account/addresses', AddressReply, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).address;
}

export async function removeAddress(id: string): Promise<void> {
  // Escaped rather than pasted in, so an id containing a slash cannot reach a
  // different route.
  await call(`/api/account/addresses?id=${encodeURIComponent(id)}`, z.object({}).passthrough(), {
    method: 'DELETE',
  });
}

/**
 * The customer's real order history, from the server.
 *
 * Distinct from the orders the browser remembers. A guest's orders live in this
 * device's storage and belong to nobody; these belong to an account and follow
 * the person to a new phone. Showing the two as one list would tell a customer
 * their history had vanished when they signed in on a different device.
 */
export async function myOrders(): Promise<Order[]> {
  return (await call('/api/account/orders', OrdersReply)).orders;
}

/** POPIA §23. Everything held about the signed-in customer, as a file. */
export async function downloadMyData(): Promise<Blob> {
  const response = await fetch('/api/account/privacy');
  if (!response.ok) throw new AccountError('Could not export your data.', response.status);
  return response.blob();
}

/** POPIA §24. The account goes; the orders stay, unlinked. */
export async function eraseMe(): Promise<void> {
  await call('/api/account/privacy', z.object({}).passthrough(), { method: 'DELETE' });
}
