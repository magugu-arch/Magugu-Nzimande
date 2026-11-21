-- Scarlets One: supporter-app concept. Not an official Scarlets Rugby product.
--
-- 0002  Tables. Access rules are in 0003, behaviour (triggers) in 0004.
--
-- Shapes follow the zod schemas in packages/domain/src. Where a provider is the
-- system of record (tickets, membership, rewards, fixtures) the table is a
-- cache of what that provider said, never a second source of truth.

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

-- One row per account. `id` equals the Supabase Auth user id, so policies can
-- compare `user_id = auth.uid()` without a lookup.
--
-- The row is never deleted. Account deletion anonymises it into a tombstone
-- (see 0005): consent and audit history keep pointing at an opaque id that no
-- longer identifies anyone.
create table if not exists public.users (
  id uuid primary key,
  -- The Auth identity behind the account; null once that identity is gone.
  auth_provider_id uuid unique references auth.users (id) on delete set null,
  -- Contact details stay in Supabase Auth. These two columns exist only for a
  -- provider integration that genuinely needs a copy, and are service-written.
  email text check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint users_auth_link_matches_id check (auth_provider_id is null or auth_provider_id = id),
  constraint users_tombstone_has_no_identity check (
    account_status <> 'deleted'
    or (email is null and phone is null and auth_provider_id is null and deleted_at is not null)
  )
);

-- Commercial partners. `approved` is false for the placeholder slots that
-- stand in until the club names real partners.
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  category jsonb check (category is null or app.is_localized_text(category)),
  description jsonb check (description is null or app.is_localized_text(description)),
  approved boolean not null default false,
  cta jsonb check (cta is null or (cta ->> 'url') ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who holds which console role. The role comes from this table and never from
-- a JWT claim, because a claim is minted once and outlives a revocation.
-- Every signed-in account is a supporter without needing a row here.
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- `service` is deliberately not assignable: it is the backend's database
  -- role, so no person can ever hold rewards.adjust.
  role text not null
    check (role in ('supporter', 'editor', 'moderator', 'club_admin', 'partner_admin')),
  -- A partner_admin is always scoped to exactly one partner.
  partner_id uuid references public.partners (id) on delete cascade,
  granted_by uuid references public.users (id) default auth.uid(),
  granted_at timestamptz not null default now(),
  constraint user_roles_partner_scope check ((role = 'partner_admin') = (partner_id is not null))
);
create unique index if not exists user_roles_unique_global
  on public.user_roles (user_id, role) where partner_id is null;
create unique index if not exists user_roles_unique_partner
  on public.user_roles (user_id, role, partner_id) where partner_id is not null;

create table if not exists public.profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  language text not null default 'en' check (language in ('en', 'cy')),
  favourite_teams text[] not null default '{}'
    check (favourite_teams <@ array['first_team', 'women', 'academy']::text[]),
  accessibility_preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(accessibility_preferences) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SERVICE notification preferences only: messages about things the supporter
-- chose to follow. Marketing consent is a different table on purpose, so
-- turning on match alerts can never be read as agreeing to marketing.
create table if not exists public.preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  match_alerts boolean not null default false,
  ticket_reminders boolean not null default false,
  club_news boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Current marketing consent, one row per purpose. No row means "not given",
-- and a new row defaults to false. Every change is copied to consent_log.
create table if not exists public.marketing_consents (
  user_id uuid not null references public.users (id) on delete cascade,
  purpose text not null check (purpose in ('club_email', 'club_push', 'club_sms', 'partner_offers')),
  granted boolean not null default false,
  -- Which wording the supporter saw when they chose.
  policy_version text not null check (char_length(policy_version) between 1 and 40),
  updated_at timestamptz not null default now(),
  primary key (user_id, purpose)
);

