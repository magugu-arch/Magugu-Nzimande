/**
 * Persistence with the guarantees the brief leans on: UNIQUE constraints
 * (idempotency keys, provider event ids, dedupe keys) and transactions that
 * roll back as a unit, so a state change and its outbox event commit together.
 *
 * In the browser sandbox this is in-memory and snapshotted to storage; in
 * production the same contract maps onto PostgreSQL tables and constraints
 * (see tashas/docs/ARCHITECTURE.md for the DDL).
 */

import type {
  AnalyticsEvent,
  AuditEntry,
  Booking,
  BookingAttempt,
  BookingEvent,
  BranchOverride,
  Campaign,
  EventBooking,
  Favourite,
  Guest,
  GuestConsent,
  GuestPreference,
  NotificationDelivery,
  NotificationRecord,
  OutboxRow,
  Payment,
  PaymentEvent,
  Refund,
  RewardLedgerEntry,
  SandboxGatewayPayment,
  SandboxHold,
  SandboxReservation,
  SandboxWebhook,
  Settings,
  StaffAlert,
  SuppressionEntry,
  Voucher,
} from './types.ts';
import { DomainError } from './util/core.ts';

export interface Schema {
  guests: Guest;
  bookingAttempts: BookingAttempt;
  bookings: Booking;
  bookingEvents: BookingEvent;
  payments: Payment;
  paymentEvents: PaymentEvent;
  refunds: Refund;
  guestConsents: GuestConsent;
  guestPreferences: GuestPreference;
  suppression: SuppressionEntry;
  notifications: NotificationRecord;
  notificationDeliveries: NotificationDelivery;
  rewardLedger: RewardLedgerEntry;
  vouchers: Voucher;
  campaigns: Campaign;
  outbox: OutboxRow;
  audit: AuditEntry;
  alerts: StaffAlert;
  eventBookings: EventBooking;
  analytics: AnalyticsEvent;
  favourites: Favourite;
  settings: Settings;
  branchOverrides: BranchOverride;
  sandboxReservations: SandboxReservation;
  sandboxHolds: SandboxHold;
  sandboxPayments: SandboxGatewayPayment;
  sandboxWebhooks: SandboxWebhook;
}

export type TableName = keyof Schema;

/** Fields that must be unique when present (null/undefined are not indexed). */
const UNIQUE: { [K in TableName]?: (keyof Schema[K] & string)[] } = {
  bookingAttempts: ['idempotencyKey'],
  bookings: ['reference'],
  bookingEvents: ['providerEventId'],
  payments: ['idempotencyKey', 'providerPaymentId'],
  paymentEvents: ['providerEventId'],
  refunds: ['idempotencyKey'],
  notifications: ['dedupeKey'],
  rewardLedger: ['idempotencyKey'],
  vouchers: ['code'],
  eventBookings: ['idempotencyKey', 'reference'],
  sandboxReservations: ['idempotencyKey'],
  sandboxPayments: ['idempotencyKey'],
};

const TABLES: TableName[] = [
  'guests',
  'bookingAttempts',
  'bookings',
  'bookingEvents',
  'payments',
  'paymentEvents',
  'refunds',
  'guestConsents',
  'guestPreferences',
  'suppression',
  'notifications',
  'notificationDeliveries',
  'rewardLedger',
  'vouchers',
  'campaigns',
  'outbox',
  'audit',
  'alerts',
  'eventBookings',
  'analytics',
  'favourites',
  'settings',
  'branchOverrides',
  'sandboxReservations',
  'sandboxHolds',
  'sandboxPayments',
  'sandboxWebhooks',
];

export class UniqueViolation extends DomainError {
  table: string;
  field: string;
  existingId: string;
  constructor(table: string, field: string, existingId: string) {
    super('unique_violation', `${table}.${field} must be unique`, { table, field, existingId });
    this.table = table;
    this.field = field;
    this.existingId = existingId;
  }
}

type Row = { id: string };
type Undo = { table: TableName; id: string; previous: Row | undefined };

export class Database {
  private tables = new Map<TableName, Map<string, Row>>();
  private indexes = new Map<string, Map<unknown, string>>();
  private undo: Undo[] | null = null;
  private depth = 0;
  private listeners = new Set<() => void>();
  version = 0;

  constructor() {
    for (const t of TABLES) this.tables.set(t, new Map());
  }

  private table(name: TableName): Map<string, Row> {
    return this.tables.get(name)!;
  }

  private indexFor(table: TableName, field: string): Map<unknown, string> {
    const key = `${table}.${field}`;
    let idx = this.indexes.get(key);
    if (!idx) {
      idx = new Map();
      for (const row of this.table(table).values()) {
        const v = (row as Record<string, unknown>)[field];
        if (v !== null && v !== undefined) idx.set(v, row.id);
      }
      this.indexes.set(key, idx);
    }
    return idx;
  }

