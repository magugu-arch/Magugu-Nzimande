/**
 * Apply database migrations to the Postgres database in DATABASE_URL.
 *
 *   DATABASE_URL=postgres://… npm run db:migrate
 *
 * The built-in demo database (no DATABASE_URL) migrates itself on start.
 */
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL to the Postgres database you want to migrate.');
  process.exit(1);
}

const local = /sslmode=disable/.test(url) || /localhost|127\.0\.0\.1/.test(url);
const pool = new pg.Pool({ connectionString: url, max: 1, ssl: local ? undefined : { rejectUnauthorized: false } });
try {
  await migrate(drizzle(pool), { migrationsFolder: path.resolve(import.meta.dirname, '..', 'drizzle') });
  console.log('Migrations applied.');
} finally {
  await pool.end();
}
