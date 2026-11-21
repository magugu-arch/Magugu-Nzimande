-- Scarlets One: supporter-app concept. Not an official Scarlets Rugby product.
--
-- 0006  The parts that live in Supabase's own schemas: the private Fan Cam
--       bucket with its object policies, and the Realtime publication.
--
-- Both blocks are guarded, so the migration is a no-op on a plain Postgres.
-- NOT VERIFIED AGAINST A REAL PROJECT: the tests run these statements against
-- a hand-written stand-in for `storage.buckets` / `storage.objects`
-- (tests/supabase_shim.sql). Check them on a Supabase branch before launch.

-- ---------------------------------------------------------------------------
-- Storage: the `fan-cam` bucket
-- ---------------------------------------------------------------------------
--
-- Private bucket. The same limits as the media_assets constraints (0002) are
-- set on the bucket so Storage refuses a bad upload before a row is written.
-- A supporter may put a file only in their own folder, `<account id>/...`,
-- which is also where media_assets requires a supporter's object_path to be.
--
-- There is no policy for reading someone else's file. Approved photos are
-- served to other people by the service, through short-lived signed URLs.

do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'storage schema not present: skipping the fan-cam bucket and its policies';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fan-cam', 'fan-cam', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- No ALTER TABLE here: storage.objects already has RLS enabled on Supabase
  -- and is not ours to alter. Policies are all a project may add.
  drop policy if exists fan_cam_insert_own_folder on storage.objects;
  create policy fan_cam_insert_own_folder on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'fan-cam'
      and (storage.foldername(name))[1] = (select auth.uid())::text
      and (select app.account_is_active())
    );

  drop policy if exists fan_cam_select_own_folder on storage.objects;
  create policy fan_cam_select_own_folder on storage.objects
    for select to authenticated
    using (bucket_id = 'fan-cam' and (storage.foldername(name))[1] = (select auth.uid())::text);

  drop policy if exists fan_cam_select_moderation on storage.objects;
  create policy fan_cam_select_moderation on storage.objects
    for select to authenticated
    using (bucket_id = 'fan-cam' and (select app.has_permission('moderation.review')));

  drop policy if exists fan_cam_delete_own_folder on storage.objects;
  create policy fan_cam_delete_own_folder on storage.objects
    for delete to authenticated
    using (bucket_id = 'fan-cam' and (storage.foldername(name))[1] = (select auth.uid())::text);
end
$$;

-- ---------------------------------------------------------------------------
-- Realtime: live match data
-- ---------------------------------------------------------------------------
--
-- Only public, non-personal tables are published. Realtime applies the SELECT
-- policies of the subscriber, and both tables are readable by anyone.

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    raise notice 'publication supabase_realtime not present: skipping';
    return;
  end if;

  foreach t in array array['fixtures', 'match_events'] loop
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
