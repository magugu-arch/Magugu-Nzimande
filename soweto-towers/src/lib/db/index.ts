import 'server-only';
import path from 'node:path';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type DB = NodePgDatabase<typeof schema>;
export { schema };

/**
 * One database for the process.
 *  - DATABASE_URL set → hosted Postgres via node-postgres (production).
 *    Run `npm run db:migrate` on deploy, or set DB_AUTO_MIGRATE=1.
 *  - Otherwise → PGlite, Postgres compiled to WebAssembly, in-process: a file
 *    store under .data/ for `next dev`/`next start`, memory during `next build`
 *    and on serverless previews. Migrations and demo content load automatically.
 */

const g = globalThis as unknown as { __sowetoDb?: Promise<DB> };
const migrationsFolder = path.join(process.cwd(), 'drizzle');

export function isDemoDatabase(): boolean {
  return !process.env.DATABASE_URL;
}

export function getDb(): Promise<DB> {
  g.__sowetoDb ??= init().catch((err) => {
    g.__sowetoDb = undefined;
    throw err;
  });
  return g.__sowetoDb;
}

async function init(): Promise<DB> {
  const { seedBase, seedDemo } = await import('./seed');
  const url = process.env.DATABASE_URL;

  if (url) {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const pool = new Pool({
      connectionString: url,
      max: Number(process.env.DB_POOL_MAX ?? 5),
      ssl: /sslmode=disable/.test(url) || /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
    });
    const db = drizzle(pool, { schema });
    if (process.env.DB_AUTO_MIGRATE === '1') {
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      await migrate(db, { migrationsFolder });
    }
    await seedBase(db);
    return db;
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  // A PGlite file store must only ever be opened by one process. Next's helper
  // workers (jest-worker sets JEST_WORKER_ID) get a private in-memory copy.
  const ephemeral =
    process.env.NEXT_PHASE === 'phase-production-build' || !!process.env.VERCEL || process.env.PGLITE_MEMORY === '1' || !!process.env.JEST_WORKER_ID;
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite');
  const open = async (dir?: string) => {
    const pg = dir ? new PGlite(dir) : new PGlite();
    await pg.waitReady;
    await pg.query('select 1');
    return pg;
  };
  let client: InstanceType<typeof PGlite>;
  if (ephemeral) {
    client = await open();
  } else {
    const { mkdir, rename } = await import('node:fs/promises');
    await mkdir(dataDir, { recursive: true });
    try {
      client = await open(dataDir);
    } catch (err) {
      // A preview store can be left unreadable if the process was stopped mid-write. It only
      // holds demo data, so set it aside (never delete it) and start a fresh one.
      const aside = `${dataDir}-unreadable-${Date.now()}`;
      console.warn(`[db] Couldn't open the preview database in ${dataDir} (${(err as Error).message}). Moved it to ${aside}; starting a fresh one.`);
      await rename(dataDir, aside);
      await mkdir(dataDir, { recursive: true });
      client = await open(dataDir);
    }
  }
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder });
  const typed = db as unknown as DB;
  await seedBase(typed);
  await seedDemo(typed);
  return typed;
}
