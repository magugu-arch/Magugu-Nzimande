-- Kaizer Chiefs One App: foundation schema.
--
-- Principles (from the brief):
--   * Row Level Security on every table. The API roles (anon, authenticated)
--     reach data only through policies; UI visibility is never the control.
--   * Provider-synchronised data (membership, tickets, rewards, fixtures) is
--     written by server functions with the service role, never by clients.
--   * Every externally sourced record carries its source and sync time.
--   * No reusable ticket entry secrets are stored anywhere.
--   * Staff permissions come from role_permissions, mirrored from
--     packages/contracts/src/rbac.ts and checked by the policy tests.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('super_admin', 'content_admin', 'moderator', 'support_agent', 'analyst');
create type public.verification_state as enum ('not_linked', 'pending', 'verified', 'expired', 'failed');
create type public.fixture_status as enum ('scheduled', 'live', 'half_time', 'completed', 'postponed', 'cancelled', 'tbc');
create type public.ticket_status as enum ('active', 'used', 'expired', 'transferred', 'cancelled');
create type public.fan_post_status as enum ('pending_review', 'approved', 'rejected', 'hidden', 'escalated', 'removed_by_user');
create type public.moderation_action as enum ('approve', 'reject', 'hide', 'escalate', 'restore');
create type public.report_reason as enum ('spam', 'harassment', 'hate', 'sexual_content', 'violence', 'privacy', 'child_safety', 'copyright', 'other');
create type public.content_status as enum ('draft', 'scheduled', 'published', 'archived');
create type public.content_kind as enum ('article', 'campaign', 'gallery', 'video_link');
create type public.home_module_type as enum ('hero', 'next_fixture', 'quick_links', 'news_rail', 'fan_moments', 'promo');
create type public.notification_category as enum ('club_news', 'matchday', 'tickets', 'membership', 'fan_moments', 'rewards', 'shop', 'account');
create type public.redemption_status as enum ('pending', 'confirmed', 'failed', 'reversed');
create type public.campaign_status as enum ('draft', 'scheduled', 'sent', 'cancelled');
create type public.campaign_audience as enum ('opted_in_all', 'opted_in_members', 'opted_in_ticket_holders');
create type public.capability_mode as enum ('off', 'demo', 'live');

-- Helpers live in a schema the API does not expose.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Staff roles and permissions
-- ---------------------------------------------------------------------------
create table public.permissions (
  key text primary key
);

create table public.role_permissions (
  role public.staff_role not null,
  permission text not null references public.permissions (key),
  primary key (role, permission)
);

insert into public.permissions (key) values
  ('ops.read'), ('audit.read'), ('content.read'), ('content.write'), ('content.publish'),
  ('fixtures.manage'), ('moderation.read'), ('moderation.act'), ('moderation.escalate'),
  ('notifications.draft'), ('notifications.schedule'), ('rewards.manage'),
  ('support.read_profile'), ('roles.manage');

insert into public.role_permissions (role, permission)
select 'super_admin', key from public.permissions;

insert into public.role_permissions (role, permission) values
  ('content_admin', 'ops.read'), ('content_admin', 'content.read'), ('content_admin', 'content.write'),
  ('content_admin', 'content.publish'), ('content_admin', 'fixtures.manage'),
  ('content_admin', 'notifications.draft'), ('content_admin', 'notifications.schedule'),
  ('content_admin', 'rewards.manage'),
  ('moderator', 'ops.read'), ('moderator', 'content.read'), ('moderator', 'moderation.read'),
  ('moderator', 'moderation.act'), ('moderator', 'moderation.escalate'),
  ('support_agent', 'ops.read'), ('support_agent', 'content.read'), ('support_agent', 'moderation.read'),
  ('support_agent', 'moderation.escalate'), ('support_agent', 'support.read_profile'),
  ('analyst', 'ops.read'), ('analyst', 'content.read'), ('analyst', 'moderation.read'),
  ('analyst', 'audit.read');

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- True when the signed-in user is active staff holding `p`.
create or replace function private.has_permission(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users au
    join public.role_permissions rp on rp.role = au.role
    where au.user_id = auth.uid() and au.active and rp.permission = p
  );
$$;

