/**
 * Where the API server keeps its state.
 *
 * - `SqlStore`: PostgreSQL (server/migrations 001 + 002). Works with a
 *   `pg.Client` in production and PGlite in the schema check.
 * - `FileStore`: a JSON file, for a laptop or a single small VM.
 * - `MemoryStore`: tests.
 *
 * The service layer's rows are written through after every call — only the
 * rows that changed — inside one transaction.
 */
import fs from 'node:fs';
import path from 'node:path';

export type RowChanges = Record<string, { upserts: { id: string }[]; deletes: string[] }>;

export interface OtpRecord {
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  sentAt: string;
}

export interface SessionRecord {
  tokenHash: string;
  guestId: string;
  createdAt: string;
  /** Idle expiry: extended while the session is used. */
  expiresAt: string;
  lastSeenAt: string;
  /** Hard expiry: never extended, so a stolen token cannot live forever. */
  absoluteExpiresAt?: string;
  /** The role this session was opened for; staff sessions are short-lived. */
  role?: string;
  /** "Mábu app on iPhone" — for the guest's own list of sign-ins. */
  label?: string;
  /** A salted hash of the address it was opened from. The address is not kept. */
  ipHash?: string;
}

export interface ServerStore {
  loadRows(): Promise<Record<string, unknown[]>>;
  saveChanges(changes: RowChanges): Promise<void>;
  getOtp(email: string): Promise<OtpRecord | undefined>;
  putOtp(record: OtpRecord): Promise<void>;
  deleteOtp(email: string): Promise<void>;
  getSession(tokenHash: string): Promise<SessionRecord | undefined>;
  putSession(record: SessionRecord): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  /** Every live session for one guest, for the sign-ins list. */
  listSessions(guestId: string): Promise<SessionRecord[]>;
  /** Ends every session for a guest, optionally sparing the one in hand. */
  deleteSessionsFor(guestId: string, exceptTokenHash?: string): Promise<number>;
  close?(): Promise<void>;
}

/* ── Memory ─────────────────────────────────────────────────────────────── */

export class MemoryStore implements ServerStore {
  rows = new Map<string, Map<string, unknown>>();
  otps = new Map<string, OtpRecord>();
  sessions = new Map<string, SessionRecord>();

  async loadRows() {
    const out: Record<string, unknown[]> = {};
    for (const [table, rows] of this.rows) out[table] = [...rows.values()];
    return out;
  }
  async saveChanges(changes: RowChanges) {
    for (const [table, { upserts, deletes }] of Object.entries(changes)) {
      const rows = this.rows.get(table) ?? new Map<string, unknown>();
      for (const row of upserts) rows.set(row.id, row);
      for (const id of deletes) rows.delete(id);
      this.rows.set(table, rows);
    }
  }
  async getOtp(email: string) {
    return this.otps.get(email.toLowerCase());
  }
  async putOtp(record: OtpRecord) {
    this.otps.set(record.email.toLowerCase(), record);
  }
  async deleteOtp(email: string) {
    this.otps.delete(email.toLowerCase());
  }
  async getSession(tokenHash: string) {
    return this.sessions.get(tokenHash);
  }
  async putSession(record: SessionRecord) {
    this.sessions.set(record.tokenHash, record);
  }
  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }
  async listSessions(guestId: string) {
    return [...this.sessions.values()].filter((s) => s.guestId === guestId);
  }
  async deleteSessionsFor(guestId: string, exceptTokenHash?: string) {
    let removed = 0;
    for (const [hash, s] of this.sessions) {
      if (s.guestId !== guestId || hash === exceptTokenHash) continue;
      this.sessions.delete(hash);
      removed += 1;
    }
    return removed;
  }
}

/* ── File ───────────────────────────────────────────────────────────────── */

/** A MemoryStore flushed to one JSON file, written atomically (temp file + rename). */
export class FileStore extends MemoryStore {
  constructor(private readonly file: string) {
    super();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        rows: Record<string, Record<string, unknown>>;
        otps: Record<string, OtpRecord>;
        sessions: Record<string, SessionRecord>;
      };
      for (const [table, rows] of Object.entries(data.rows ?? {}))
        this.rows.set(table, new Map(Object.entries(rows)));
      this.otps = new Map(Object.entries(data.otps ?? {}));
      this.sessions = new Map(Object.entries(data.sessions ?? {}));
    }
  }

  private flush() {
    const rows: Record<string, Record<string, unknown>> = {};
    for (const [table, map] of this.rows) rows[table] = Object.fromEntries(map);
    const body = JSON.stringify({
      rows,
      otps: Object.fromEntries(this.otps),
      sessions: Object.fromEntries(this.sessions),
    });
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, this.file);
  }

  override async saveChanges(changes: RowChanges) {
    await super.saveChanges(changes);
    this.flush();
  }
  override async putOtp(record: OtpRecord) {
    await super.putOtp(record);
    this.flush();
  }
  override async deleteOtp(email: string) {
    await super.deleteOtp(email);
    this.flush();
  }
  override async putSession(record: SessionRecord) {
    await super.putSession(record);
    this.flush();
  }
  override async deleteSession(tokenHash: string) {
    await super.deleteSession(tokenHash);
    this.flush();
  }
  override async deleteSessionsFor(guestId: string, exceptTokenHash?: string) {
    const removed = await super.deleteSessionsFor(guestId, exceptTokenHash);
    if (removed) this.flush();
    return removed;
  }
}