-- Append-only evidence of every consent given or withdrawn. Written by
-- triggers only. It references the account without cascading: the proof that
-- consent existed must outlive the profile it belonged to.
create table if not exists public.consent_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id),
  purpose text not null
    check (purpose in ('club_email', 'club_push', 'club_sms', 'partner_offers', 'fan_cam')),
  granted boolean not null,
  policy_version text,
  source text not null check (source in ('app', 'api', 'system', 'account_deletion')),
  -- Opaque identifiers only (for example the consent record id). Never text a
  -- person typed.
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  recorded_at timestamptz not null default now()
);
create index if not exists consent_log_user_idx on public.consent_log (user_id, recorded_at);

-- A link to the club's membership system. Eligibility is that system's to
-- state: the row is written by the service after verification, never by the
-- supporter, who can only read it or unlink it.
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- An opaque token from the membership system, not the member number.
  club_member_token text not null check (char_length(club_member_token) between 8 and 200),
  -- Display only, already masked by the provider adapter (for example "••••1234").
  member_ref_masked text check (member_ref_masked is null or char_length(member_ref_masked) <= 24),
  membership_type text,
  season text,
  eligibility_status text not null default 'pending_verification'
    check (eligibility_status in ('pending_verification', 'eligible', 'ineligible', 'lapsed')),
  valid_from timestamptz,
  valid_to timestamptz,
  source_system text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_valid_range check (valid_from is null or valid_to is null or valid_to > valid_from),
  unique (user_id, source_system),
  unique (source_system, club_member_token)
);

-- ---------------------------------------------------------------------------
-- Rugby reference data (public; written by the service from provider feeds)
-- ---------------------------------------------------------------------------

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  provider_id text unique,
  name text not null,
  short_name text not null,
  is_scarlets boolean not null default false,
  updated_at timestamptz not null default now()
);

-- A name is only ever set from an official team sheet.
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  provider_id text unique,
  team_id uuid not null references public.teams (id) on delete cascade,
  squad text check (squad in ('first_team', 'women', 'academy')),
  display_name text not null,
  position jsonb check (position is null or app.is_localized_text(position)),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists players_team_idx on public.players (team_id);

create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null unique,
  squad text not null check (squad in ('first_team', 'women', 'academy')),
  competition jsonb not null check (app.is_localized_text(competition)),
  round text,
  home_team_id uuid not null references public.teams (id),
  away_team_id uuid not null references public.teams (id),
  venue_name text not null,
  venue_city text,
  -- Kept so display can convert; the stored instant is always UTC.
  venue_time_zone text not null default 'Europe/London',
  kickoff_utc timestamptz not null,
  kickoff_provisional boolean not null default false,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'half_time', 'full_time', 'postponed', 'cancelled')),
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  ticketing text not null default 'unavailable'
    check (ticketing in ('link_out', 'not_on_sale', 'away', 'unavailable')),
  note jsonb check (note is null or app.is_localized_text(note)),
  -- When the provider last confirmed this row; drives the freshness label.
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixtures_two_teams check (home_team_id <> away_team_id),
  constraint fixtures_score_both_or_neither check ((home_score is null) = (away_score is null))
);
create index if not exists fixtures_kickoff_idx on public.fixtures (kickoff_utc);

-- A club_admin correction laid over the feed (fixtures.override). It is a
-- separate row rather than an edit to `fixtures`, because the next sync would
-- overwrite an edit and nobody would know a person had stepped in.
create table if not exists public.fixture_overrides (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  status text check (status in ('scheduled', 'live', 'half_time', 'full_time', 'postponed', 'cancelled')),
  kickoff_utc timestamptz,
  kickoff_provisional boolean,
  note jsonb check (note is null or app.is_localized_text(note)),
  reason text not null check (char_length(reason) between 3 and 500),
  created_by uuid references public.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint fixture_overrides_changes_something
    check (status is not null or kickoff_utc is not null or kickoff_provisional is not null or note is not null)
);
create index if not exists fixture_overrides_fixture_idx on public.fixture_overrides (fixture_id);

