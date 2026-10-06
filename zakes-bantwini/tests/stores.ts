import pg from 'pg';
import { migrate } from '../scripts/db-migrate';
import { FileStore } from '@/lib/store/file-store';
import { PostgresStore } from '@/lib/store/postgres-store';
import type { Store } from '@/lib/store/types';

/**
 * Every store-backed suite runs against the file store, and also against real
 * Postgres when TEST_DATABASE_URL is set (CI provides a service container).
 * Each Postgres suite gets its own schema, migrated from db/migrations.
 */
export type StoreHarness = { name: string; fresh: () => Promise<Store>; close: () => Promise<void> };

export function storeHarnesses(): StoreHarness[] {
  const harnesses: StoreHarness[] = [{ name: 'file store', fresh: async () => new FileStore(null), close: async () => {} }];
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    let current: PostgresStore | null = null;
    harnesses.push({
      name: 'postgres store',
      fresh: async () => {
        await current?.end();
        const schema = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const admin = new pg.Client({ connectionString: url });
        await admin.connect();
        await admin.query(`CREATE SCHEMA ${schema}`);
        await admin.end();
        const scoped = `${url}${url.includes('?') ? '&' : '?'}options=${encodeURIComponent(`-c search_path=${schema}`)}`;
        await migrate(scoped, () => {});
        current = new PostgresStore(scoped);
        return current;
      },
      close: async () => {
        await current?.end();
        current = null;
      },
    });
  }
  return harnesses;
}