/* ── PostgreSQL ─────────────────────────────────────────────────────────── */

/** The one method both `pg.Client` and PGlite provide. */
export interface SqlClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

export class SqlStore implements ServerStore {
  close?: () => Promise<void>;
  constructor(private readonly sql: SqlClient) {}

  async loadRows() {
    const { rows } = await this.sql.query('SELECT table_name, document FROM server_row');
    const out: Record<string, unknown[]> = {};
    for (const r of rows) {
      const table = String(r.table_name);
      const doc = typeof r.document === 'string' ? JSON.parse(r.document) : r.document;
      (out[table] ??= []).push(doc);
    }
    return out;
  }

  async saveChanges(changes: RowChanges) {
    const entries = Object.entries(changes);
    if (!entries.length) return;
    await this.sql.query('BEGIN');
    try {
      for (const [table, { upserts, deletes }] of entries) {
        for (const row of upserts) {
          await this.sql.query(
            `INSERT INTO server_row (table_name, id, document, updated_at)
             VALUES ($1, $2, $3::jsonb, now())
             ON CONFLICT (table_name, id) DO UPDATE SET document = EXCLUDED.document, updated_at = now()`,
            [table, row.id, JSON.stringify(row)],
          );
        }
        if (deletes.length) {
          await this.sql.query('DELETE FROM server_row WHERE table_name = $1 AND id = ANY($2)', [
            table,
            deletes,
          ]);
        }
      }
      await this.sql.query('COMMIT');
    } catch (error) {
      await this.sql.query('ROLLBACK');
      throw error;
    }
  }

  async getOtp(email: string) {
    const { rows } = await this.sql.query('SELECT * FROM server_otp WHERE email = $1', [email]);
    const r = rows[0];
    return r
      ? {
          email: String(r.email),
          codeHash: String(r.code_hash),
          expiresAt: iso(r.expires_at),
          attempts: Number(r.attempts),
          sentAt: iso(r.sent_at),
        }
      : undefined;
  }
  async putOtp(o: OtpRecord) {
    await this.sql.query(
      `INSERT INTO server_otp (email, code_hash, expires_at, attempts, sent_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at, attempts = EXCLUDED.attempts, sent_at = EXCLUDED.sent_at`,
      [o.email, o.codeHash, o.expiresAt, o.attempts, o.sentAt],
    );
  }
  async deleteOtp(email: string) {
    await this.sql.query('DELETE FROM server_otp WHERE email = $1', [email]);
  }
  async getSession(tokenHash: string) {
    const { rows } = await this.sql.query('SELECT * FROM server_session WHERE token_hash = $1', [
      tokenHash,
    ]);
    return rows[0] ? sessionOf(rows[0]) : undefined;
  }
  async putSession(s: SessionRecord) {
    await this.sql.query(
      `INSERT INTO server_session (token_hash, guest_id, created_at, expires_at, last_seen_at,
         absolute_expires_at, role, label, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (token_hash) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at,
         expires_at = EXCLUDED.expires_at`,
      [
        s.tokenHash,
        s.guestId,
        s.createdAt,
        s.expiresAt,
        s.lastSeenAt,
        s.absoluteExpiresAt ?? null,
        s.role ?? null,
        s.label ?? null,
        s.ipHash ?? null,
      ],
    );
  }
  async deleteSession(tokenHash: string) {
    await this.sql.query('DELETE FROM server_session WHERE token_hash = $1', [tokenHash]);
  }
  async listSessions(guestId: string) {
    const { rows } = await this.sql.query('SELECT * FROM server_session WHERE guest_id = $1', [
      guestId,
    ]);
    return rows.map(sessionOf);
  }
  async deleteSessionsFor(guestId: string, exceptTokenHash?: string) {
    const { rows } = await this.sql.query(
      `DELETE FROM server_session WHERE guest_id = $1 AND token_hash <> COALESCE($2, '')
       RETURNING token_hash`,
      [guestId, exceptTokenHash ?? null],
    );
    return rows.length;
  }
}

function sessionOf(r: Record<string, unknown>): SessionRecord {
  return {
    tokenHash: String(r.token_hash),
    guestId: String(r.guest_id),
    createdAt: iso(r.created_at),
    expiresAt: iso(r.expires_at),
    lastSeenAt: iso(r.last_seen_at),
    absoluteExpiresAt: r.absolute_expires_at ? iso(r.absolute_expires_at) : undefined,
    role: r.role ? String(r.role) : undefined,
    label: r.label ? String(r.label) : undefined,
    ipHash: r.ip_hash ? String(r.ip_hash) : undefined,
  };
}