-- True for the two API roles: anything else (service role, migrations) is trusted.
create or replace function private.is_api_user()
returns boolean
language sql
stable
as $$
  select current_user in ('anon', 'authenticated');
$$;

grant execute on function private.has_permission(text) to anon, authenticated;
grant execute on function private.is_api_user() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audit log: append-only
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function private.audit_logs_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;

create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function private.audit_logs_immutable();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.audit_logs_immutable();

create or replace function private.audit(p_action text, p_entity text, p_entity_id text, p_detail jsonb default '{}')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_detail, '{}'));
$$;

-- ---------------------------------------------------------------------------
-- Supporters
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  avatar_path text,
  locale text not null default 'en-ZA' check (locale in ('en-ZA', 'zu-ZA', 'st-ZA', 'xh-ZA')),
  -- Privacy choices: everything optional starts off (POPIA: opt in, not out).
  marketing_email boolean not null default false,
  marketing_sms boolean not null default false,
  product_analytics boolean not null default false,
  personalised_content boolean not null default false,
  show_name_on_fan_moments boolean not null default false,
  terms_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deletion_requested_at timestamptz
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_enabled boolean not null default false,
  categories jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Membership (provider-synchronised)
-- ---------------------------------------------------------------------------
create table public.member_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null,
  provider_ref text not null,
  verification_state public.verification_state not null default 'not_linked',
  -- Only the last four characters. The full number stays with the provider.
  member_number_last4 text check (member_number_last4 ~ '^[A-Z0-9]{4}$'),
  tier text,
  valid_until timestamptz,
  source text not null,
  synced_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

create table public.membership_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_ref text not null,
  title text not null,
  description text not null default '',
  valid_until timestamptz,
  source text not null,
  synced_at timestamptz not null default now(),
  unique (user_id, provider_ref)
);

-- ---------------------------------------------------------------------------
-- Football (provider-synchronised or manually approved)
-- ---------------------------------------------------------------------------
create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  provider_ref text not null,
  competition_id text not null,
  competition_name text not null,
  home_team_id text not null,
  home_team_name text not null,
  home_is_club boolean not null,
  away_team_id text not null,
  away_team_name text not null,
  away_is_club boolean not null,
  venue text,
  kickoff timestamptz,
  kickoff_confirmed boolean not null default false,
  status public.fixture_status not null default 'tbc',
  home_score smallint check (home_score >= 0),
  away_score smallint check (away_score >= 0),
  ticketing_available boolean not null default false,
  -- Manually entered fixtures are hidden until a content admin approves them.
  approved boolean not null default false,
  updated_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (source, provider_ref),
  check (home_is_club or away_is_club),
  check ((home_score is null) = (away_score is null))
);

create table public.matches (
  fixture_id uuid primary key references public.fixtures (id) on delete cascade,
  minute smallint,
  lineups jsonb,
  stats jsonb,
  source text not null,
  synced_at timestamptz not null default now()
);

create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  provider_ref text not null,
  minute smallint not null check (minute between 0 and 130),
  added_minute smallint check (added_minute between 0 and 30),
  type text not null,
  side text check (side in ('home', 'away')),
  player_id uuid,
  description text,
  source text not null,
  synced_at timestamptz not null default now(),
  unique (fixture_id, provider_ref)
);

create table public.squads (
  id text primary key check (id in ('first-team', 'women', 'academy')),
  name text not null
);

insert into public.squads (id, name) values ('first-team', 'First team'), ('women', 'Women'), ('academy', 'Academy');

create table public.players (
  id uuid primary key default gen_random_uuid(),
  squad_id text not null references public.squads (id),
  source text not null,
  provider_ref text not null,
  display_name text not null,
  shirt_number smallint check (shirt_number between 1 and 99),
  position text not null check (position in ('goalkeeper', 'defender', 'midfielder', 'forward', 'staff')),
  image_path text,
  bio text,
  approved boolean not null default false,
  updated_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (source, provider_ref)
);

-- ---------------------------------------------------------------------------
-- Tickets (provider-synchronised). Entry tokens are NOT stored: they are
-- fetched from the ticketing provider at the moment of display.
-- ---------------------------------------------------------------------------
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  provider_ref text not null,
  fixture_id uuid references public.fixtures (id),
  event_name text not null,
  event_start timestamptz,
  seat jsonb,
  status public.ticket_status not null default 'active',
  source text not null,
  synced_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