-- Append-only. A correction is a new row with the same provider_event_id and a
-- higher revision; a withdrawal is a new revision with voided = true. Readers
-- take the highest revision per event (currentEvents in the domain package).
create table if not exists public.match_events (
  id bigint generated always as identity primary key,
  fixture_id uuid not null references public.fixtures (id) on delete restrict,
  provider_event_id text not null,
  revision integer not null check (revision >= 1),
  event_type text not null check (event_type in (
    'kick_off', 'try', 'conversion', 'conversion_missed', 'penalty_goal', 'penalty_missed',
    'drop_goal', 'yellow_card', 'red_card', 'substitution', 'half_time', 'second_half', 'full_time'
  )),
  clock_minute integer not null check (clock_minute >= 0),
  team_side text check (team_side in ('home', 'away')),
  player_ref uuid references public.players (id),
  shirt_number integer check (shirt_number between 1 and 23),
  replaced_shirt_number integer check (replaced_shirt_number between 1 and 23),
  player_name text,
  voided boolean not null default false,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  source_timestamp timestamptz not null,
  received_at timestamptz not null default now(),
  -- The idempotency key for the live feed: replaying a delivery is rejected.
  constraint match_events_event_revision_key unique (provider_event_id, revision)
);
create index if not exists match_events_fixture_idx on public.match_events (fixture_id, clock_minute);

-- ---------------------------------------------------------------------------
-- Media and editorial content
-- ---------------------------------------------------------------------------

