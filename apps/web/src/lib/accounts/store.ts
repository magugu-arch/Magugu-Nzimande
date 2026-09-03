import { randomBytes } from 'node:crypto';
import type { Account, NewAddress, SavedAddress } from '@bbq/types';
import { mutateState, pushAudit, readState } from '../demo-state';
import { ABSENT_ACCOUNT_HASH, hashPassword, verifyPassword } from './passwords';

/**
 * The customer account store.
 *
 * `StoredAccount` is what is kept; `Account` is what leaves the building. The
 * two are different types on purpose, and `publicView` is the only bridge
 * between them, so returning a password hash to a client takes a deliberate act
 * rather than a forgotten `select`.
 */

export type StoredAccount = Account & {
  /** scrypt output plus its parameters. Never leaves this module. */
  passwordHash: string;
  /** Lower-cased email, for lookups that ignore how it was typed. */
  emailKey: string;
  addresses: SavedAddress[];
};

export type RegisterResult =
  | { ok: true; account: Account }
  | { ok: false; status: number; error: string };

export function publicView(stored: StoredAccount): Account {
  return {
    id: stored.id,
    name: stored.name,
    email: stored.email,
    mobile: stored.mobile,
    createdAt: stored.createdAt,
    points: stored.points,
  };
}

const keyFor = (email: string) => email.trim().toLowerCase();

export function findByEmail(email: string): StoredAccount | null {
  const key = keyFor(email);
  return readState().accounts.find((account) => account.emailKey === key) ?? null;
}

export function findById(id: string): StoredAccount | null {
  return readState().accounts.find((account) => account.id === id) ?? null;
}

export function register(input: {
  name: string;
  email: string;
  mobile: string;
  password: string;
}): RegisterResult {
  if (findByEmail(input.email)) {
    // Said plainly. Hiding it is pointless — the sign-up form has to tell
    // somebody their address is taken for them to do anything about it — and
    // the address is not a secret to its owner, who is the one being told.
    return { ok: false, status: 409, error: 'An account already uses that email address' };
  }

  const account: StoredAccount = {
    id: `acc_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`,
    name: input.name.trim(),
    email: input.email.trim(),
    emailKey: keyFor(input.email),
    mobile: input.mobile,
    createdAt: new Date().toISOString(),
    points: 0,
    passwordHash: hashPassword(input.password),
    addresses: [],
  };

  mutateState((state) => {
    // Checked again inside the mutation. The read above and this write are not
    // one transaction, so two sign-ups racing on the same address both saw an
    // empty result; a database would settle it with a unique index and this is
    // the closest a JSON file gets.
    if (state.accounts.some((candidate) => candidate.emailKey === account.emailKey)) return;
    state.accounts.push(account);
    pushAudit(state, 'accounts', 'A customer registered');
  });

  const saved = findByEmail(input.email);
  if (!saved) return { ok: false, status: 409, error: 'An account already uses that email address' };
  return { ok: true, account: publicView(saved) };
}

/**
 * Checks credentials.
 *
 * An unknown address is verified against a hash of a password nobody has, so
 * the wrong-address and wrong-password paths cost the same and the endpoint
 * cannot be used to find out who has an account here.
 */
export function authenticate(email: string, password: string): StoredAccount | null {
  const account = findByEmail(email);
  const hash = account?.passwordHash ?? ABSENT_ACCOUNT_HASH;
  const matches = verifyPassword(password, hash);
  return matches && account ? account : null;
}

export function addressesFor(accountId: string): SavedAddress[] {
  return findById(accountId)?.addresses ?? [];
}

export function saveAddress(accountId: string, input: NewAddress): SavedAddress | null {
  const address: SavedAddress = { id: `adr_${randomBytes(6).toString('hex')}`, ...input };

  return mutateState((state) => {
    const account = state.accounts.find((candidate) => candidate.id === accountId);
    if (!account) return null;

    account.addresses.push(address);
    // A delivery address book, not an archive of everywhere they have lived.
    if (account.addresses.length > 20) account.addresses.shift();
    return address;
  });
}

export function removeAddress(accountId: string, addressId: string): boolean {
  return mutateState((state) => {
    const account = state.accounts.find((candidate) => candidate.id === accountId);
    if (!account) return false;

    const before = account.addresses.length;
    account.addresses = account.addresses.filter((address) => address.id !== addressId);
    return account.addresses.length < before;
  });
}

export function awardPoints(accountId: string, points: number): void {
  mutateState((state) => {
    const account = state.accounts.find((candidate) => candidate.id === accountId);
    if (account) account.points += points;
  });
}

/**
 * Everything held about one person, for a POPIA access request.
 *
 * Deliberately assembled here rather than by a caller walking the state file:
 * a data-subject request that misses a table is a compliance failure, and the
 * place to notice a new table is the module that owns the shape.
 */
export function exportAccount(accountId: string): Record<string, unknown> | null {
  const account = findById(accountId);
  if (!account) return null;

  const { orders, payments } = readState();
  return {
    account: publicView(account),
    addresses: account.addresses,
    orders: orders.filter((order) => order.accountId === accountId),
    payments: payments.intents.filter((intent) =>
      orders.some((order) => order.id === intent.orderId && order.accountId === accountId),
    ),
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Erasure, as POPIA §24 requires it.
 *
 * The account and its addresses go. The orders do not: a business is required
 * to keep transaction records, and deleting them would breach a different
 * obligation. They are unlinked instead — the account id is cleared and the
 * customer's name, email and mobile are replaced — so what is left is a sale
 * with no person attached to it.
 */
export function eraseAccount(accountId: string): boolean {
  return mutateState((state) => {
    const index = state.accounts.findIndex((candidate) => candidate.id === accountId);
    if (index === -1) return false;

    state.accounts.splice(index, 1);
    for (const order of state.orders) {
      if (order.accountId !== accountId) continue;
      order.accountId = null;
      order.customer = { name: 'Erased', email: 'erased@example.invalid', mobile: '' };
    }

    pushAudit(state, 'accounts', 'A customer erased their account');
    return true;
  });
}