comment on table public.tickets is
  'Ticket summaries only. Entry tokens are short-lived, come from the ticketing provider at display time and are never persisted.';

-- ---------------------------------------------------------------------------
-- Fan Moments
-- ---------------------------------------------------------------------------
create table public.fan_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 280),
  media_kind text not null check (media_kind in ('image', 'video')),
  status public.fan_post_status not null default 'pending_review',
  status_reason text,
  shows_minors boolean not null,
  guardian_consent boolean not null default false,
  rights_confirmed boolean not null check (rights_confirmed),
  show_display_name boolean not null default false,
  consent_terms_version text not null check (consent_terms_version <> ''),
  consent_rules_version text not null check (consent_rules_version <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  check (not shows_minors or guardian_consent)
);

create table public.fan_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.fan_posts (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/heic', 'image/webp', 'video/mp4', 'video/quicktime')),
  bytes integer not null check (bytes > 0),
  duration_seconds numeric check (duration_seconds is null or duration_seconds <= 30),
  -- Set by the upload pipeline's malware and content scan.
  scan_status text not null default 'pending' check (scan_status in ('pending', 'clean', 'rejected')),
  created_at timestamptz not null default now(),
  check (
    (mime_type like 'image/%' and bytes <= 10485760)
    or (mime_type like 'video/%' and bytes <= 52428800)
  )
);

create table public.fan_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.fan_posts (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason public.report_reason not null,
  details text check (details is null or char_length(details) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  -- One report per supporter per moment: a basic abuse control.
  unique (post_id, reporter_id)
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.fan_posts (id) on delete cascade,
  actor_id uuid not null,
  action public.moderation_action not null,
  from_status public.fan_post_status not null,
  to_status public.fan_post_status not null,
  reason text not null check (reason <> ''),
  created_at timestamptz not null default now()
);

-- Mirror of nextModerationStatus() in packages/contracts/src/fan.ts.
create or replace function private.next_moderation_status(cur public.fan_post_status, act public.moderation_action)
returns public.fan_post_status
language sql
immutable
as $$
  select case
    when cur = 'pending_review' and act = 'approve' then 'approved'
    when cur = 'pending_review' and act = 'reject' then 'rejected'
    when cur = 'pending_review' and act = 'escalate' then 'escalated'
    when cur = 'escalated' and act = 'approve' then 'approved'
    when cur = 'escalated' and act = 'reject' then 'rejected'
    when cur = 'escalated' and act = 'hide' then 'hidden'
    when cur = 'approved' and act = 'hide' then 'hidden'
    when cur = 'approved' and act = 'escalate' then 'escalated'
    when cur = 'hidden' and act = 'restore' then 'approved'
    when cur = 'hidden' and act = 'reject' then 'rejected'
    when cur = 'hidden' and act = 'escalate' then 'escalated'
    else null
  end::public.fan_post_status;
$$;

-- New moments always start in review; moments showing children start escalated.
create or replace function private.fan_posts_before_insert()
returns trigger
language plpgsql
as $$
begin
  if private.is_api_user() then
    new.status := case when new.shows_minors then 'escalated' else 'pending_review' end;
    new.status_reason := null;
    new.removed_at := null;
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger fan_posts_before_insert before insert on public.fan_posts
  for each row execute function private.fan_posts_before_insert();

-- ---------------------------------------------------------------------------
-- Khosi Rewards (provider-synchronised)
-- ---------------------------------------------------------------------------
create table public.rewards_catalog (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  provider_ref text not null,
  title text not null,
  summary text not null default '',
  category text not null check (category in ('matchday', 'merchandise', 'experience', 'partner', 'community')),
  image_path text,
  points_cost integer check (points_cost > 0),
  eligibility jsonb not null default '[]',
  terms text not null,
  partner_name text,
  active boolean not null default true,
  synced_at timestamptz not null default now(),
  unique (source, provider_ref)
);

create table public.reward_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance integer not null check (balance >= 0),
  tier text,
  source text not null,
  synced_at timestamptz not null default now()
);

