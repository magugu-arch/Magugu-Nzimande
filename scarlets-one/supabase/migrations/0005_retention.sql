-- Scarlets One: supporter-app concept. Not an official Scarlets Rugby product.
--
-- 0005  Data retention and account deletion.
--
--   retention_policies     how long each kind of record is kept, as data
--   purge_expired()        applies every enabled policy; run it on a schedule
--   delete_account(uuid)   anonymises one account (service role)
--   delete_my_account()    the same, for the signed-in supporter themselves
--
-- The database cannot delete a file from Storage, so anything that removes a
-- photo queues its path in storage_purge_queue for the service to delete.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.retention_policies (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  target_table text not null,
  action text not null check (action in ('delete', 'anonymise')),
  retain_for interval not null check (retain_for > interval '0'),
  enabled boolean not null default true,
  description text not null,
  updated_at timestamptz not null default now()
);

-- The periods below are engineering defaults so that nothing is kept for ever
-- by accident. They are NOT a statement of club policy: each one needs the
-- club's data-protection sign-off before launch. `on conflict do nothing`
-- keeps a value that has since been changed.
insert into public.retention_policies (key, target_table, action, retain_for, description) values
  ('device_tokens.unused', 'device_tokens', 'delete', interval '180 days',
   'Push tokens not seen (or revoked) for this long are deleted.'),
  ('fan_cam.rejected', 'fan_activities', 'delete', interval '30 days',
   'A rejected Fan Cam entry and its photo are deleted this long after the decision.'),
  ('fan_cam.withdrawn', 'fan_activities', 'delete', interval '1 day',
   'A Fan Cam entry the supporter withdrew is deleted, with its photo, this long after withdrawal.'),
  ('fan_activities.closed', 'fan_activities', 'anonymise', interval '180 days',
   'Votes, predictions, quiz answers and challenge steps lose their link to a person this long after the activity closes. The answers stay, as counts.'),
  ('moderation_cases.decided', 'moderation_cases', 'anonymise', interval '365 days',
   'Decided or closed moderation cases lose their notes and reporter this long after the decision.'),
  ('notifications.finished', 'notifications', 'delete', interval '365 days',
   'Sent, failed and cancelled notification records are deleted after this long.'),
  ('webhook_events.settled', 'webhook_events', 'delete', interval '90 days',
   'Processed and ignored webhook deliveries are deleted after this long. Replay protection for that delivery ends with the row.'),
  ('rate_limit_hits.expired', 'rate_limit_hits', 'delete', interval '1 day',
   'Rate-limit counters older than any window in use are deleted.'),
  ('storage_purge_queue.processed', 'storage_purge_queue', 'delete', interval '30 days',
   'Queue entries for files the service has already deleted are removed.')
on conflict (key) do nothing;

-- Files the service must delete from Storage. `processed_at` is set by the
-- service once the object is gone.
create table if not exists public.storage_purge_queue (
  id bigint generated always as identity primary key,
  bucket text not null,
  object_path text not null,
  reason text not null,
  queued_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (bucket, object_path)
);

-- Service-only: RLS on, no policy, nothing granted to anon or authenticated.
alter table public.retention_policies enable row level security;
alter table public.storage_purge_queue enable row level security;
revoke all on public.retention_policies, public.storage_purge_queue from anon, authenticated, service_role;
grant select, insert, update, delete on public.retention_policies, public.storage_purge_queue to service_role;

create or replace trigger retention_policies_touch_updated_at before update on public.retention_policies
  for each row execute function app.touch_updated_at();
-- Changing how long data is kept is itself an audited act.
create or replace trigger retention_policies_audit after insert or update or delete on public.retention_policies
  for each row execute function app.audit_row_change('key', 'action', 'retain_for', 'enabled');

-- ---------------------------------------------------------------------------
-- Purge
-- ---------------------------------------------------------------------------

-- Deletes Fan Cam entries in one moderation state that changed before
-- `p_cutoff`, together with their photos, and queues the files for removal.
create or replace function app.purge_fan_cam(p_status text, p_cutoff timestamptz)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_media uuid[];
begin
  select pg_catalog.array_agg(f.id), pg_catalog.array_agg(f.media_asset_id)
  into v_ids, v_media
  from public.fan_activities f
  where f.activity_type = 'fan_cam'
    and f.moderation_status = p_status
    and f.status_changed_at < p_cutoff;

  if v_ids is null then
    return 0;
  end if;

  insert into public.storage_purge_queue (bucket, object_path, reason)
  select m.bucket, m.object_path, 'fan_cam.' || p_status
  from public.media_assets m
  where m.id = any (v_media)
  on conflict (bucket, object_path) do nothing;

  -- The moderation case stays, without its subject (ON DELETE SET NULL), so
  -- the decision history survives the photo.
  delete from public.fan_activities f where f.id = any (v_ids);
  delete from public.media_assets m where m.id = any (v_media);
  return pg_catalog.cardinality(v_ids);
