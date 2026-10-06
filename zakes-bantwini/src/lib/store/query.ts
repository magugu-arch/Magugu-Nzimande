import type { Query, Table } from './types';

/** Columns that must be unique, enforced identically by both stores. */
export const UNIQUE: Partial<Record<Table, string[]>> = {
  bookings: ['reference', 'portalTokenHash'],
  payments: ['merchantReference'],
  admin_users: ['email'],
};

/** In-memory evaluation of a Query — the file store's whole query engine. */
export function applyQuery<R extends object>(rows: R[], query: Query<R> = {}): R[] {
  let out = rows.filter((row) => {
    const r = row as Record<string, unknown>;
    if (query.where) {
      for (const [k, v] of Object.entries(query.where)) {
        if (r[k] !== v) return false;
      }
    }
    if (query.range) {
      const value = r[query.range.field];
      if (value === null || value === undefined) return false;
      const s = String(value);
      if (query.range.from !== undefined && s < query.range.from) return false;
      if (query.range.to !== undefined && s > query.range.to) return false;
    }
    if (query.in && !query.in.values.includes(String(r[query.in.field]))) return false;
    return true;
  });
  if (query.orderBy) {
    const { field, dir } = query.orderBy;
    const sign = dir === 'asc' ? 1 : -1;
    out = [...out].sort((a, b) => {
      const x = (a as Record<string, unknown>)[field];
      const y = (b as Record<string, unknown>)[field];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (x < y ? -1 : 1) * sign;
    });
  }
  if (query.limit !== undefined) out = out.slice(0, query.limit);
  return out;
}
