import type {
  AdminUser,
  AuditEntry,
  AvailabilityEntry,
  Booking,
  CollaborationRequest,
  CommunitySignup,
  Contract,
  Customer,
  DocumentRecord,
  EventRecord,
  InternalNote,
  NotificationRecord,
  Payment,
  Quote,
} from '@/lib/booking/types';
import type { ContentEntry, PublicAsset } from '@/lib/cms/types';

export type Rows = {
  customers: Customer;
  bookings: Booking;
  events: EventRecord;
  availability: AvailabilityEntry;
  quotes: Quote;
  contracts: Contract;
  payments: Payment;
  notifications: NotificationRecord;
  documents: DocumentRecord;
  admin_users: AdminUser;
  internal_notes: InternalNote;
  audit_log: AuditEntry;
  community_signups: CommunitySignup;
  collaboration_requests: CollaborationRequest;
  content_entries: ContentEntry;
  public_assets: PublicAsset;
};

export type Table = keyof Rows;

type ColumnType = 'text' | 'int' | 'bigint' | 'bool' | 'json' | 'date' | 'timestamptz';

/**
 * Column definitions shared by both stores. The Postgres store uses them to
 * build parameterised SQL against a fixed whitelist (field names never come
 * from user input), and they mirror db/migrations/0001_init.sql.
 */
export const TABLES: { [T in Table]: { key: keyof Rows[T] & string; columns: { [K in keyof Rows[T]]-?: ColumnType } } } = {
  customers: {
    key: 'id',
    columns: { id: 'text', fullName: 'text', organisation: 'text', email: 'text', phone: 'text', whatsappOptIn: 'bool', createdAt: 'timestamptz' },
  },
  bookings: {
    key: 'id',
    columns: {
      id: 'text',
      reference: 'text',
      customerId: 'text',
      eventId: 'text',
      status: 'text',
      eventType: 'text',
      performanceFormat: 'text',
      budgetRange: 'text',
      expectedAttendance: 'int',
      travelRequired: 'bool',
      travelNotes: 'text',
      accommodationRequired: 'bool',
      accommodationNotes: 'text',
      productionNotes: 'text',
      additionalInfo: 'text',
      portalTokenHash: 'text',
      holdExpiresAt: 'timestamptz',
      createdAt: 'timestamptz',
      updatedAt: 'timestamptz',
    },
  },
  events: {
    key: 'id',
    columns: {
      id: 'text',
      bookingId: 'text',
      kind: 'text',
      title: 'text',
      date: 'date',
      startTime: 'text',
      endTime: 'text',
      venue: 'text',
      city: 'text',
      country: 'text',
      ticketUrl: 'text',
      description: 'text',
      published: 'bool',
      createdAt: 'timestamptz',
      updatedAt: 'timestamptz',
    },
  },
  availability: {
    key: 'date',
    columns: { date: 'date', state: 'text', bookingId: 'text', note: 'text', updatedAt: 'timestamptz', updatedBy: 'text' },
  },
  quotes: {
    key: 'id',
    columns: {
      id: 'text',
      bookingId: 'text',
      version: 'int',
      status: 'text',
      currency: 'text',
      lines: 'json',
      taxApplicable: 'bool',
      taxRateBps: 'int',
      subtotalCents: 'bigint',
      taxCents: 'bigint',
      totalCents: 'bigint',
      depositPercent: 'int',
      depositCents: 'bigint',
      balanceCents: 'bigint',
      depositDueDate: 'date',
      balanceDueDate: 'date',
      validUntil: 'date',
      cancellationTerms: 'text',
      clientMessage: 'text',
      clientResponseNote: 'text',
      createdAt: 'timestamptz',
      sentAt: 'timestamptz',
      respondedAt: 'timestamptz',
    },
  },
  contracts: {
    key: 'id',
    columns: {
      id: 'text',
      bookingId: 'text',
      quoteId: 'text',
      status: 'text',
      terms: 'text',
      termsHash: 'text',
      signerName: 'text',
      signerIpHash: 'text',
      signedAt: 'timestamptz',
      sentAt: 'timestamptz',
      createdAt: 'timestamptz',
    },
  },
  payments: {
    key: 'id',
    columns: {
      id: 'text',
      bookingId: 'text',
      quoteId: 'text',
      kind: 'text',
      provider: 'text',
      merchantReference: 'text',
      providerReference: 'text',
      amountCents: 'bigint',
      currency: 'text',
      status: 'text',
      createdAt: 'timestamptz',
      updatedAt: 'timestamptz',
    },
  },
  notifications: {
    key: 'id',
    columns: {
      id: 'text',
      bookingId: 'text',
      event: 'text',
      channel: 'text',
      audience: 'text',
      recipient: 'text',
      status: 'text',
      provider: 'text',
      providerId: 'text',
      error: 'text',
      createdAt: 'timestamptz',
    },
  },
  documents: {
    key: 'id',
    columns: {
      id: 'text',
      bookingId: 'text',
      kind: 'text',
      filename: 'text',
      contentType: 'text',
      size: 'int',
      storageKey: 'text',
      uploadedBy: 'text',
      clientVisible: 'bool',
      createdAt: 'timestamptz',
    },
  },
  admin_users: {
    key: 'id',
    columns: { id: 'text', email: 'text', name: 'text', role: 'text', passwordHash: 'text', createdAt: 'timestamptz', lastLoginAt: 'timestamptz' },
  },
  internal_notes: {
    key: 'id',
    columns: { id: 'text', bookingId: 'text', authorId: 'text', authorName: 'text', body: 'text', createdAt: 'timestamptz' },
  },
  audit_log: {
    key: 'id',
    columns: { id: 'text', bookingId: 'text', actor: 'text', action: 'text', detail: 'json', createdAt: 'timestamptz' },
  },
  community_signups: {
    key: 'id',
    columns: {
      id: 'text',
      email: 'text',
      phone: 'text',
      emailConsent: 'bool',
      whatsappConsent: 'bool',
      consentText: 'text',
      source: 'text',
      createdAt: 'timestamptz',
    },
  },
  collaboration_requests: {
    key: 'id',
    columns: {
      id: 'text',
      type: 'text',
      name: 'text',
      organisation: 'text',
      email: 'text',
      phone: 'text',
      timeline: 'text',
      budget: 'text',
      message: 'text',
      status: 'text',
      createdAt: 'timestamptz',
    },
  },
  content_entries: {
    key: 'id',
    columns: { id: 'text', collection: 'text', slug: 'text', data: 'json', archived: 'bool', createdAt: 'timestamptz', updatedAt: 'timestamptz', updatedBy: 'text' },
  },
  public_assets: {
    key: 'id',
    columns: {
      id: 'text',
      kind: 'text',
      filename: 'text',
      contentType: 'text',
      size: 'int',
      storageKey: 'text',
      width: 'int',
      height: 'int',
      label: 'text',
      uploadedBy: 'text',
      createdAt: 'timestamptz',
    },
  },
};