-- Every stored file, including supporter uploads. The constraints below are
-- the upload rules: the Edge Function validates first, and the database
-- refuses anything that slips past it.
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  origin text not null check (origin in ('club', 'partner', 'supporter')),
  owner_id uuid references public.users (id),
  partner_id uuid references public.partners (id) on delete cascade,
  bucket text not null check (bucket ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
  object_path text not null,
  mime_type text not null,
  byte_size bigint not null,
  width integer check (width between 1 and 12000),
  height integer check (height between 1 and 12000),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  alt jsonb check (alt is null or app.is_localized_text(alt)),
  -- Set by the service after it has inspected the real bytes. Nothing is
  -- shown publicly, or approved, until it is 'clean'.
  scan_status text not null default 'pending' check (scan_status in ('pending', 'clean', 'rejected')),
  moderation_status text not null default 'pending'
    check (moderation_status in ('not_required', 'pending', 'approved', 'rejected', 'withdrawn')),
  -- Supplied visuals are concept material until the club confirms the rights.
  rights_status text not null default 'concept' check (rights_status in ('concept', 'cleared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, object_path),
  -- Lets fan_activities prove "this photo was uploaded by the same person".
  unique (id, owner_id),
  -- Still images only. No SVG (it can carry script) and no video (video is an
  -- official deep link, never hosted here).
  constraint media_assets_mime_allowed
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  -- 10 MiB for a supporter upload, 25 MiB for club and partner artwork.
  constraint media_assets_size_limit
    check (byte_size > 0 and byte_size <= case when origin = 'supporter' then 10485760 else 26214400 end),
  -- One dot, in the extension: no "../", no "photo.php.jpg", no hidden files.
  constraint media_assets_safe_path
    check (object_path ~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*\.(jpg|jpeg|png|webp)$'
           and char_length(object_path) <= 300),
  constraint media_assets_extension_matches_mime check (
    (mime_type = 'image/jpeg' and object_path ~ '\.(jpg|jpeg)$')
    or (mime_type = 'image/png' and object_path ~ '\.png$')
    or (mime_type = 'image/webp' and object_path ~ '\.webp$')
  ),
  -- A supporter upload has an owner and lives in that owner's folder of the
  -- private bucket; nothing else has an owner.
  constraint media_assets_supporter_owned check (
    case when origin = 'supporter'
      then owner_id is not null and bucket = 'fan-cam' and starts_with(object_path, owner_id::text || '/')
      else owner_id is null
    end
  ),
  constraint media_assets_partner_scoped check ((origin = 'partner') = (partner_id is not null)),
  -- Club artwork is not moderated; everything else always is.
  constraint media_assets_moderated_unless_club check ((origin = 'club') = (moderation_status = 'not_required')),
  constraint media_assets_approved_only_if_clean check (moderation_status <> 'approved' or scan_status = 'clean')
);
create index if not exists media_assets_owner_idx on public.media_assets (owner_id) where owner_id is not null;

-- Stored as language variants from day one: English required, Welsh optional.
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('news', 'feature', 'report', 'video', 'audio')),
  category text not null
    check (category in ('first_team', 'women', 'academy', 'community', 'history', 'club', 'matchday')),
  title jsonb not null check (app.is_localized_text(title)),
  summary jsonb not null check (app.is_localized_text(summary)),
  -- One localised entry per paragraph.
  body jsonb not null default '[]'::jsonb check (jsonb_typeof(body) = 'array'),
  media_asset_id uuid references public.media_assets (id),
  caption jsonb check (caption is null or app.is_localized_text(caption)),
  credit text,
  publish_at timestamptz,
  expire_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  translation_status text not null default 'missing'
    check (translation_status in ('approved', 'draft', 'missing')),
  pinned boolean not null default false,
  fixture_id uuid references public.fixtures (id),
  -- Video and audio are official deep links only.
  link jsonb check (link is null or (link ->> 'url') ~ '^https://'),
  duration_label text,
  captions boolean,
  created_by uuid references public.users (id) default auth.uid(),
  published_by uuid references public.users (id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_items_expiry_after_publish
    check (expire_at is null or publish_at is null or expire_at > publish_at),
  constraint content_items_live_needs_publish_time
    check (status not in ('scheduled', 'published') or publish_at is not null)
);
create index if not exists content_items_live_idx on public.content_items (publish_at desc) where status = 'published';

-- ---------------------------------------------------------------------------
-- Partners: campaigns and offers
-- ---------------------------------------------------------------------------

create table if not exists public.partner_campaigns (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  -- NOT NULL: there is no such thing as an unlabelled commercial placement.
  label text not null check (label in ('partner_feature', 'partner_offer', 'sponsored', 'official_shop')),
  placement text not null
    check (placement in ('home', 'match_centre', 'matchday', 'passport', 'fan_zone', 'partner_world')),
  title jsonb not null check (app.is_localized_text(title)),
  body jsonb not null check (app.is_localized_text(body)),
  media_asset_id uuid references public.media_assets (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  cta jsonb check (cta is null or (cta ->> 'url') ~ '^https://'),
  -- Eligibility and redemption terms come from the partner. Null hides redemption.
  terms jsonb check (terms is null or app.is_localized_text(terms)),
  priority integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'paused')),
  approved_by uuid references public.users (id),
  approved_at timestamptz,
  created_by uuid references public.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_campaigns_window check (ends_at > starts_at),
  -- At most one APPROVED campaign per placement at any instant. Two approved
  -- campaigns for the same placement cannot have overlapping windows, so
  -- "running now" can never have two answers. Being a constraint, it also
  -- holds when two approvals are committed at the same moment.
  constraint partner_campaigns_one_approved_per_placement
    exclude using gist (placement with =, tstzrange(starts_at, ends_at, '[)') with &&)
    where (status = 'approved')
);
create index if not exists partner_campaigns_partner_idx on public.partner_campaigns (partner_id);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  campaign_id uuid references public.partner_campaigns (id) on delete set null,
  -- The partner's own identifier for the offer, when they have one.
  provider_offer_id text,
  placement text not null
    check (placement in ('home', 'match_centre', 'matchday', 'passport', 'fan_zone', 'partner_world')),
  label text not null default 'partner_offer'
    check (label in ('partner_feature', 'partner_offer', 'sponsored', 'official_shop')),
  title jsonb not null check (app.is_localized_text(title)),
  terms jsonb check (terms is null or app.is_localized_text(terms)),
  eligibility text not null default 'everyone' check (eligibility in ('everyone', 'signed_in', 'members')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Where the offer is fulfilled: always the partner's own https page.
  destination_url text check (destination_url is null or destination_url ~ '^https://'),
  approved_asset_ids uuid[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'paused')),
  approved_by uuid references public.users (id),
  approved_at timestamptz,
  created_by uuid references public.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_window check (ends_at > starts_at),
  unique (partner_id, provider_offer_id)
);
create index if not exists offers_partner_idx on public.offers (partner_id);

