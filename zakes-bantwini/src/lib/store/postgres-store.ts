import pg from 'pg';
import { TABLES, UniqueViolation, type Query, type Rows, type Store, type Table } from './types';

// DATE columns come back as plain YYYY-MM-DD strings rather than local-midnight
// Date objects; BIGINT (cents) as numbers — amounts stay far below 2^53.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => new Date(v).toISOString());

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function columnsOf(table: Table): Record<string, string> {
  return TABLES[table].columns as Record<string, string>;
}

/** Only whitelisted column names ever reach SQL text; values are always parameters. */
function col(table: Table, field: string): string {
  if (!(field in columnsOf(table))) throw new Error(`Unknown column ${table}.${field}`);
  return `"${snake(field)}"`;
}

function toDb(table: Table, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const cols = columnsOf(table);
  for (const [k, v] of Object.entries(row)) {
    if (!(k in cols) || v === undefined) continue;
    out[k] = cols[k] === 'json' && v !== null ? JSON.stringify(v) : v;
  }
  return out;
}

function fromDb<T extends Table>(table: T, row: Record<string, unknown>): Rows[T] {
  const out: Record<string, unknown> = {};
  for (const field of Object.keys(columnsOf(table))) out[field] = row[snake(field)] ?? null;
  return out as Rows[T];
}

function where<T extends Table>(table: T, query: Pick<Query<Rows[T]>, 'where' | 'in' | 'range'>, params: unknown[]): string {
  const clauses: string[] = [];
  for (const [k, v] of Object.entries(query.where ?? {})) {
    if (v === null) clauses.push(`${col(table, k)} IS NULL`);
    else {
      params.push(v);
      clauses.push(`${col(table, k)} = $${params.length}`);
    }
  }
  if (query.range) {
    const c = col(table, query.range.field);
    if (query.range.from !== undefined) {
      params.push(query.range.from);
      clauses.push(`${c} >= $${params.length}`);
    }
    if (query.range.to !== undefined) {
      params.push(query.range.to);
      clauses.push(`${c} <= $${params.length}`);
    }
  }
  if (query.in) {
    params.push(query.in.values);
    clauses.push(`${col(table, query.in.field)}::text = ANY($${params.length})`);
  }
  return clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
}

export class PostgresStore implements Store {
  readonly kind = 'postgres' as const;
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    // TLS is configured in the connection string (`?sslmode=require` for
    // Supabase and most hosted Postgres), never by disabling verification here.
    this.pool = new pg.Pool({ connectionString, max: Number(process.env.DATABASE_POOL_MAX ?? 5) });
  }

  private async run(sql: string, params: unknown[] = []) {
    try {
      return await this.pool.query(sql, params);
    } catch (error) {
      const e = error as { code?: string; table?: string; constraint?: string };
      if (e.code === '23505') throw new UniqueViolation(e.table ?? 'unknown', e.constraint ?? 'unique');
      throw error;
    }
  }

  async insert<T extends Table>(table: T, row: Rows[T]): Promise<Rows[T]> {
    const data = toDb(table, row as Record<string, unknown>);
    const fields = Object.keys(data);
    const sql = `INSERT INTO ${table} (${fields.map((f) => col(table, f)).join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
    const res = await this.run(sql, Object.values(data));
    return fromDb(table, res.rows[0]);
  }

  async upsert<T extends Table>(table: T, row: Rows[T]): Promise<Rows[T]> {
    const data = toDb(table, row as Record<string, unknown>);
    const fields = Object.keys(data);
    const key = TABLES[table].key as string;
    const updates = fields.filter((f) => f !== key).map((f) => `${col(table, f)} = EXCLUDED.${col(table, f)}`);
    const sql = `INSERT INTO ${table} (${fields.map((f) => col(table, f)).join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (${col(table, key)}) DO UPDATE SET ${updates.join(', ')} RETURNING *`;
    const res = await this.run(sql, Object.values(data));
    return fromDb(table, res.rows[0]);
  }

  async update<T extends Table>(table: T, keyValue: string, patch: Partial<Rows[T]>): Promise<Rows[T] | null> {
    const data = toDb(table, patch as Record<string, unknown>);
    const fields = Object.keys(data);
    if (fields.length === 0) return this.get(table, keyValue);
    const key = TABLES[table].key as string;
    const sets = fields.map((f, i) => `${col(table, f)} = $${i + 1}`);
    const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE ${col(table, key)} = $${fields.length + 1} RETURNING *`;
    const res = await this.run(sql, [...Object.values(data), keyValue]);
    return res.rows[0] ? fromDb(table, res.rows[0]) : null;
  }

  async get<T extends Table>(table: T, keyValue: string): Promise<Rows[T] | null> {
    const key = TABLES[table].key as string;
    const res = await this.run(`SELECT * FROM ${table} WHERE ${col(table, key)} = $1`, [keyValue]);
    return res.rows[0] ? fromDb(table, res.rows[0]) : null;
  }

  async findOne<T extends Table>(table: T, w: Partial<Rows[T]>): Promise<Rows[T] | null> {
    const [row] = await this.list(table, { where: w, limit: 1 });
    return row ?? null;
  }

  async list<T extends Table>(table: T, query: Query<Rows[T]> = {}): Promise<Rows[T][]> {
    const params: unknown[] = [];
    let sql = `SELECT * FROM ${table}${where(table, query, params)}`;
    if (query.orderBy) sql += ` ORDER BY ${col(table, query.orderBy.field)} ${query.orderBy.dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST`;
    if (query.limit !== undefined) {
      params.push(query.limit);
      sql += ` LIMIT $${params.length}`;
    }
    const res = await this.run(sql, params);
    return res.rows.map((r) => fromDb(table, r));
  }

  async count<T extends Table>(table: T, query: Pick<Query<Rows[T]>, 'where' | 'in' | 'range'> = {}): Promise<number> {
    const params: unknown[] = [];
    const res = await this.run(`SELECT COUNT(*)::int AS n FROM ${table}${where(table, query, params)}`, params);
    return res.rows[0].n as number;
  }

  async remove<T extends Table>(table: T, keyValue: string): Promise<boolean> {
    const key = TABLES[table].key as string;
    const res = await this.run(`DELETE FROM ${table} WHERE ${col(table, key)} = $1`, [keyValue]);
    return (res.rowCount ?? 0) > 0;
  }

  async nextReferenceNumber(year: number): Promise<number> {
    const res = await this.run(
      `INSERT INTO reference_counters (year, last_value) VALUES ($1, 1)
       ON CONFLICT (year) DO UPDATE SET last_value = reference_counters.last_value + 1
       RETURNING last_value`,
      [year],
    );
    return res.rows[0].last_value as number;
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}
