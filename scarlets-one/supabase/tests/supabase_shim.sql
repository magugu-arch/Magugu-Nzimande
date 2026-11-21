-- TEST ONLY. Never apply this to a Supabase project.
--
-- PGlite is a bare PostgreSQL. This file creates the small part of Supabase
-- that the migrations rely on, so they can run unchanged:
--
--   roles     anon, authenticated, service_role (BYPASSRLS, as on Supabase)
--   migrator  stands in for Supabase's `postgres` role, which applies
--             migrations and owns the tables. It is deliberately WEAKER than
--             the real one: no superuser and no BYPASSRLS. If the migrations
--             and every SECURITY DEFINER function work as this role, they do
--             not depend on superuser powers.
--   auth      auth.users, auth.uid(), auth.role(), auth.jwt()
--   storage   storage.buckets, storage.objects, storage.foldername()
--   realtime  the supabase_realtime publication
--   grants    Supabase's default of granting ALL on new public objects to
--             anon, authenticated and service_role, so the tests prove the
--             migrations take that access away again.
--
-- It is a stand-in written from Supabase's documented behaviour, not a copy of
-- Supabase. See README.md for what that leaves unverified.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role supabase_auth_admin nologin noinherit;
create role supabase_storage_admin nologin noinherit;
create role migrator nologin createrole;

-- On Supabase `postgres` is a member of the three API roles.
grant anon, authenticated, service_role to migrator;

do $$
begin
  execute format('grant create on database %I to migrator', current_database());
end
$$;

grant all on schema public to migrator;
grant usage on schema public to anon, authenticated, service_role;

create schema extensions authorization migrator;
grant usage on schema extensions to anon, authenticated, service_role;

-- Supabase's default privileges for objects its `postgres` role creates.
alter default privileges for role migrator in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role migrator in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role migrator in schema public
  grant all on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- auth
-- ---------------------------------------------------------------------------

create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, migrator;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text,
  created_at timestamptz not null default now()
);
alter table auth.users owner to supabase_auth_admin;
-- `postgres` may reference auth.users and put triggers on it.
grant all on auth.users to migrator;

-- The same definitions Supabase ships: PostgREST puts the verified JWT's
-- claims in these settings for the length of each request.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

alter function auth.uid() owner to supabase_auth_admin;
alter function auth.role() owner to supabase_auth_admin;
alter function auth.jwt() owner to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- storage
-- ---------------------------------------------------------------------------

create schema storage authorization supabase_storage_admin;
grant usage on schema storage to anon, authenticated, service_role, migrator;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  version text,
  owner_id text,
  user_metadata jsonb,
  unique (bucket_id, name)
);

alter table storage.buckets owner to supabase_storage_admin;
alter table storage.objects owner to supabase_storage_admin;
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role, migrator;

create function storage.foldername(name text) returns text[]
language plpgsql immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end
$$;
alter function storage.foldername(text) owner to supabase_storage_admin;

-- On Supabase, `postgres` does not own storage.objects but is allowed to
-- create policies on it (the supautils `policy_grants` setting). Plain
-- Postgres has no such setting, so membership of the owning role stands in.
grant supabase_storage_admin to migrator;

-- ---------------------------------------------------------------------------
-- realtime
-- ---------------------------------------------------------------------------

create publication supabase_realtime;
alter publication supabase_realtime owner to migrator;