-- ---------------------------------------------------------------------------
-- Rewards (a cache of the rewards provider; written by the service only)
-- ---------------------------------------------------------------------------

-- No reward economics live here: no default balance, no tiers, no earning
-- rules, no expiry periods. A value is present only if the provider sent it.
create table if not exists public.rewards_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  scheme_id text not null,
  provider_member_ref text not null,
  -- Null means "the provider has not supplied a balance". Never computed here.
  balance numeric,
  balance_as_of timestamptz,
  -- Free text from the provider; there is no list of tiers to check against.
  tier text,
  sync_status text not null default 'never_synced'
    check (sync_status in ('never_synced', 'synced', 'stale', 'error', 'unlinked')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scheme_id),
  unique (scheme_id, provider_member_ref),
  -- Lets reward_transactions prove the wallet belongs to the same supporter.
  unique (id, user_id),
  -- A balance without the provider's timestamp cannot be labelled honestly.
  constraint rewards_wallets_balance_is_dated check (balance is null or balance_as_of is not null)
);

-- One row per delivery from a provider. (provider, event_id) is the
-- idempotency key: a redelivered webhook finds its row and is not applied
-- twice. Only a hash of the payload is kept, because payloads can carry
-- personal data and this table is not where that should live.
create table if not exists public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null check (char_length(provider) between 1 and 60),
  event_id text not null check (char_length(event_id) between 1 and 200),
  event_type text,
  payload_sha256 text check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  attempts integer not null default 1 check (attempts >= 1),
  error_code text,
  received_at timestamptz not null default now(),
  last_received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint webhook_events_idempotency_key unique (provider, event_id)
);

create table if not exists public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  -- The idempotency key: the same provider transaction can be stored once.
  provider_txn_id text not null constraint reward_transactions_provider_txn_key unique,
  wallet_id uuid not null,
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('earned', 'pending', 'redeemed', 'expired', 'reversed')),
  title jsonb check (title is null or app.is_localized_text(title)),
  -- Null means "not supplied by the provider". There is no default and no
  -- calculation: the app never works out an amount itself.
  amount numeric,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'reversed', 'failed')),
  occurred_at timestamptz not null,
  -- Provider-supplied. No expiry period is assumed anywhere.
  expires_at timestamptz,
  redemption_ref text,
  -- Audit metadata: which system said so, and in which delivery.
  source_system text not null,
  webhook_event_id bigint references public.webhook_events (id) on delete set null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (wallet_id, user_id) references public.rewards_wallets (id, user_id) on delete cascade
);
create index if not exists reward_transactions_user_idx on public.reward_transactions (user_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Fan Zone
-- ---------------------------------------------------------------------------

-- What supporters can take part in: a poll, prediction, quiz, Fan Cam or
-- challenge (the `fanActivity` union in the domain package).
create table if not exists public.activity_definitions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('poll', 'prediction', 'quiz', 'fan_cam', 'challenge')),
  title jsonb not null check (app.is_localized_text(title)),
  prompt jsonb not null check (app.is_localized_text(prompt)),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  fixture_id uuid references public.fixtures (id),
  -- Kind-specific detail: poll options, quiz questions, challenge steps.
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  -- A paid placement carries a visible label; null means editorial.
  sponsorship jsonb check (sponsorship is null or app.is_localized_text(sponsorship -> 'label')),
  requires_sign_in boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'approved', 'archived')),
  created_by uuid references public.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_definitions_window check (closes_at > opens_at),
  -- A photo needs an accountable person behind it.
  constraint activity_definitions_fan_cam_needs_account check (kind <> 'fan_cam' or requires_sign_in),
  constraint activity_definitions_poll_has_options
    check (kind <> 'poll' or jsonb_typeof(config -> 'options') = 'array'),
  constraint activity_definitions_challenge_has_steps
    check (kind <> 'challenge' or jsonb_typeof(config -> 'steps') = 'array'),
  -- Lets a submission's activity_type be checked against the activity's kind.
  unique (id, kind)
);

