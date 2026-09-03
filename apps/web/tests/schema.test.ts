import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readState } from '@/lib/demo-state';
import { blankState } from './fixtures';

/**
 * The Postgres schema, against the JSON shape it is standing in for.
 *
 * Nothing applies this migration — no database has been provisioned, and doing
 * so is a hosting decision. It is written anyway because the JSON store's shape
 * is already the de facto schema, and the longer that goes unwritten the
 * further it drifts into something no relational model fits.
 *
 * This suite is what stops the two disagreeing quietly. It is not a substitute
 * for running the migration against a real server, which is the remaining work;
 * it catches the specific failure that would otherwise be found on the day of
 * the move, which is a field that exists in one and not the other.
 */

const SQL = readFileSync(
  path.resolve(__dirname, '../../../infra/db/001-initial.sql'),
  'utf8',
);

/**
 * The statements, with the prose taken out.
 *
 * Structural checks run against this rather than the whole file. Two of them
 * failed on their first run by matching a comment: the note explaining that
 * FLOAT is never right for money contains the word FLOAT, and a rule saying
 * "no floats here" that reads its own explanation is a rule that can only be
 * satisfied by not explaining itself.
 */
const CODE = SQL.replace(/--[^\n]*/g, '');

const tables = new Set(
  [...SQL.matchAll(/CREATE TABLE (\w+)/g)].map((match) => (match[1] as string).toLowerCase()),
);

/** Every column named in the file, as `table.column`. */
function columnsOf(table: string): Set<string> {
  const body = SQL.split(new RegExp(`CREATE TABLE ${table}\\s*\\(`, 'i'))[1] ?? '';
  const upTo = body.split(/\n\);/)[0] ?? '';
  return new Set(
    upTo
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('--') && !/^(PRIMARY|FOREIGN|UNIQUE|CHECK)\b/i.test(line))
      .map((line) => (line.split(/\s+/)[0] as string).toLowerCase()),
  );
}

describe('every part of the state has somewhere to live', () => {
  /**
   * Read off the state object rather than listed here, so a group added to
   * DemoState and forgotten in the schema fails this rather than being noticed
   * during the migration.
   */
  it('has a table for each group the state file holds', () => {
    blankState();
    const state = readState();

    const covers: Record<keyof typeof state, string> = {
      soldOut: 'product_availability',
      hidden: 'product_availability',
      services: 'store_services',
      orders: 'orders',
      sequence: 'orders',
      audit: 'audit_log',
      consoleLock: 'console_lock',
      payments: 'payment_intents',
      accounts: 'accounts',
      notifications: 'notifications_sent',
      fulfilment: 'fulfilment_handoffs',
      passwordResets: 'password_resets',
    };

    for (const key of Object.keys(state) as (keyof typeof state)[]) {
      const table = covers[key];
      expect(table, `DemoState.${String(key)} has no table named for it`).toBeTruthy();
      expect(tables.has(table), `${table} is not in the migration`).toBe(true);
    }
  });

  it('carries every field of an order', () => {
    const columns = columnsOf('orders');
    for (const field of [
      'id',
      'order_number',
      'store_id',
      'mode',
      'status',
      'cancelled_reason',
      'account_id',
      'customer_name',
      'customer_email',
      'customer_mobile',
      'placed_at',
      'eta_minutes',
      'promo_code',
      'address',
      'kitchen_note',
      'total_cents',
      'points_earned',
    ]) {
      expect(columns.has(field), `orders.${field} is missing`).toBe(true);
    }
  });

  it('carries every field of a payment intent', () => {
    const columns = columnsOf('payment_intents');
    for (const field of ['id', 'order_id', 'amount_cents', 'status', 'provider', 'provider_ref']) {
      expect(columns.has(field), `payment_intents.${field} is missing`).toBe(true);
    }
  });
});

