import { DomainError } from './errors';

/**
 * A typed in-memory table. The mock backend persists a snapshot of every table
 * to device storage; a production server swaps this for PostgreSQL through
 * the same shape (see server/migrations). Rows are stored as frozen copies so
 * a caller mutating a returned object cannot silently change the database.
 */
export class Table<T extends { id: string }> {
  private rows = new Map<string, T>();

  constructor(readonly name: string) {}

  get(id: string): T | undefined {
    const row = this.rows.get(id);
    return row ? clone(row) : undefined;
  }

  require(id: string, what = this.name): T {
    const row = this.get(id);
    if (!row)
      throw new DomainError('NOT_FOUND', `We could not find that ${what}.`, `${this.name}:${id}`);
    return row;
  }

  has(id: string): boolean {
    return this.rows.has(id);
  }

  insert(row: T): T {
    if (this.rows.has(row.id)) {
      throw new DomainError('CONFLICT', 'That record already exists.', `${this.name}:${row.id}`);
    }
    this.rows.set(row.id, clone(row));
    return clone(row);
  }

  upsert(row: T): T {
    this.rows.set(row.id, clone(row));
    return clone(row);
  }

  update(id: string, patch: Partial<T> | ((row: T) => T)): T {
    const current = this.require(id);
    const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
    this.rows.set(id, clone({ ...next, id }));
    return clone(next);
  }

  delete(id: string): void {
    this.rows.delete(id);
  }

  list(): T[] {
    return [...this.rows.values()].map(clone);
  }

  filter(predicate: (row: T) => boolean): T[] {
    return this.list().filter(predicate);
  }

  find(predicate: (row: T) => boolean): T | undefined {
    for (const row of this.rows.values()) if (predicate(row)) return clone(row);
    return undefined;
  }

  count(predicate?: (row: T) => boolean): number {
    if (!predicate) return this.rows.size;
    let n = 0;
    for (const row of this.rows.values()) if (predicate(row)) n += 1;
    return n;
  }

  toJSON(): T[] {
    return [...this.rows.values()];
  }

  load(rows: T[]): void {
    this.rows = new Map(rows.map((r) => [r.id, clone(r)]));
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
