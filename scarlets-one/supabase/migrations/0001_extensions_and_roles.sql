-- Scarlets One: supporter-app concept. Not an official Scarlets Rugby product.
--
-- 0001  Extensions, the private `app` schema and the role/permission matrix.
--
-- Conventions used by every migration in this folder:
--   * Every timestamp is `timestamptz`, so it is stored in UTC. Venue-local
--     time is a display concern and never reaches the database.
--   * Enumerations are `text` + CHECK rather than Postgres enums: a CHECK can be
--     replaced in a later migration, an enum value can never be removed.
--   * Statements are re-runnable (`if not exists`, `or replace`, `drop ... if
--     exists`) so a half-applied migration can be applied again.
--   * Supabase's own roles are used as they are: `anon` (no session),
--     `authenticated` (a signed-in person) and `service_role` (the backend).
--     The app roles supporter / editor / moderator / club_admin /
--     partner_admin live in `public.user_roles`; `service` is `service_role`.

-- Fail early and clearly if this is not a Supabase-shaped database.
do $$
declare
  missing text;
begin
  select string_agg(r, ', ') into missing
  from unnest(array['anon', 'authenticated', 'service_role']) as r
  where not exists (select 1 from pg_catalog.pg_roles where rolname = r);
  if missing is not null then
    raise exception 'Supabase role(s) missing: %. Apply to a Supabase project, or load tests/supabase_shim.sql first.', missing;
  end if;
end
$$;

-- btree_gist lets one exclusion constraint combine "same placement" (=) with
-- "overlapping dates" (&&). It backs the one-approved-campaign-per-placement
-- rule in 0002, which a trigger could only enforce with a race window.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

-- `app` holds helpers the policies call. It is not in the API's exposed
-- schemas, so nothing in it can be reached as an RPC.
create schema if not exists app;
comment on schema app is 'Private helpers for row-level security. Not exposed through the Data API.';
grant usage on schema app to anon, authenticated, service_role;

-- Localised text is {"en": "...", "cy": "..."}: English required, Welsh
-- optional, nothing else. Mirrors `localizedText` in packages/domain/src/i18n.ts.
create or replace function app.is_localized_text(value jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    pg_catalog.jsonb_typeof(value) = 'object'
    and pg_catalog.jsonb_typeof(value -> 'en') = 'string'
    and (not value ? 'cy' or pg_catalog.jsonb_typeof(value -> 'cy') = 'string')
    and (value - 'en' - 'cy') = '{}'::jsonb,
    false
  )
$$;

-- The permission matrix. It is a copy of `rolePermissions` in
-- packages/domain/src/roles.ts and a test compares the two, so the console and
-- the database cannot drift apart silently.
create table if not exists app.role_permissions (
  role text not null
    check (role in ('supporter', 'editor', 'moderator', 'club_admin', 'partner_admin', 'service')),
  permission text not null
    check (permission in (
      'content.read', 'content.write', 'content.publish', 'fixtures.override',
      'campaigns.read', 'campaigns.write', 'campaigns.approve', 'moderation.review',
      'notifications.schedule', 'roles.manage', 'audit.read', 'flags.manage', 'rewards.adjust'
    )),
  primary key (role, permission)
);
comment on table app.role_permissions is
  'Role -> permission matrix. Mirrors rolePermissions in packages/domain/src/roles.ts.';

-- Replace rather than merge: the table must equal the matrix, not contain it.
delete from app.role_permissions;
insert into app.role_permissions (role, permission) values
  -- supporter: no console permissions at all.
  ('editor', 'content.read'),
  ('editor', 'content.write'),
  ('editor', 'campaigns.read'),
  ('moderator', 'content.read'),
  ('moderator', 'moderation.review'),
  ('partner_admin', 'campaigns.read'),
  ('partner_admin', 'campaigns.write'),
  ('club_admin', 'content.read'),
  ('club_admin', 'content.write'),
  ('club_admin', 'content.publish'),
  ('club_admin', 'fixtures.override'),
  ('club_admin', 'campaigns.read'),
  ('club_admin', 'campaigns.write'),
  ('club_admin', 'campaigns.approve'),
  ('club_admin', 'moderation.review'),
  ('club_admin', 'notifications.schedule'),
  ('club_admin', 'roles.manage'),
  ('club_admin', 'audit.read'),
  ('club_admin', 'flags.manage'),
  -- service: everything, including rewards.adjust, which no person can hold
  -- because `service` is not an assignable value in public.user_roles.
  ('service', 'content.read'),
  ('service', 'content.write'),
  ('service', 'content.publish'),
  ('service', 'fixtures.override'),
  ('service', 'campaigns.read'),
  ('service', 'campaigns.write'),
  ('service', 'campaigns.approve'),
  ('service', 'moderation.review'),
  ('service', 'notifications.schedule'),
  ('service', 'roles.manage'),
  ('service', 'audit.read'),
  ('service', 'flags.manage'),
  ('service', 'rewards.adjust');

-- Deny by default: only SECURITY DEFINER helpers read this table.
alter table app.role_permissions enable row level security;
revoke all on app.role_permissions from public, anon, authenticated;
