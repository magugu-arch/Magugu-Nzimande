-- Scarlets One: supporter-app concept. Not an official Scarlets Rugby product.
--
-- 0004  Behaviour: append-only guards, audit history, consent logging, the
--       Fan Zone and moderation flow, idempotency and rate limiting.
--
-- Two kinds of trigger function are used, deliberately:
--   SECURITY INVOKER  guards that need to know WHO is acting (app.is_service()
--                     reports on the caller, so these must not be DEFINER).
--   SECURITY DEFINER  side effects on tables the caller cannot write (audit
--                     rows, consent log, moderation cases). Each pins
--                     search_path = '' and schema-qualifies every name.

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'partners', 'profiles', 'preferences', 'marketing_consents', 'memberships', 'teams',
    'players', 'fixtures', 'media_assets', 'content_items', 'partner_campaigns', 'offers',
    'rewards_wallets', 'reward_transactions', 'activity_definitions', 'fan_activities',
    'moderation_cases', 'notifications', 'feature_flags'
  ] loop
    execute format(
      'create or replace trigger %I before update on public.%I
         for each row execute function app.touch_updated_at()',
      t || '_touch_updated_at', t
    );
  end loop;
end
$$;

-- Who did it is recorded by the database, not taken from the request: a person
-- cannot attribute their change to someone else. The column to stamp is the
-- trigger argument. Trusted code (the service) may set it explicitly.
create or replace function app.stamp_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not app.is_service() then
    new := pg_catalog.jsonb_populate_record(new, pg_catalog.jsonb_build_object(tg_argv[0], auth.uid()));
  end if;
  return new;
end
$$;

create or replace trigger user_roles_stamp_actor before insert on public.user_roles
  for each row execute function app.stamp_actor('granted_by');
create or replace trigger content_items_stamp_actor before insert on public.content_items
  for each row execute function app.stamp_actor('created_by');
create or replace trigger activity_definitions_stamp_actor before insert on public.activity_definitions
  for each row execute function app.stamp_actor('created_by');
create or replace trigger partner_campaigns_stamp_actor before insert on public.partner_campaigns
  for each row execute function app.stamp_actor('created_by');
create or replace trigger offers_stamp_actor before insert on public.offers
  for each row execute function app.stamp_actor('created_by');
create or replace trigger notifications_stamp_actor before insert on public.notifications
  for each row execute function app.stamp_actor('created_by');
create or replace trigger fixture_overrides_stamp_actor before insert on public.fixture_overrides
  for each row execute function app.stamp_actor('created_by');
create or replace trigger feature_flags_stamp_actor before insert or update on public.feature_flags
  for each row execute function app.stamp_actor('updated_by');

-- A public.users row for every new Auth identity. Nothing personal is copied:
-- the email address stays in Supabase Auth.
create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, auth_provider_id)
  values (new.id, new.id)
  on conflict (id) do nothing;
  return new;
end
$$;

create or replace trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Append-only tables
-- ---------------------------------------------------------------------------

-- Refuses UPDATE, DELETE and TRUNCATE for every role, the service role and
-- the table owner included. Statement-level, so it also fires when the
-- statement would have matched no rows.
create or replace function app.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%.% is append-only: % is not allowed', tg_table_schema, tg_table_name, pg_catalog.lower(tg_op)
    using errcode = '42501', hint = 'Append a new row instead.';
end
$$;

create or replace trigger audit_logs_append_only
  before update or delete or truncate on public.audit_logs
  for each statement execute function app.forbid_mutation();

create or replace trigger consent_log_append_only
  before update or delete or truncate on public.consent_log
  for each statement execute function app.forbid_mutation();

-- Match events are revisions: a correction is a new row, never an edit.
create or replace trigger match_events_append_only
  before update or delete or truncate on public.match_events
  for each statement execute function app.forbid_mutation();

-- Revisions of one provider event must all belong to the same fixture.
create or replace function app.match_events_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.match_events e
    where e.provider_event_id = new.provider_event_id and e.fixture_id <> new.fixture_id
  ) then
    raise exception 'provider event % already belongs to another fixture', new.provider_event_id
      using errcode = '23514';
  end if;
  return new;