end
$$;

-- Applies every enabled policy and reports what it did. Safe to run as often
-- as you like; schedule it daily (pg_cron, or a scheduled Edge Function).
--
-- Each policy has a handler written out below. The table supplies the period
-- and the on/off switch; it does not supply SQL, so a row in
-- retention_policies can never make this function touch another table.
create or replace function public.purge_expired()
returns table (policy_key text, policy_action text, rows_affected bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  n bigint;
  v_cutoff timestamptz;
begin
  for p in
    select rp.key, rp.target_table, rp.action, rp.retain_for
    from public.retention_policies rp
    where rp.enabled
    order by rp.key
  loop
    v_cutoff := pg_catalog.now() - p.retain_for;
    n := 0;

    case p.key
      when 'device_tokens.unused' then
        delete from public.device_tokens d
        where d.last_seen_at < v_cutoff or d.revoked_at < v_cutoff;
        get diagnostics n = row_count;

      when 'fan_cam.rejected' then
        n := app.purge_fan_cam('rejected', v_cutoff);

      when 'fan_cam.withdrawn' then
        n := app.purge_fan_cam('withdrawn', v_cutoff);

      when 'fan_activities.closed' then
        update public.fan_activities f
        set user_id = null, device_hash = null, anonymised_at = pg_catalog.now()
        from public.activity_definitions d
        where d.id = f.activity_id
          and f.activity_type <> 'fan_cam'
          and f.anonymised_at is null
          and d.closes_at < v_cutoff;
        get diagnostics n = row_count;

      when 'moderation_cases.decided' then
        update public.moderation_cases mc
        set notes = null, reported_by = null
        where mc.status in ('approved', 'rejected', 'closed')
          and coalesce(mc.decided_at, mc.updated_at) < v_cutoff
          and (mc.notes is not null or mc.reported_by is not null);
        get diagnostics n = row_count;

      when 'notifications.finished' then
        delete from public.notifications nt
        where nt.send_status in ('sent', 'failed', 'cancelled')
          and coalesce(nt.sent_at, nt.updated_at) < v_cutoff;
        get diagnostics n = row_count;

      when 'webhook_events.settled' then
        delete from public.webhook_events w
        where w.status in ('processed', 'ignored') and w.last_received_at < v_cutoff;
        get diagnostics n = row_count;

      when 'rate_limit_hits.expired' then
        delete from public.rate_limit_hits h where h.hit_at < v_cutoff;
        get diagnostics n = row_count;

      when 'storage_purge_queue.processed' then
        delete from public.storage_purge_queue q where q.processed_at < v_cutoff;
        get diagnostics n = row_count;

      else
        raise warning 'retention policy "%" has no handler in purge_expired(); nothing was done', p.key;
        n := null;
    end case;

    -- Counts only: the history says what was purged, never whose it was.
    if n > 0 then
      insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, after)
      values (
        null, app.actor_role(), 'retention.' || p.action, p.target_table, p.key,
        pg_catalog.jsonb_build_object('rows', n, 'retain_for', p.retain_for::text)
      );
    end if;

    policy_key := p.key;
    policy_action := p.action;
    rows_affected := n;
    return next;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------

-- Removes everything that identifies a person and keeps what must be kept
-- without it:
--
--   deleted      profile, preferences, marketing consents, device tokens,
--                membership link, rewards wallet and transactions (the
--                provider keeps its own records), console roles, Fan Cam
--                entries and their photos (files are queued for removal),
--                notifications addressed to the account, rate-limit counters
--   anonymised   votes, predictions, quiz answers and challenge steps keep
--                the answer and lose the account; reports made by the account
--                lose the reporter; notes on cases about the account's
--                entries are cleared
--   kept         consent_log and fan_cam_consents (proof of what was agreed,
--                with a withdrawal appended) and audit_logs. They reference
--                the account by id only, and that id now points at a
--                tombstone: no email, no phone, no Auth identity.
--
-- The caller must then delete the Auth user (supabase.auth.admin.deleteUser)
-- and drain storage_purge_queue.
create or replace function app.anonymise_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_counts jsonb := '{}'::jsonb;
  n bigint;