create table public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reward_id uuid not null references public.rewards_catalog (id),
  -- One row per redemption attempt: a retried request finds the same row.
  idempotency_key uuid not null,
  status public.redemption_status not null default 'pending',
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (status in ('pending', 'failed') or provider_ref is not null)
);

-- ---------------------------------------------------------------------------
-- Content and home modules (CMS)
-- ---------------------------------------------------------------------------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind public.content_kind not null,
  eyebrow text check (eyebrow is null or char_length(eyebrow) <= 40),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 280),
  body jsonb not null default '[]',
  hero_image_path text,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  unpublish_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (publish_at is null or unpublish_at is null or publish_at < unpublish_at)
);

create table public.home_modules (
  id uuid primary key default gen_random_uuid(),
  type public.home_module_type not null,
  sort_order integer not null default 0,
  title text,
  content_ids uuid[] not null default '{}',
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  unpublish_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create or replace function private.is_live_content(s public.content_status, pub timestamptz, unpub timestamptz)
returns boolean
language sql
stable
as $$
  select s in ('published', 'scheduled')
    and (pub is null or pub <= now())
    and (unpub is null or unpub > now());
$$;

grant execute on function private.is_live_content(public.content_status, timestamptz, timestamptz) to anon, authenticated;

-- Publishing needs content.publish, not just content.write. Every status
-- change is audited.
create or replace function private.content_guard()
returns trigger
language plpgsql
as $$
begin
  if private.is_api_user()
     and new.status in ('published', 'scheduled')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and not private.has_permission('content.publish') then
    raise exception 'publishing requires content.publish' using errcode = '42501';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    perform private.audit('content.' || new.status::text, tg_table_name, new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status));
  elsif tg_op = 'INSERT' then
    perform private.audit('content.create', tg_table_name, new.id::text, jsonb_build_object('status', new.status));
  end if;
  return new;
end;
$$;

create trigger content_items_guard before insert or update on public.content_items
  for each row execute function private.content_guard();
create trigger home_modules_guard before insert or update on public.home_modules
  for each row execute function private.content_guard();

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category public.notification_category not null,
  title text not null check (char_length(title) between 1 and 65),
  body text not null default '' check (char_length(body) <= 178),
  deep_link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  category public.notification_category not null check (category <> 'account'),
  title text not null check (char_length(title) between 1 and 65),
  body text not null check (char_length(body) between 1 and 178),
  deep_link text,
  audience public.campaign_audience not null,
  fixture_id uuid references public.fixtures (id),
  scheduled_for timestamptz,
  status public.campaign_status not null default 'draft',
  provider_ref text,
  created_by uuid,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (audience <> 'opted_in_ticket_holders' or fixture_id is not null),
  check (status <> 'scheduled' or scheduled_for is not null)
);

-- Drafting and scheduling are separate permissions; scheduling is audited.
create or replace function private.campaign_guard()
returns trigger
language plpgsql
as $$
begin
  if private.is_api_user() then
    if new.status = 'sent' then
      raise exception 'campaigns are marked sent only by the delivery service' using errcode = '42501';
    end if;
    if new.status = 'scheduled' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
      if not private.has_permission('notifications.schedule') then
        raise exception 'scheduling requires notifications.schedule' using errcode = '42501';
      end if;
      if new.scheduled_for < now() + interval '5 minutes' then
        raise exception 'campaigns must be scheduled at least 5 minutes ahead' using errcode = '22023';
      end if;
      new.approved_by := auth.uid();
      perform private.audit('campaign.schedule', 'notification_campaigns', new.id::text,
        jsonb_build_object('audience', new.audience, 'scheduled_for', new.scheduled_for));
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger notification_campaigns_guard before insert or update on public.notification_campaigns
  for each row execute function private.campaign_guard();

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------
create table public.integration_sync_logs (
  id bigint generated always as identity primary key,
  provider text not null,
  operation text not null,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  records integer,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.feature_flags (
  key text primary key check (key in ('content', 'matchData', 'membership', 'tickets', 'fanMoments', 'commerce', 'rewards', 'notifications', 'payments')),
  mode public.capability_mode not null default 'off',
  updated_by uuid,
  updated_at timestamptz not null default now(),
  check (key <> 'payments' or mode = 'off')
);