-- The Fan Cam consent record. All three permissions are explicit and separate,
-- and the CHECK makes a record without all three impossible to store: there is
-- no "partial consent" row for a photo to hang off.
create table if not exists public.fan_cam_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  age_or_guardian boolean not null,
  people_in_photo boolean not null,
  display_and_moderation boolean not null,
  policy_version text not null check (char_length(policy_version) between 1 and 40),
  granted_at timestamptz not null default now(),
  -- Set when the supporter withdraws the photo. The record itself stays as
  -- evidence of what was agreed and when.
  withdrawn_at timestamptz,
  constraint fan_cam_consents_all_three_given
    check (age_or_guardian and people_in_photo and display_and_moderation),
  -- Lets fan_activities prove the consent was given by the same person.
  unique (id, user_id)
);
create index if not exists fan_cam_consents_user_idx on public.fan_cam_consents (user_id);

-- One row per entry a supporter (or a guest device) makes: the vote, the
-- predicted score, the quiz answers, the photo, the completed challenge step.
create table if not exists public.fan_activities (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  activity_type text not null,
  user_id uuid references public.users (id),
  -- Guests only: a keyed hash of the install id, computed by the API. The raw
  -- device id is never stored.
  device_hash text check (device_hash is null or device_hash ~ '^[0-9a-f]{64}$'),
  fixture_id uuid references public.fixtures (id),
  submission jsonb not null check (jsonb_typeof(submission) = 'object'),
  media_asset_id uuid,
  consent_record_id uuid,
  moderation_status text not null
    check (moderation_status in ('not_required', 'pending', 'approved', 'rejected', 'withdrawn')),
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  -- Set by retention when the link to a person is removed from an old entry.
  anonymised_at timestamptz,

  foreign key (activity_id, activity_type) references public.activity_definitions (id, kind),
  -- Same-person guarantees: the photo and the consent both belong to user_id.
  foreign key (media_asset_id, user_id) references public.media_assets (id, owner_id),
  foreign key (consent_record_id, user_id) references public.fan_cam_consents (id, user_id),

  constraint fan_activities_attributable
    check (user_id is not null or device_hash is not null or anonymised_at is not null),
  -- A Fan Cam entry cannot exist without an account, a photo and a consent
  -- record. The consent table only holds records with all three permissions.
  constraint fan_activities_fan_cam_requires_consent check (
    activity_type <> 'fan_cam'
    or (user_id is not null and media_asset_id is not null and consent_record_id is not null)
  ),
  constraint fan_activities_only_fan_cam_has_media check (
    activity_type = 'fan_cam' or (media_asset_id is null and consent_record_id is null)
  ),
  -- Anything uploaded is held for a moderator; nothing else is moderated.
  constraint fan_activities_moderation_matches_type check (
    case when activity_type = 'fan_cam'
      then moderation_status <> 'not_required'
      else moderation_status in ('not_required', 'withdrawn')
    end
  ),
  constraint fan_activities_withdrawn_is_dated
    check ((moderation_status = 'withdrawn') = (withdrawn_at is not null)),
  constraint fan_activities_submission_shape check (
    case activity_type
      when 'poll' then jsonb_typeof(submission -> 'optionId') = 'string'
      when 'prediction' then
        jsonb_typeof(submission -> 'home') = 'number' and jsonb_typeof(submission -> 'away') = 'number'
        and (submission ->> 'home')::numeric between 0 and 150 and (submission ->> 'home')::numeric % 1 = 0
        and (submission ->> 'away')::numeric between 0 and 150 and (submission ->> 'away')::numeric % 1 = 0
      when 'quiz' then jsonb_typeof(submission -> 'answers') = 'object'
      when 'challenge' then jsonb_typeof(submission -> 'stepId') = 'string'
      when 'fan_cam' then coalesce(char_length(submission ->> 'caption'), 0) <= 140
      else false
    end
  )
);

