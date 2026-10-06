/**
 * Apply db/migrations/*.sql in order, once each, each in its own transaction.
 *
 *   DATABASE_URL=postgres://… npm run db:migrate
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

export async function migrate(connectionString: string, log: (s: string) => void = console.log): Promise<string[]> {
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'db', 'migrations');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const client = new pg.Client({ connectionString });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const done = new Set((await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(dir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        log(`applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`${file} failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (applied.length === 0) log('database is up to date');
  } finally {
    await client.end();
  }
  return applied;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL to the Postgres connection string.');
    process.exit(1);
  }
  migrate(url).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