begin
  select u.account_status into v_status from public.users u where u.id = p_user_id for update;
  if not found then
    raise exception 'unknown account' using errcode = 'P0002';
  end if;
  if v_status = 'deleted' then
    return pg_catalog.jsonb_build_object('already_deleted', true);
  end if;

  -- Labels the consent-log rows written by the triggers below.
  perform pg_catalog.set_config('app.consent_source', 'account_deletion', true);

  update public.moderation_cases mc
  set notes = null
  where mc.notes is not null
    and mc.fan_activity_id in (select f.id from public.fan_activities f where f.user_id = p_user_id);
  update public.moderation_cases mc set reported_by = null where mc.reported_by = p_user_id;

  insert into public.storage_purge_queue (bucket, object_path, reason)
  select m.bucket, m.object_path, 'account_deletion'
  from public.media_assets m
  where m.owner_id = p_user_id
  on conflict (bucket, object_path) do nothing;

  delete from public.fan_activities f where f.user_id = p_user_id and f.activity_type = 'fan_cam';
  get diagnostics n = row_count;
  v_counts := v_counts || pg_catalog.jsonb_build_object('fan_cam_entries_deleted', n);
  delete from public.media_assets m where m.owner_id = p_user_id;
  update public.fan_cam_consents c
  set withdrawn_at = pg_catalog.now()
  where c.user_id = p_user_id and c.withdrawn_at is null;

  update public.fan_activities f
  set user_id = null, device_hash = null, anonymised_at = pg_catalog.now()
  where f.user_id = p_user_id;
  get diagnostics n = row_count;
  v_counts := v_counts || pg_catalog.jsonb_build_object('fan_entries_anonymised', n);

  delete from public.device_tokens d where d.user_id = p_user_id;
  get diagnostics n = row_count;
  v_counts := v_counts || pg_catalog.jsonb_build_object('device_tokens_deleted', n);

  delete from public.notifications nt where nt.user_id = p_user_id;
  delete from public.marketing_consents mc where mc.user_id = p_user_id;
  delete from public.preferences pr where pr.user_id = p_user_id;
  delete from public.profiles pf where pf.user_id = p_user_id;
  delete from public.memberships ms where ms.user_id = p_user_id;
  delete from public.reward_transactions rt where rt.user_id = p_user_id;
  delete from public.rewards_wallets rw where rw.user_id = p_user_id;
  delete from public.user_roles ur where ur.user_id = p_user_id;
  delete from public.rate_limit_hits h where h.subject = 'user:' || p_user_id::text;

  update public.users u
  set email = null,
      phone = null,
      auth_provider_id = null,
      account_status = 'deleted',
      deleted_at = pg_catalog.now()
  where u.id = p_user_id;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, after)
  values (auth.uid(), app.actor_role(), 'account.deleted', 'users', p_user_id::text, v_counts);

  perform pg_catalog.set_config('app.consent_source', '', true);
  return v_counts;
end
$$;

create or replace function public.delete_account(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app.anonymise_user(p_user_id)
$$;

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sign-in required' using errcode = '42501';
  end if;
  return app.anonymise_user(auth.uid());
end
$$;

-- Safety net: if the Auth identity is deleted first (from the dashboard, say),
-- the foreign key sets auth_provider_id to null and this anonymises the rest,
-- so personal data can never be stranded behind a deleted sign-in.
create or replace function app.users_after_auth_identity_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.anonymise_user(new.id);
  return new;
end
$$;

create or replace trigger users_auth_identity_removed
  after update of auth_provider_id on public.users
  for each row
  when (old.auth_provider_id is not null and new.auth_provider_id is null and new.account_status <> 'deleted')
  execute function app.users_after_auth_identity_removed();

revoke all on function
  app.purge_fan_cam(text, timestamptz), app.anonymise_user(uuid), app.users_after_auth_identity_removed()
from public;
-- A Supabase project may grant EXECUTE on new public functions to all three
-- API roles by default, so each is revoked by name before the intended grant.
revoke all on function public.purge_expired(), public.delete_account(uuid), public.delete_my_account()
from public, anon, authenticated, service_role;
grant execute on function public.purge_expired(), public.delete_account(uuid) to service_role;
grant execute on function public.delete_my_account() to authenticated;