end
$$;

create or replace trigger match_events_before_insert before insert on public.match_events
  for each row execute function app.match_events_before_insert();

-- An audit row is stamped with the real time and cannot be back-dated.
create or replace function app.audit_logs_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.occurred_at := pg_catalog.clock_timestamp();
  return new;
end
$$;

create or replace trigger audit_logs_before_insert before insert on public.audit_logs
  for each row execute function app.audit_logs_before_insert();

-- ---------------------------------------------------------------------------
-- Audit history
-- ---------------------------------------------------------------------------

-- 'service' for the backend, the caller's console roles for a person,
-- 'system' for a migration or scheduled job.
create or replace function app.actor_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case pg_catalog.current_setting('role', true)
    when 'service_role' then 'service'
    when 'authenticated' then coalesce((
      select pg_catalog.string_agg(distinct ur.role, ',' order by ur.role)
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
    ), 'supporter')
    when 'anon' then 'anon'
    else 'system'
  end
$$;

-- Generic row audit. Trigger arguments: the primary-key column, then the
-- ALLOW-LIST of columns whose values may be stored.
--
-- Allow-list, not deny-list: a column added later is not logged until someone
-- decides it is safe. Columns outside the list still show up by NAME in
-- changed_columns, so the history says "the balance changed" without holding
-- the balance.
create or replace function app.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_changed text[] := '{}';
  v_key text;
  i integer;
begin
  if tg_op <> 'INSERT' then v_old := pg_catalog.to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := pg_catalog.to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    select coalesce(pg_catalog.array_agg(n.key order by n.key), '{}')
    into v_changed
    from pg_catalog.jsonb_each(v_new) n
    where n.value is distinct from v_old -> n.key and n.key <> 'updated_at';
    if v_changed = '{}' then
      return new;
    end if;
  end if;

  for i in 1 .. tg_nargs - 1 loop
    v_key := tg_argv[i];
    if tg_op = 'DELETE' or (tg_op = 'UPDATE' and v_key = any (v_changed)) then
      v_before := v_before || pg_catalog.jsonb_build_object(v_key, v_old -> v_key);
    end if;
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and v_key = any (v_changed)) then
      v_after := v_after || pg_catalog.jsonb_build_object(v_key, v_new -> v_key);
    end if;
  end loop;

  insert into public.audit_logs
    (actor_id, actor_role, action, entity_type, entity_id, changed_columns, before, after)
  values (
    auth.uid(),
    app.actor_role(),
    tg_table_name || '.' || pg_catalog.lower(tg_op),
    tg_table_name,
    coalesce(v_new, v_old) ->> tg_argv[0],
    v_changed,
    case when tg_op = 'INSERT' then null else v_before end,
    case when tg_op = 'DELETE' then null else v_after end
  );
  return coalesce(new, old);
end
$$;