-- One live entry per account for a poll, prediction or quiz. A withdrawn entry
-- no longer counts, so withdrawing and entering again is allowed.
create unique index if not exists fan_activities_one_per_user
  on public.fan_activities (activity_id, user_id)
  where activity_type in ('poll', 'prediction', 'quiz') and moderation_status <> 'withdrawn' and user_id is not null;
-- The guest equivalent: one per install.
create unique index if not exists fan_activities_one_per_device
  on public.fan_activities (activity_id, device_hash)
  where activity_type in ('poll', 'prediction', 'quiz') and moderation_status <> 'withdrawn'
    and user_id is null and device_hash is not null;
-- A challenge step can be completed once per account or install.
create unique index if not exists fan_activities_one_step_per_user
  on public.fan_activities (activity_id, user_id, (submission ->> 'stepId'))
  where activity_type = 'challenge' and moderation_status <> 'withdrawn' and user_id is not null;
create unique index if not exists fan_activities_one_step_per_device
  on public.fan_activities (activity_id, device_hash, (submission ->> 'stepId'))
  where activity_type = 'challenge' and moderation_status <> 'withdrawn'
    and user_id is null and device_hash is not null;
-- A photo, and the consent given for it, belong to exactly one entry.
create unique index if not exists fan_activities_media_once
  on public.fan_activities (media_asset_id) where media_asset_id is not null;
create unique index if not exists fan_activities_consent_once
  on public.fan_activities (consent_record_id) where consent_record_id is not null;
create index if not exists fan_activities_user_idx on public.fan_activities (user_id) where user_id is not null;

-- A moderator's queue. A case is opened automatically for every Fan Cam entry
-- (pre-moderation) and by a supporter's report of something already shown.
-- Deciding the case is what approves or rejects the entry (0004).
create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  fan_activity_id uuid references public.fan_activities (id) on delete set null,
  media_asset_id uuid references public.media_assets (id) on delete set null,
  opened_reason text not null check (opened_reason in ('pre_moderation', 'report')),
  report_reason text check (report_reason in ('inappropriate', 'safety', 'privacy', 'spam', 'other')),
  reported_by uuid references public.users (id) default auth.uid(),
  -- 'approved' and 'rejected' are the decision about the content;
  -- 'closed' means the supporter withdrew it before a decision was needed.
  status text not null default 'open' check (status in ('open', 'approved', 'rejected', 'escalated', 'closed')),
  decision_reason text check (decision_reason in (
    'ok', 'inappropriate', 'safety', 'privacy', 'spam', 'quality', 'consent_withdrawn', 'other'
  )),
  -- Internal. Cleared by retention and by account deletion.
  notes text check (notes is null or char_length(notes) <= 2000),
  decided_by uuid references public.users (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint moderation_cases_report_has_reason check ((opened_reason = 'report') = (report_reason is not null)),
  constraint moderation_cases_decision_is_dated check (status not in ('approved', 'rejected') or decided_at is not null)
);
create index if not exists moderation_cases_queue_idx on public.moderation_cases (status, created_at);
create index if not exists moderation_cases_subject_idx on public.moderation_cases (fan_activity_id);
-- One report per person per item.
create unique index if not exists moderation_cases_one_report_each
  on public.moderation_cases (fan_activity_id, reported_by)
  where opened_reason = 'report' and reported_by is not null;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

