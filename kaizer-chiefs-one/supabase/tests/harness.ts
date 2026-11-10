import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

/**
 * Runs the real migrations in PGlite (Postgres compiled to WebAssembly) on
 * top of a minimal stand-in for what Supabase provides: the auth schema and
 * auth.uid(), the anon/authenticated/service_role roles with Supabase's
 * default grants, and the storage tables. Policies are then exercised as each
 * role, exactly as PostgREST would run them.
 */
const SUPABASE_SHIM = `
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase grants the API roles broad table privileges and relies on RLS.
-- Mirroring that here proves the policies, not the grants, are the control.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text not null, public boolean default false);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
`;

export type Db = PGlite;

export async function freshDatabase(): Promise<Db> {
  const db = await PGlite.create();
  await db.exec(SUPABASE_SHIM);
  const dir = fileURLToPath(new URL('../migrations', import.meta.url));
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(join(dir, file), 'utf8'));
  }
  return db;
}

export interface Actor {
  role: 'anon' | 'authenticated' | 'service_role';
  userId?: string;
}

/**
 * Run `fn` as an API role inside a transaction that is always rolled back,
 * so each check sees the same seeded state.
 */
export async function as<T>(db: Db, actor: Actor, fn: (tx: Db) => Promise<T>): Promise<T> {
  await db.exec('begin');
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [actor.userId ?? '']);
    await db.exec(`set local role ${actor.role}`);
    return await fn(db);
  } finally {
    await db.exec('rollback');
  }
}

/** Like `as`, but resolves to the database error message (or null on success). */
export async function attempt(
  db: Db,
  actor: Actor,
  sql: string,
  params: unknown[] = [],
): Promise<string | null> {
  return as(db, actor, async (tx) => {
    try {
      await tx.query(sql, params);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  });
}

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