-- What is audited, and exactly which values each table lets into the history.
do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      -- (table, events, primary-key column followed by the allow-listed columns)
      -- users: sign-ups are not audited, only what happens to an account later.
      ('users',                'update or delete',           $a$'id', 'account_status'$a$),
      ('user_roles',           'insert or update or delete', $a$'id', 'user_id', 'role', 'partner_id'$a$),
      ('memberships',          'insert or update or delete', $a$'id', 'eligibility_status', 'source_system'$a$),
      ('rewards_wallets',      'insert or update or delete', $a$'id', 'scheme_id', 'sync_status'$a$),
      ('reward_transactions',  'insert or update or delete', $a$'id', 'type', 'status', 'source_system'$a$),
      ('content_items',        'insert or update or delete', $a$'id', 'status', 'kind', 'category', 'publish_at', 'expire_at', 'pinned', 'translation_status'$a$),
      ('activity_definitions', 'insert or update or delete', $a$'id', 'status', 'kind', 'opens_at', 'closes_at'$a$),
      ('partners',             'insert or update or delete', $a$'id', 'approved'$a$),
      ('partner_campaigns',    'insert or update or delete', $a$'id', 'partner_id', 'status', 'placement', 'label', 'starts_at', 'ends_at', 'priority'$a$),
      ('offers',               'insert or update or delete', $a$'id', 'partner_id', 'status', 'placement', 'eligibility', 'starts_at', 'ends_at'$a$),
      ('moderation_cases',     'insert or update or delete', $a$'id', 'status', 'opened_reason', 'report_reason', 'decision_reason'$a$),
      ('fixture_overrides',    'insert or update or delete', $a$'id', 'fixture_id', 'status', 'kickoff_utc', 'revoked_at'$a$),
      ('notifications',        'insert or update or delete', $a$'id', 'template_id', 'category', 'consent_check', 'send_status', 'scheduled_for'$a$),
      ('feature_flags',        'insert or update or delete', $a$'key', 'enabled'$a$)
    ) as t (tbl, events, args)
  loop
    execute format(
      'create or replace trigger %I after %s on public.%I
         for each row execute function app.audit_row_change(%s)',
      spec.tbl || '_audit', spec.events, spec.tbl, spec.args
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Consent logging
-- ---------------------------------------------------------------------------

create or replace function app.consent_source()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    -- Set for the length of one transaction by app.anonymise_user (0005).
    nullif(pg_catalog.current_setting('app.consent_source', true), ''),
    case pg_catalog.current_setting('role', true)
      when 'authenticated' then 'app'
      when 'service_role' then 'api'
      else 'system'
    end
  )
$$;

-- Every change to marketing consent is appended to the log: given, withdrawn,
-- re-confirmed under new wording, or removed with the row.
create or replace function app.log_marketing_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.granted then
      insert into public.consent_log (user_id, purpose, granted, policy_version, source)
      values (old.user_id, old.purpose, false, old.policy_version, app.consent_source());
    end if;
    return old;
  end if;

  if tg_op = 'INSERT'
     or new.granted is distinct from old.granted
     or new.policy_version is distinct from old.policy_version then
    insert into public.consent_log (user_id, purpose, granted, policy_version, source)
    values (new.user_id, new.purpose, new.granted, new.policy_version, app.consent_source());
  end if;
  return new;
end
$$;

create or replace trigger marketing_consents_log
  after insert or update or delete on public.marketing_consents
  for each row execute function app.log_marketing_consent();

-- A Fan Cam consent record is evidence. Nothing about it may change except
-- that it can be withdrawn, once; and it cannot be deleted.
create or replace function app.fan_cam_consents_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'a consent record cannot be deleted; withdraw it instead' using errcode = '42501';
  end if;
  if (new.id, new.user_id, new.age_or_guardian, new.people_in_photo, new.display_and_moderation,
      new.policy_version, new.granted_at)
     is distinct from
     (old.id, old.user_id, old.age_or_guardian, old.people_in_photo, old.display_and_moderation,
      old.policy_version, old.granted_at) then
    raise exception 'a consent record is immutable' using errcode = '42501';
  end if;
  if old.withdrawn_at is not null and new.withdrawn_at is distinct from old.withdrawn_at then
    raise exception 'consent has already been withdrawn' using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace trigger fan_cam_consents_guard before update or delete on public.fan_cam_consents
  for each row execute function app.fan_cam_consents_guard();

create or replace function app.log_fan_cam_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.consent_log (user_id, purpose, granted, policy_version, source, context)
    values (new.user_id, 'fan_cam', true, new.policy_version, app.consent_source(),
            pg_catalog.jsonb_build_object('consent_record_id', new.id));
  elsif old.withdrawn_at is null and new.withdrawn_at is not null then
    insert into public.consent_log (user_id, purpose, granted, policy_version, source, context)
    values (new.user_id, 'fan_cam', false, new.policy_version, app.consent_source(),
            pg_catalog.jsonb_build_object('consent_record_id', new.id));
  end if;
  return new;
end
$$;

create or replace trigger fan_cam_consents_log after insert or update on public.fan_cam_consents
  for each row execute function app.log_fan_cam_consent();

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------

