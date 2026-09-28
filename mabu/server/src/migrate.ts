/**
 * Applies server/migrations/*.sql in order, each once, each in a transaction.
 * Applied files are recorded in server_migration with a checksum; a changed
 * file that was already applied stops the start-up rather than drifting.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SqlClient } from './store';

export async function migrate(
  sql: SqlClient & { exec?: (text: string) => Promise<unknown> },
  dir: string,
  log: (line: string) => void = () => undefined,
): Promise<string[]> {
  await sql.query(`CREATE TABLE IF NOT EXISTS server_migration (
    name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Map(
    (await sql.query('SELECT name, checksum FROM server_migration')).rows.map((r) => [
      String(r.name),
      String(r.checksum),
    ]),
  );
  const applied: string[] = [];
  for (const file of fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const checksum = createHash('sha256').update(text).digest('hex');
    const previous = done.get(file);
    if (previous) {
      if (previous !== checksum) throw new Error(`migration ${file} changed after it was applied`);
      continue;
    }
    await sql.query('BEGIN');
    try {
      // Multi-statement files: pg runs them in one simple query; PGlite needs exec.
      if (sql.exec) await sql.exec(text);
      else await sql.query(text);
      await sql.query('INSERT INTO server_migration (name, checksum) VALUES ($1, $2)', [
        file,
        checksum,
      ]);
      await sql.query('COMMIT');
    } catch (error) {
      await sql.query('ROLLBACK');
      throw error;
    }
    log(`[migrate] applied ${file}`);
    applied.push(file);
  }
  return applied;
}
