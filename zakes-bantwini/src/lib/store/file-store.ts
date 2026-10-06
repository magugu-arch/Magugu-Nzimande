import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { applyQuery, UNIQUE } from './query';
import { TABLES, UniqueViolation, type Query, type Rows, type Store, type Table } from './types';

type Data = { [T in Table]: Rows[T][] } & { counters: Record<string, number> };

function empty(): Data {
  const data = { counters: {} } as Data;
  for (const t of Object.keys(TABLES) as Table[]) (data as Record<string, unknown>)[t] = [];
  return data;
}

/**
 * A JSON file standing in for Postgres in local development, previews on a
 * single long-running server, and tests. Writes are serialised and atomic
 * (temp file + rename). Not for serverless production: each instance would
 * have its own file. `getStore()` refuses to use it in production unless
 * ALLOW_FILE_STORE=true is set deliberately.
 */
export class FileStore implements Store {
  readonly kind = 'file' as const;
  private data: Data | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string | null) {}

  private async load(): Promise<Data> {
    if (this.data) return this.data;
    const fresh = empty();
    if (this.file) {
      try {
        const parsed = JSON.parse(await readFile(this.file, 'utf8')) as Partial<Data>;
        this.data = { ...fresh, ...parsed, counters: parsed.counters ?? {} };
        return this.data;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    this.data = fresh;
    return this.data;
  }

  private async persist(): Promise<void> {
    if (!this.file || !this.data) return;
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(this.data));
    await rename(tmp, this.file);
  }

  /** Run mutations one at a time so concurrent requests cannot interleave. */
  private exclusive<R>(fn: (data: Data) => R | Promise<R>): Promise<R> {
    const run = this.chain.then(async () => {
      const data = await this.load();
      const result = await fn(data);
      await this.persist();
      return result;
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  private checkUnique<T extends Table>(data: Data, table: T, row: Rows[T], ignoreKey?: string) {
    const key = TABLES[table].key as string;
    for (const col of UNIQUE[table] ?? []) {
      const value = (row as Record<string, unknown>)[col];
      if (value === null || value === undefined) continue;
      const clash = (data[table] as Record<string, unknown>[]).find((r) => r[col] === value && r[key] !== ignoreKey);
      if (clash) throw new UniqueViolation(table, col);
    }
  }

  insert<T extends Table>(table: T, row: Rows[T]): Promise<Rows[T]> {
    return this.exclusive((data) => {
      const key = TABLES[table].key as string;
      const id = (row as Record<string, unknown>)[key];
      if ((data[table] as Record<string, unknown>[]).some((r) => r[key] === id)) throw new UniqueViolation(table, key);
      this.checkUnique(data, table, row);
      (data[table] as Rows[T][]).push(structuredClone(row));
      return structuredClone(row);
    });
  }

  upsert<T extends Table>(table: T, row: Rows[T]): Promise<Rows[T]> {
    return this.exclusive((data) => {
      const key = TABLES[table].key as string;
      const id = (row as Record<string, unknown>)[key] as string;
      this.checkUnique(data, table, row, id);
      const rows = data[table] as Rows[T][];
      const i = rows.findIndex((r) => (r as Record<string, unknown>)[key] === id);
      if (i === -1) rows.push(structuredClone(row));
      else rows[i] = structuredClone(row);
      return structuredClone(row);
    });
  }

  update<T extends Table>(table: T, keyValue: string, patch: Partial<Rows[T]>): Promise<Rows[T] | null> {
    return this.exclusive((data) => {
      const key = TABLES[table].key as string;
      const rows = data[table] as Rows[T][];
      const i = rows.findIndex((r) => (r as Record<string, unknown>)[key] === keyValue);
      if (i === -1) return null;
      const next = { ...rows[i]!, ...structuredClone(patch) } as Rows[T];
      this.checkUnique(data, table, next, keyValue);
      rows[i] = next;
      return structuredClone(next);
    });
  }

  async get<T extends Table>(table: T, keyValue: string): Promise<Rows[T] | null> {
    const data = await this.load();
    const key = TABLES[table].key as string;
    const row = (data[table] as Rows[T][]).find((r) => (r as Record<string, unknown>)[key] === keyValue);
    return row ? structuredClone(row) : null;
  }

  async findOne<T extends Table>(table: T, where: Partial<Rows[T]>): Promise<Rows[T] | null> {
    const [row] = await this.list(table, { where, limit: 1 });
    return row ?? null;
  }

  async list<T extends Table>(table: T, query?: Query<Rows[T]>): Promise<Rows[T][]> {
    const data = await this.load();
    return structuredClone(applyQuery(data[table] as Rows[T][], query));
  }

  async count<T extends Table>(table: T, query?: Pick<Query<Rows[T]>, 'where' | 'in' | 'range'>): Promise<number> {
    const data = await this.load();
    return applyQuery(data[table] as Rows[T][], query).length;
  }

  remove<T extends Table>(table: T, keyValue: string): Promise<boolean> {
    return this.exclusive((data) => {
      const key = TABLES[table].key as string;
      const rows = data[table] as Rows[T][];
      const i = rows.findIndex((r) => (r as Record<string, unknown>)[key] === keyValue);
      if (i === -1) return false;
      rows.splice(i, 1);
      return true;
    });
  }

  nextReferenceNumber(year: number): Promise<number> {
    return this.exclusive((data) => {
      const next = (data.counters[String(year)] ?? 0) + 1;
      data.counters[String(year)] = next;
      return next;
    });
  }
}