describe('the rules the code enforces are enforced here too', () => {
  /**
   * The unique index that `register` has to check for twice. In the JSON store
   * two sign-ups racing on one address both see an empty result; here the
   * second insert simply fails, which is the difference between a stopgap and a
   * database.
   */
  it('makes one email address one account', () => {
    expect(SQL).toMatch(/email_key\s+TEXT NOT NULL UNIQUE/);
  });

  /** Two customers must never read the same number down a telephone. */
  it('makes an order number unique', () => {
    expect(SQL).toMatch(/order_number\s+TEXT NOT NULL UNIQUE/);
  });

  /** A second intent against an order already being paid is a double charge. */
  it('allows one payment intent per order', () => {
    expect(SQL).toMatch(/order_id\s+TEXT NOT NULL UNIQUE REFERENCES orders/);
  });

  /**
   * The idempotency key as a primary key rather than a list to search: a
   * redelivered callback becomes a duplicate insert, which fails, with no
   * read-then-write window between the check and the change.
   */
  it('makes a provider event id unrepeatable', () => {
    expect(SQL).toMatch(/CREATE TABLE payment_events_applied[\s\S]*?event_id\s+TEXT PRIMARY KEY/);
  });

  /**
   * Erasure keeps the sale. CASCADE here would delete a customer's orders along
   * with them, honouring POPIA §24 by breaching the obligation to retain
   * transaction records.
   */
  it('unlinks an erased customer from their orders rather than deleting them', () => {
    // Scoped to the orders table. An unscoped search matched
    // account_addresses, which cascades correctly — an address book belongs to
    // the person and should go with them; the sale should not.
    const orders = CODE.split(/CREATE TABLE orders\s*\(/)[1]?.split(/\n\);/)[0] ?? '';

    expect(orders).toMatch(/account_id\s+TEXT REFERENCES accounts\(id\) ON DELETE SET NULL/);
    expect(orders, 'orders must not cascade from accounts').not.toMatch(/ON DELETE CASCADE/);
  });

  it('does take the address book with the person, which is the opposite case', () => {
    const addresses = CODE.split(/CREATE TABLE account_addresses\s*\(/)[1]?.split(/\n\);/)[0] ?? '';
    expect(addresses).toMatch(/REFERENCES accounts\(id\) ON DELETE CASCADE/);
  });

  it('requires a reason for a cancellation, and forbids one otherwise', () => {
    expect(SQL).toMatch(/status = 'cancelled' AND cancelled_reason IS NOT NULL/);
    expect(SQL).toMatch(/status <> 'cancelled' AND cancelled_reason IS NULL/);
  });

  it('keeps money in integer cents and never in a float', () => {
    expect(CODE).not.toMatch(/\b(FLOAT|REAL|DOUBLE PRECISION)\b/i);
    for (const column of CODE.match(/\w*_cents\s+\w+/g) ?? []) {
      expect(column, `${column} is not an integer`).toMatch(/INTEGER/);
    }
  });

  it('will not store a negative amount of money', () => {
    const amounts = CODE.match(/\w*_cents\s+INTEGER NOT NULL[^,]*/g) ?? [];
    expect(amounts.length).toBeGreaterThan(0);
    for (const column of amounts) {
      expect(column, `${column} has no non-negative check`).toMatch(/CHECK \(\w+_cents >= 0\)/);
    }
  });

  /** The states the order machine allows, and no others. */
  it('constrains an order to the statuses the code knows', () => {
    for (const status of [
      'received',
      'preparing',
      'ready',
      'out_for_delivery',
      'completed',
      'cancelled',
    ]) {
      expect(SQL, `${status} is not an allowed status`).toContain(`'${status}'`);
    }
  });
});

describe('the migration itself', () => {
  it('creates every table it references', () => {
    for (const [, referenced] of CODE.matchAll(/REFERENCES (\w+)\(/g)) {
      expect(tables.has((referenced as string).toLowerCase()), `${referenced} is never created`).toBe(
        true,
      );
    }
  });

  it('indexes only tables it creates', () => {
    for (const [, table] of CODE.matchAll(/CREATE (?:UNIQUE )?INDEX \w+ ON (\w+)/g)) {
      expect(tables.has((table as string).toLowerCase()), `${table} is never created`).toBe(true);
    }
  });

  /** Applied in one transaction or not at all, so a failure leaves nothing behind. */
  it('does not drop anything', () => {
    expect(CODE, 'a first migration has nothing to drop').not.toMatch(/\bDROP\b/i);
  });
});
