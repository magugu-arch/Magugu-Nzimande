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

/*
 * There is deliberately no `awardPoints` here.
 *
 * There was, and it credited an account in its own state mutation. Points are
 * now posted by `postPoints` in the order store, inside the same mutation that
 * stamps the order as posted — so the credit and the record that it happened
 * cannot come apart, and there is no second way to hand out points for a
 * future caller to reach for.
 */

/**
 * Everything held about one person, for a POPIA access request.
 *
 * Deliberately assembled here rather than by a caller walking the state file:
 * a data-subject request that misses a table is a compliance failure, and the
 * place to notice a new table is the module that owns the shape.
 *
 * It missed one. The suppression list holds an address and the reason we stopped
 * emailing it, and that reason is a fact about a person — that they complained,
 * or that their mailbox rejected us — held indefinitely and reported to nobody.
 * It is the one record erasure deliberately keeps, which makes it the one this
 * export most has to mention: a request to see everything held about you should
 * not omit the single item that will outlive your account.
 */
export function exportAccount(accountId: string): Record<string, unknown> | null {
  const account = findById(accountId);
  if (!account) return null;

  const { orders, payments, suppressed } = readState();
  const key = keyFor(account.email);

  return {
    account: publicView(account),
    addresses: account.addresses,
    orders: orders.filter((order) => order.accountId === accountId),
    payments: payments.intents.filter((intent) =>
      orders.some((order) => order.id === intent.orderId && order.accountId === accountId),
    ),
    /**
     * Matched on the account's address rather than on each order's, because
     * this is about where we will not send email, and that is the address the
     * account signs in with.
     */
    emailSuppressions: suppressed.filter((entry) => entry.addressKey === key),
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Erasure, as POPIA §24 requires it.
 *
 * The account and its addresses go. The orders do not: a business is required
 * to keep transaction records, and deleting them would breach a different
 * obligation. They are unlinked instead, so what is left is a sale with no
 * person attached to it.
 *
 * That last sentence was written before the code did it. The account id was
 * cleared and the name, email and mobile were replaced — and the delivery
 * address was left exactly where it was, so every past delivery order still
 * carried the street and postal code of somebody who had asked to be
 * forgotten. A house number is not less identifying than a mobile number.
 *
 * The kitchen note goes with it: it is free text a customer types, and "ring
 * the bell for flat 4B, ask for Thandi" is the same information written
 * somewhere nobody thought to look.
 *
 * The suburb stays. It is a delivery area this business publishes on its own
 * stores page rather than anything about a person, and the retained sale is
 * more useful for knowing which areas order than it would be with the field
 * emptied. Keeping it is a decision; the test next door records it as one.
 */
export function eraseAccount(accountId: string): boolean {
  return mutateState((state) => {
    const index = state.accounts.findIndex((candidate) => candidate.id === accountId);
    if (index === -1) return false;

    /**
     * Gathered before anything is cleared, because clearing is what loses them.
     *
     * Both sources: the account holds what they registered with, and each order
     * holds what they typed at that checkout, which is not required to be the
     * same — somebody orders to a work address under a work email.
     */
    const identifiers = new Set<string>();
    const account = state.accounts[index];
    if (account) {
      identifiers.add(account.email);
      identifiers.add(account.mobile);
    }

    state.accounts.splice(index, 1);
    for (const order of state.orders) {
      if (order.accountId !== accountId) continue;
      identifiers.add(order.customer.email);
      identifiers.add(order.customer.mobile);
      if (order.address) identifiers.add(order.address);

      order.accountId = null;
      order.customer = { name: 'Erased', email: 'erased@example.invalid', mobile: '' };
      order.address = null;
      order.postalCode = null;
      order.kitchenNote = '';
    }

    /**
     * And out of the audit log, which was writing them down all along.
     *
     * Every notification leaves a line reading `email to <address>: …` or
     * `sms to <number>: …`, so the log held a customer's email address and
     * mobile number in plain text, once per message, after the order they came
     * from had been scrubbed. Erasing the order and leaving the log is erasing
     * the copy that was easy to find.
     *
     * Redacted rather than deleted: the entries say what the business did and
     * when, which is the point of keeping a log, and dropping them would hide
     * activity rather than anonymise it.
     *
     * By value, and only values long enough to be safe. The postal code is
     * deliberately not in this set — four digits appear inside amounts and
     * reference numbers, and a redaction that eats part of a total is worse
     * than the thing it was cleaning up. The postal code is cleared on the
     * order itself, where it can be addressed by name.
     */
    const redactable = [...identifiers].filter((value) => value.length >= 6);
    if (redactable.length > 0) {
      state.audit = state.audit.map((entry) => {
        let what = entry.what;
        for (const value of redactable) what = what.split(value).join('[erased]');
        return what === entry.what ? entry : { ...entry, what };
      });
    }

    /**
     * And any live reset for the account that no longer exists.
     *
     * Harmless on its own — `applyReset` looks the account up and finds
     * nothing — but a row naming a deleted account is a row that outlives it,
     * and the point of this function is that nothing does.
     */
    state.passwordResets = state.passwordResets.filter(
      (reset) => reset.accountId !== accountId,
    );

    pushAudit(state, 'accounts', 'A customer erased their account');
    return true;
  });
}