export type Query<R> = {
  where?: Partial<R>;
  /** Inclusive range on one column, compared as strings (ISO dates sort correctly). */
  range?: { field: keyof R & string; from?: string; to?: string };
  /** Column value is one of these. */
  in?: { field: keyof R & string; values: readonly string[] };
  orderBy?: { field: keyof R & string; dir: 'asc' | 'desc' };
  limit?: number;
};

export class UniqueViolation extends Error {
  constructor(table: string, detail: string) {
    super(`Unique constraint on ${table}: ${detail}`);
    this.name = 'UniqueViolation';
  }
}

/**
 * Persistence boundary. Two implementations: Postgres for production
 * (DATABASE_URL) and a JSON file for local development and tests.
 */
export interface Store {
  readonly kind: 'postgres' | 'file';
  insert<T extends Table>(table: T, row: Rows[T]): Promise<Rows[T]>;
  /** Insert or replace by key. */
  upsert<T extends Table>(table: T, row: Rows[T]): Promise<Rows[T]>;
  update<T extends Table>(table: T, key: string, patch: Partial<Rows[T]>): Promise<Rows[T] | null>;
  get<T extends Table>(table: T, key: string): Promise<Rows[T] | null>;
  findOne<T extends Table>(table: T, where: Partial<Rows[T]>): Promise<Rows[T] | null>;
  list<T extends Table>(table: T, query?: Query<Rows[T]>): Promise<Rows[T][]>;
  count<T extends Table>(table: T, query?: Pick<Query<Rows[T]>, 'where' | 'in' | 'range'>): Promise<number>;
  remove<T extends Table>(table: T, key: string): Promise<boolean>;
  /** Atomic per-year counter behind ZB-YYYY-XXXX references. */
  nextReferenceNumber(year: number): Promise<number>;
  /**
   * Run `fn` against a store whose writes all land or none do. Everything in
   * `fn` must go through `tx` — and nothing slow or external belongs inside
   * (send messages after it returns). Nested calls join the outer one.
   */
  transaction<R>(fn: (tx: Store) => Promise<R>): Promise<R>;
}