-- Sliding window: at most `p_max` hits by `p_subject` for `p_action` in any
-- period of length `p_window`. A refused call is not counted, so hammering a
-- closed door does not extend the wait.
--
-- The advisory lock serialises calls for one subject+action, so two requests
-- arriving together cannot both take the last slot. It is released at the end
-- of the caller's transaction.
--
-- `p_subject` is '<kind>:<opaque id>', for example 'user:<uuid>' or
-- 'device:<sha256>'. Never a raw IP address or device id (the table's CHECK
-- rejects them).
create or replace function public.check_rate_limit(
  p_subject text,
  p_action text,
  p_max integer,
  p_window interval
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_count integer;
  v_oldest timestamptz;
begin
  if p_max is null or p_max < 1 or p_window is null or p_window <= interval '0' then
    raise exception 'check_rate_limit needs p_max >= 1 and a positive p_window' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_subject || '|' || p_action, 0));

  select pg_catalog.count(*), pg_catalog.min(h.hit_at)
  into v_count, v_oldest
  from public.rate_limit_hits h
  where h.subject = p_subject and h.action = p_action and h.hit_at > v_now - p_window;

  if v_count >= p_max then
    return query select false, 0, v_oldest + p_window;
    return;
  end if;

  insert into public.rate_limit_hits (subject, action, hit_at) values (p_subject, p_action, v_now);
  return query select true, p_max - v_count - 1, coalesce(v_oldest, v_now) + p_window;
end
$$;

revoke all on function public.check_rate_limit(text, text, integer, interval)
  from public, anon, authenticated, service_role;
grant execute on function public.check_rate_limit(text, text, integer, interval) to service_role;