-- A send, addressed to a segment (a rule, never a list of people) or, for a
-- service message, to one account. `consent_check` records which permission
-- the sender had to verify before delivery.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  template_id text not null check (char_length(template_id) between 1 and 120),
  category text not null check (category in ('service', 'marketing')),
  segment jsonb not null default '{}'::jsonb check (jsonb_typeof(segment) = 'object'),
  user_id uuid references public.users (id) on delete cascade,
  consent_check text not null check (consent_check in ('service_preference', 'marketing_consent')),
  consent_purpose text check (consent_purpose in ('club_email', 'club_push', 'club_sms', 'partner_offers')),
  send_status text not null default 'draft'
    check (send_status in ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamptz,
  provider_message_id text unique,
  sent_at timestamptz,
  created_by uuid references public.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Marketing can never be sent on the strength of a service preference.
  constraint notifications_marketing_needs_marketing_consent check (
    category <> 'marketing' or (consent_check = 'marketing_consent' and consent_purpose is not null)
  ),
  constraint notifications_sent_is_dated check (send_status <> 'sent' or sent_at is not null)
);
create index if not exists notifications_user_idx on public.notifications (user_id) where user_id is not null;

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  -- Guests: the same keyed hash used for one-vote-per-device.
  device_hash text check (device_hash is null or device_hash ~ '^[0-9a-f]{64}$'),
  platform text not null check (platform in ('ios', 'android', 'web')),
  token text not null unique check (char_length(token) between 16 and 4096),
  locale text check (locale in ('en', 'cy')),
  created_at timestamptz not null default now(),
  -- Refreshed on each app open; retention removes tokens that stop being seen.
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint device_tokens_attributable check (user_id is not null or device_hash is not null)
);
create index if not exists device_tokens_user_idx on public.device_tokens (user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------

-- Append-only history of who changed what. `before` / `after` hold only the
-- columns each audited table explicitly allow-lists (statuses, dates, ids):
-- never a name, an email, a token, a member reference or free text. Other
-- columns appear by name only, in `changed_columns`.
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- An opaque account id with no foreign key: history neither blocks an
  -- account deletion nor disappears with one.
  actor_id uuid,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  changed_columns text[] not null default '{}',
  before jsonb,
  after jsonb
);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_time_idx on public.audit_logs (occurred_at);

create table if not exists public.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_.]{1,60}$'),
  enabled boolean not null default false,
  description text,
  updated_by uuid references public.users (id) default auth.uid(),
  updated_at timestamptz not null default now()
);

-- One row per counted action; see public.check_rate_limit in 0004. The subject
-- format forbids dots and colons after the prefix, so a raw IP address cannot
-- be stored by mistake: callers must pass an account id or a hash.
create table if not exists public.rate_limit_hits (
  id bigint generated always as identity primary key,
  subject text not null check (subject ~ '^[a-z]+:[A-Za-z0-9_-]{16,128}$'),
  action text not null check (action ~ '^[a-z][a-z0-9_.]{1,60}$'),
  hit_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_lookup_idx on public.rate_limit_hits (subject, action, hit_at);

-- Limits the database itself applies when a signed-in client writes straight
-- to a table instead of going through the API.
create table if not exists app.rate_limit_rules (
  action text primary key,
  max_hits integer not null check (max_hits >= 1),
  per interval not null check (per > interval '0')
);
-- RATE_LIMIT_PER_MINUTE in packages/domain/src/fanzone.ts.
insert into app.rate_limit_rules (action, max_hits, per)
values ('fanzone.submit', 6, interval '1 minute')
on conflict (action) do nothing;
alter table app.rate_limit_rules enable row level security;
revoke all on app.rate_limit_rules from public, anon, authenticated;