  get<K extends TableName>(table: K, id: string): Schema[K] | undefined {
    return this.table(table).get(id) as Schema[K] | undefined;
  }

  require<K extends TableName>(table: K, id: string): Schema[K] {
    const row = this.get(table, id);
    if (!row) throw new DomainError('not_found', `${table} ${id} not found`);
    return row;
  }

  all<K extends TableName>(table: K): Schema[K][] {
    return [...this.table(table).values()] as Schema[K][];
  }

  where<K extends TableName>(table: K, predicate: (row: Schema[K]) => boolean): Schema[K][] {
    return this.all(table).filter(predicate);
  }

  /** Looks up a row by one of its unique fields. */
  byUnique<K extends TableName>(
    table: K,
    field: keyof Schema[K] & string,
    value: unknown,
  ): Schema[K] | undefined {
    const id = this.indexFor(table, field).get(value);
    return id === undefined ? undefined : this.get(table, id);
  }

  insert<K extends TableName>(table: K, row: Schema[K]): Schema[K] {
    return this.transaction(() => {
      if (this.table(table).has(row.id)) throw new UniqueViolation(table, 'id', row.id);
      this.checkUnique(table, row);
      this.write(table, row.id, row);
      return row;
    });
  }

  update<K extends TableName>(
    table: K,
    id: string,
    patch: Partial<Schema[K]> | ((row: Schema[K]) => Schema[K]),
  ): Schema[K] {
    return this.transaction(() => {
      const current = this.require(table, id);
      const next =
        typeof patch === 'function' ? patch(current) : ({ ...current, ...patch } as Schema[K]);
      if (next.id !== id) throw new DomainError('invalid_update', 'id cannot change');
      this.checkUnique(table, next);
      this.write(table, id, next);
      return next;
    });
  }

  upsert<K extends TableName>(table: K, row: Schema[K]): Schema[K] {
    return this.get(table, row.id) ? this.update(table, row.id, () => row) : this.insert(table, row);
  }

  delete<K extends TableName>(table: K, id: string): void {
    this.transaction(() => {
      if (this.table(table).has(id)) this.write(table, id, undefined);
    });
  }

  private checkUnique(table: TableName, next: Row): void {
    for (const field of (UNIQUE[table] ?? []) as string[]) {
      const value = (next as unknown as Record<string, unknown>)[field];
      if (value === null || value === undefined) continue;
      const owner = this.indexFor(table, field).get(value);
      if (owner !== undefined && owner !== next.id) throw new UniqueViolation(table, field, owner);
    }
  }

  private write(table: TableName, id: string, row: Row | undefined): void {
    const map = this.table(table);
    const previous = map.get(id);
    this.undo?.push({ table, id, previous });
    for (const field of (UNIQUE[table] ?? []) as string[]) {
      const idx = this.indexFor(table, field);
      const before = previous ? (previous as unknown as Record<string, unknown>)[field] : undefined;
      const after = row ? (row as unknown as Record<string, unknown>)[field] : undefined;
      if (before !== undefined && before !== null && idx.get(before) === id) idx.delete(before);
      if (after !== undefined && after !== null) idx.set(after, id);
    }
    if (row) map.set(id, Object.freeze(row));
    else map.delete(id);
  }

  /**
   * Runs `fn` atomically. Nested calls join the outer transaction; a throw
   * anywhere rolls back every write since the outermost call began.
   */
  transaction<T>(fn: () => T): T {
    const outermost = this.depth === 0;
    if (outermost) this.undo = [];
    this.depth++;
    try {
      const result = fn();
      this.depth--;
      if (outermost) {
        const changed = this.undo!.length > 0;
        this.undo = null;
        if (changed) this.emit();
      }
      return result;
    } catch (err) {
      this.depth--;
      if (outermost) {
        const log = this.undo!;
        this.undo = null;
        for (let i = log.length - 1; i >= 0; i--) {
          const { table, id, previous } = log[i]!;
          this.write(table, id, previous);
        }
      }
      throw err;
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  toJSON(): Record<string, Row[]> {
    const out: Record<string, Row[]> = {};
    for (const t of TABLES) out[t] = [...this.table(t).values()];
    return out;
  }

  load(snapshot: Record<string, Row[]>): void {
    for (const t of TABLES) {
      const map = new Map<string, Row>();
      for (const row of snapshot[t] ?? []) map.set(row.id, Object.freeze(row));
      this.tables.set(t, map);
    }
    this.indexes.clear();
    this.emit();
  }

  clear(): void {
    this.load({});
  }
}