-- The same limit, applied by the database to a signed-in client that writes
-- to a table directly. It takes no subject: a caller can only ever spend
-- their own allowance.
create or replace function app.consume_own_rate_limit(p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule app.rate_limit_rules;
  v_allowed boolean;
begin
  if auth.uid() is null then
    return false;
  end if;
  select * into v_rule from app.rate_limit_rules r where r.action = p_action;
  if not found then
    return true;
  end if;
  select c.allowed into v_allowed
  from public.check_rate_limit('user:' || auth.uid()::text, p_action, v_rule.max_hits, v_rule.per) c;
  return v_allowed;
end
$$;

revoke all on function app.consume_own_rate_limit(text) from public;
grant execute on function app.consume_own_rate_limit(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Idempotent webhooks
-- ---------------------------------------------------------------------------

-- Call first in every webhook handler. Returns true when the event should be
-- processed now (first delivery, or a retry of one that failed) and false when
-- it has already been handled or is being handled. The unique key on
-- (provider, event_id) is what makes two simultaneous deliveries safe.
create or replace function public.claim_webhook_event(
  p_provider text,
  p_event_id text,
  p_event_type text default null,
  p_payload_sha256 text default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
  v_status text;
begin
  insert into public.webhook_events (provider, event_id, event_type, payload_sha256)
  values (p_provider, p_event_id, p_event_type, p_payload_sha256)
  on conflict (provider, event_id) do nothing
  returning id into v_id;

  if v_id is not null then
    return true;
  end if;

  select w.status into v_status
  from public.webhook_events w
  where w.provider = p_provider and w.event_id = p_event_id
  for update;

  update public.webhook_events w
  set attempts = w.attempts + 1,
      last_received_at = pg_catalog.now(),
      status = case when v_status = 'failed' then 'received' else w.status end
  where w.provider = p_provider and w.event_id = p_event_id;

  return v_status = 'failed';
end
$$;

create or replace function public.complete_webhook_event(
  p_provider text,
  p_event_id text,
  p_succeeded boolean,
  p_error_code text default null
)
returns void
language sql
set search_path = ''
as $$
  update public.webhook_events w
  set status = case when p_succeeded then 'processed' else 'failed' end,
      processed_at = case when p_succeeded then pg_catalog.now() else null end,
      error_code = case when p_succeeded then null else p_error_code end
  where w.provider = p_provider and w.event_id = p_event_id
$$;

revoke all on function
  public.claim_webhook_event(text, text, text, text),
  public.complete_webhook_event(text, text, boolean, text)
from public, anon, authenticated, service_role;
grant execute on function public.claim_webhook_event(text, text, text, text) to service_role;
grant execute on function public.complete_webhook_event(text, text, boolean, text) to service_role;

-- ---------------------------------------------------------------------------
-- Sign-off stamps
-- ---------------------------------------------------------------------------

-- approved_by / approved_at always describe the approval that is in force.
create or replace function app.stamp_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'approved' then
    new.approved_by := null;
    new.approved_at := null;
  elsif tg_op = 'INSERT' or old.status <> 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := pg_catalog.now();
  else
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
  end if;
  return new;
end
$$;

create or replace trigger partner_campaigns_stamp_approval before insert or update on public.partner_campaigns
  for each row execute function app.stamp_approval();
create or replace trigger offers_stamp_approval before insert or update on public.offers
  for each row execute function app.stamp_approval();

create or replace function app.stamp_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status not in ('scheduled', 'published') then
    new.published_by := null;
    new.published_at := null;
  elsif tg_op = 'INSERT' or old.status not in ('scheduled', 'published') then
    new.published_by := auth.uid();
    new.published_at := pg_catalog.now();
  else
    new.published_by := old.published_by;
    new.published_at := old.published_at;
  end if;
  return new;
end
$$;

create or replace trigger content_items_stamp_publication before insert or update on public.content_items
  for each row execute function app.stamp_publication();

-- ---------------------------------------------------------------------------
-- Fan Zone entries
-- ---------------------------------------------------------------------------

-- The gate every entry passes. For a person writing directly (not the
-- service) it enforces what the API's validateSubmission enforces: the
-- activity is approved and open right now, and the caller is inside the rate
-- limit. It also fixes the fields a person must not choose: the timestamps
-- and the initial moderation state. A Fan Cam entry always starts 'pending'.
create or replace function app.fan_activities_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_def record;
  v_initial text := case when new.activity_type = 'fan_cam' then 'pending' else 'not_required' end;
begin
  -- Runs as the caller, so RLS applies: a supporter can only find an approved
  -- activity here, and a draft looks exactly like one that does not exist.
  select d.status, d.opens_at, d.closes_at, d.config, d.fixture_id
  into v_def
  from public.activity_definitions d
  where d.id = new.activity_id;

  if not found then
    raise exception 'activity is not open for entries' using errcode = '23514';
  end if;

  if app.is_service() then
    new.moderation_status := coalesce(new.moderation_status, v_initial);
    new.fixture_id := coalesce(new.fixture_id, v_def.fixture_id);
  else
    if v_def.status <> 'approved' or pg_catalog.now() < v_def.opens_at or pg_catalog.now() >= v_def.closes_at then
      raise exception 'activity is not open for entries' using errcode = '23514';
    end if;
    new.moderation_status := v_initial;
    new.fixture_id := v_def.fixture_id;
    new.device_hash := null;
    new.created_at := pg_catalog.now();
    new.updated_at := pg_catalog.now();
    new.status_changed_at := pg_catalog.now();
    new.withdrawn_at := null;
    new.anonymised_at := null;
    if not app.consume_own_rate_limit('fanzone.submit') then
      -- PT429: PostgREST turns a 'PTxyz' SQLSTATE into HTTP status xyz.
      raise exception 'too many Fan Zone entries; try again shortly' using errcode = 'PT429';
    end if;
  end if;

  if new.activity_type = 'poll'
     and not coalesce(v_def.config -> 'options' @> pg_catalog.jsonb_build_array(
           pg_catalog.jsonb_build_object('id', new.submission -> 'optionId')), false) then
    raise exception 'unknown poll option' using errcode = '23514';
  end if;

  if new.activity_type = 'challenge'
     and not coalesce(v_def.config -> 'steps' @> pg_catalog.jsonb_build_array(
           pg_catalog.jsonb_build_object('id', new.submission -> 'stepId')), false) then
    raise exception 'unknown challenge step' using errcode = '23514';
  end if;

  if new.consent_record_id is not null and exists (
    select 1 from public.fan_cam_consents c
    where c.id = new.consent_record_id and c.withdrawn_at is not null
  ) then
    raise exception 'consent has been withdrawn' using errcode = '23514';
  end if;

  return new;
end
$$;

create or replace trigger fan_activities_before_insert before insert on public.fan_activities
  for each row execute function app.fan_activities_before_insert();

-- Every Fan Cam entry opens a moderation case. The photo is invisible to
-- other supporters until that case is decided 'approved'.
create or replace function app.fan_activities_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.activity_type = 'fan_cam' and new.moderation_status = 'pending' then
    insert into public.moderation_cases (fan_activity_id, media_asset_id, opened_reason, reported_by)
    values (new.id, new.media_asset_id, 'pre_moderation', null);
  end if;
  return new;
end
$$;

create or replace trigger fan_activities_after_insert after insert on public.fan_activities
  for each row execute function app.fan_activities_after_insert();

create or replace function app.fan_activities_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.moderation_status = 'withdrawn' and new.moderation_status <> 'withdrawn' then
    raise exception 'a withdrawn entry cannot be reinstated' using errcode = '42501';
  end if;

  -- What was entered is fixed. (Column grants already stop a person; this
  -- holds for the service too. Retention may only remove the link to a person.)
  if (new.activity_id, new.activity_type, new.submission, new.media_asset_id, new.consent_record_id)
     is distinct from
     (old.activity_id, old.activity_type, old.submission, old.media_asset_id, old.consent_record_id) then
    raise exception 'an entry cannot be edited after it is made' using errcode = '42501';
  end if;
  if new.user_id is distinct from old.user_id and new.user_id is not null then
    raise exception 'an entry cannot be moved to another account' using errcode = '42501';
  end if;

  if new.moderation_status is distinct from old.moderation_status then
    new.status_changed_at := pg_catalog.now();
    if new.moderation_status = 'withdrawn' then
      new.withdrawn_at := pg_catalog.now();
    end if;
  end if;
  return new;
end
$$;

create or replace trigger fan_activities_before_update before update on public.fan_activities
  for each row execute function app.fan_activities_before_update();

-- Keeps the photo, its consent and its moderation case in step with the entry.
-- Withdrawing an entry withdraws the consent given for it.
create or replace function app.fan_activities_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.moderation_status is not distinct from old.moderation_status then
    return new;
  end if;

  if new.media_asset_id is not null then
    update public.media_assets m
    set moderation_status = new.moderation_status
    where m.id = new.media_asset_id and m.moderation_status <> new.moderation_status;
  end if;

  if new.moderation_status = 'withdrawn' then
    update public.fan_cam_consents c
    set withdrawn_at = pg_catalog.now()
    where c.id = new.consent_record_id and c.withdrawn_at is null;

    update public.moderation_cases mc
    set status = 'closed', decision_reason = 'consent_withdrawn'
    where mc.fan_activity_id = new.id and mc.status in ('open', 'escalated');
  end if;
  return new;
end
$$;

create or replace trigger fan_activities_after_update after update on public.fan_activities
  for each row execute function app.fan_activities_after_update();

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------

create or replace function app.moderation_cases_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if old.status = 'closed' and not app.is_service() then
      raise exception 'this case is closed: the supporter withdrew the entry' using errcode = '42501';
    end if;
    if new.status in ('approved', 'rejected') then
      -- Nobody moderates their own photo. (Runs as the caller: a moderator
      -- can read the entry, which is all this needs.)
      if not app.is_service() and exists (
        select 1 from public.fan_activities f
        where f.id = new.fan_activity_id and f.user_id = auth.uid()
      ) then
        raise exception 'you cannot moderate your own entry' using errcode = '42501';
      end if;
      new.decided_by := auth.uid();
      new.decided_at := pg_catalog.now();
    end if;
  end if;
  return new;
end
$$;

create or replace trigger moderation_cases_before_update before update on public.moderation_cases
  for each row execute function app.moderation_cases_before_update();

-- Deciding a case is what approves or rejects the entry it is about. For a
-- report of something already shown, 'rejected' takes it down and 'approved'
-- leaves it up. A withdrawn entry is never brought back.
create or replace function app.moderation_cases_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected')
     and new.fan_activity_id is not null then
    update public.fan_activities f
    set moderation_status = new.status
    where f.id = new.fan_activity_id
      and f.moderation_status not in (new.status, 'withdrawn');
  end if;
  return new;
end
$$;

create or replace trigger moderation_cases_after_update after update on public.moderation_cases
  for each row execute function app.moderation_cases_after_update();

-- The public Fan Cam gallery: approved photos only, and no account id.
--
-- This view is intentionally NOT security_invoker. It runs with its owner's
-- rights so that it can show approved rows from fan_activities, a table on
-- which supporters can otherwise read nothing but their own entries. The
-- WHERE clause is the whole of what it exposes.
create or replace view public.fan_cam_gallery as
select
  f.id,
  f.activity_id,
  f.fixture_id,
  f.media_asset_id,
  m.bucket,
  m.object_path,
  m.width,
  m.height,
  f.submission ->> 'caption' as caption,
  f.status_changed_at as approved_at
from public.fan_activities f
join public.media_assets m on m.id = f.media_asset_id
where f.activity_type = 'fan_cam'
  and f.moderation_status = 'approved'
  and m.moderation_status = 'approved'
  and m.scan_status = 'clean'
  and m.deleted_at is null;

revoke all on public.fan_cam_gallery from public, anon, authenticated;
grant select on public.fan_cam_gallery to anon, authenticated, service_role;

-- Poll results as counts. Individual votes stay private; this is the only way
-- a supporter learns anything about other people's entries.
create or replace function public.poll_results(p_activity_id uuid)
returns table (option_id text, votes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select f.submission ->> 'optionId', pg_catalog.count(*)
  from public.fan_activities f
  join public.activity_definitions d on d.id = f.activity_id
  where f.activity_id = p_activity_id
    and f.activity_type = 'poll'
    and f.moderation_status <> 'withdrawn'
    and d.status = 'approved'
  group by 1
$$;

revoke all on function public.poll_results(uuid) from public, anon, authenticated, service_role;
grant execute on function public.poll_results(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Device tokens
-- ---------------------------------------------------------------------------

-- A push token belongs to a device, and a device changes hands between
-- accounts (sign out, sign in as someone else). The token is unique, and the
-- second account cannot see the first account's row to update it, so the
-- hand-over has to happen here.
create or replace function public.register_device_token(
  p_token text,
  p_platform text,
  p_locale text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null or not app.account_is_active() then
    raise exception 'an active signed-in account is required' using errcode = '42501';
  end if;

  insert into public.device_tokens (user_id, platform, token, locale)
  values (v_user, p_platform, p_token, p_locale)
  on conflict (token) do update
    set user_id = excluded.user_id,
        device_hash = null,
        platform = excluded.platform,
        locale = excluded.locale,
        last_seen_at = pg_catalog.now(),
        revoked_at = null
  returning id into v_id;
  return v_id;
end
$$;

revoke all on function public.register_device_token(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_device_token(text, text, text) to authenticated, service_role;

-- Trigger functions are not callable as RPCs, and the remaining helpers are
-- reached only through the triggers and functions above.
revoke all on function
  app.touch_updated_at(), app.stamp_actor(), app.handle_new_auth_user(), app.forbid_mutation(),
  app.match_events_before_insert(), app.audit_logs_before_insert(), app.audit_row_change(),
  app.log_marketing_consent(), app.fan_cam_consents_guard(), app.log_fan_cam_consent(),
  app.stamp_approval(), app.stamp_publication(), app.fan_activities_before_insert(),
  app.fan_activities_after_insert(), app.fan_activities_before_update(),
  app.fan_activities_after_update(), app.moderation_cases_before_update(),
  app.moderation_cases_after_update()
from public;
revoke all on function app.actor_role(), app.consent_source() from public;
