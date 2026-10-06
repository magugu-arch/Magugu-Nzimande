import 'server-only';
import path from 'node:path';
import { FileStore } from './file-store';
import { PostgresStore } from './postgres-store';
import type { Store } from './types';

export type { Store, Rows, Table, Query } from './types';
export { UniqueViolation } from './types';

const globalStore = globalThis as unknown as { __zbStore?: Store };

export class StoreNotConfigured extends Error {
  constructor() {
    super(
      'DATABASE_URL is not set. Production needs Postgres (see README › Database). ' +
        'For a single-server preview only, set ALLOW_FILE_STORE=true to use the JSON file store.',
    );
    this.name = 'StoreNotConfigured';
  }
}

/**
 * The store for this process. Postgres when DATABASE_URL is set; otherwise
 * the JSON file store, which production refuses unless explicitly allowed —
 * a booking system must not silently write to a container's disk.
 */
export function getStore(): Store {
  if (globalStore.__zbStore) return globalStore.__zbStore;
  const url = process.env.DATABASE_URL;
  let store: Store;
  if (url) {
    store = new PostgresStore(url);
  } else if (process.env.NODE_ENV === 'production' && process.env.ALLOW_FILE_STORE !== 'true') {
    throw new StoreNotConfigured();
  } else {
    store = new FileStore(process.env.FILE_STORE_PATH ?? path.join(process.cwd(), '.data', 'store.json'));
  }
  globalStore.__zbStore = store;
  return store;
}

/** Tests swap in an isolated store. */
export function setStoreForTesting(store: Store | undefined): void {
  globalStore.__zbStore = store;
}
