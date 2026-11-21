-- Scarlets One: supporter-app concept. Not an official Scarlets Rugby product.
--
-- 0003  Who can read and write what.
--
-- Three layers, each sufficient on its own for the rule it carries:
--   1. GRANTs      what a database role may attempt at all (and on which columns)
--   2. RLS         which rows that attempt may touch
--   3. constraints rules that hold for everyone, the service role included (0002, 0004)
--
-- Policies never test a role name. They ask `app.has_permission('<permission>')`,
-- which reads public.user_roles and app.role_permissions, so the matrix in
-- packages/domain/src/roles.ts is the only place a role's powers are defined.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True when the caller is not subject to RLS on these tables anyway: the
-- service role, the owner running a migration, or a SECURITY DEFINER function
-- (which runs as the owner). Triggers use it to tell trusted code from a
-- person. It must stay SECURITY INVOKER: it reports on whoever is calling.
create or replace function app.is_service()
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    coalesce((
      select r.rolbypassrls or r.rolsuper
      from pg_catalog.pg_roles r
      where r.rolname = current_user
    ), false)
    or pg_catalog.pg_has_role(
      current_user,
      (select c.relowner from pg_catalog.pg_class c where c.oid = 'public.users'::pg_catalog.regclass),
      'USAGE'
    )
$$;

-- The helpers below are SECURITY DEFINER so that a policy on table A can look
-- at user_roles without user_roles' own policies being evaluated in turn
-- (which would recurse). Each pins search_path and schema-qualifies every name.

create or replace function app.account_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = (select auth.uid()) and u.account_status = 'active'
  )
$$;

-- Does the caller hold `p_permission` through an unscoped role?
-- A partner_admin's roles are always partner-scoped, so they never match here.
create or replace function app.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.users u on u.id = ur.user_id and u.account_status = 'active'
    join app.role_permissions rp on rp.role = ur.role
    where ur.user_id = (select auth.uid())
      and ur.partner_id is null
      and rp.permission = p_permission
  )
$$;

-- Does the caller hold `p_permission` for this partner: through an unscoped
-- role (editor, club_admin) or through a role scoped to exactly this partner?
create or replace function app.has_permission_for_partner(p_permission text, p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.users u on u.id = ur.user_id and u.account_status = 'active'
    join app.role_permissions rp on rp.role = ur.role
    where ur.user_id = (select auth.uid())
      and (ur.partner_id is null or ur.partner_id = p_partner_id)
      and rp.permission = p_permission
  )
$$;

-- The caller's most senior role, for display in the console. Policies do not
-- use it: they ask for permissions.
create or replace function app.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when pg_catalog.current_setting('role', true) = 'service_role' then 'service'
    when (select auth.uid()) is null then null
    else coalesce((
      select ur.role
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
      order by pg_catalog.array_position(
        array['club_admin', 'editor', 'moderator', 'partner_admin', 'supporter'], ur.role)
      limit 1
    ), 'supporter')
  end
$$;

-- Has the membership system confirmed the caller as a current member?
create or replace function app.is_eligible_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid())
      and m.eligibility_status = 'eligible'
      and (m.valid_from is null or m.valid_from <= pg_catalog.now())
      and (m.valid_to is null or m.valid_to > pg_catalog.now())
  )
$$;

-- Is this entry something the public can already see (an approved Fan Cam
-- photo)? Lets a supporter report it without being able to read its row.
create or replace function app.fan_item_is_public(p_fan_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fan_activities f
    where f.id = p_fan_activity_id
      and f.activity_type = 'fan_cam'
      and f.moderation_status = 'approved'
  )
$$;

revoke all on function
  app.is_service(), app.account_is_active(), app.has_permission(text),
  app.has_permission_for_partner(text, uuid), app.current_role(),
  app.is_eligible_member(), app.fan_item_is_public(uuid), app.is_localized_text(jsonb)
from public;
grant execute on function
  app.is_service(), app.account_is_active(), app.has_permission(text),
  app.has_permission_for_partner(text, uuid), app.current_role(),
  app.is_eligible_member(), app.fan_item_is_public(uuid), app.is_localized_text(jsonb)
to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing
-- ---------------------------------------------------------------------------

-- A Supabase project may grant ALL on new public tables to anon and
-- authenticated by default. Take that back, here and for tables created
-- later, so that access exists only where a line below grants it.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- The service role works through RLS-bypassing access, but not TRUNCATE, and
-- not UPDATE/DELETE on the three append-only tables.
revoke all on all tables in schema public from service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
revoke update, delete on public.audit_logs, public.consent_log, public.match_events from service_role;

-- RLS on every table in public, with or without policies. A table with RLS
-- and no policy is closed to anon and authenticated: that is the intended
-- state for the service-only tables.
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Records a supporter owns: only ever their own rows
-- ---------------------------------------------------------------------------

-- The whole ownership matrix in one place. Each listed operation gets a GRANT
-- to `authenticated` and a policy `<owner column> = auth.uid()`; an operation
-- that is not listed is not possible for a signed-in person at all.
--
--   memberships        eligibility is the membership system's to state:
--                      read it, or unlink it, but never write it.
--   rewards_*          read only. Balances and transactions belong to the
--                      rewards provider; only the service role writes them.
--   fan_cam_consents   given once, then immutable (withdrawal goes through
--                      withdrawing the photo, see 0004).
--   consent_log        evidence, written by triggers.
do $$
declare
  spec record;
  op text;
  using_clause text;
begin
  for spec in
    select * from (values
      ('users',               'id',      'select'),
      ('profiles',            'user_id', 'select,insert,update,delete'),
      ('preferences',         'user_id', 'select,insert,update,delete'),
      ('marketing_consents',  'user_id', 'select,insert,update,delete'),
      ('device_tokens',       'user_id', 'select,insert,update,delete'),
      ('fan_cam_consents',    'user_id', 'select,insert'),
      ('consent_log',         'user_id', 'select'),
      ('memberships',         'user_id', 'select,delete'),
      ('rewards_wallets',     'user_id', 'select'),
      ('reward_transactions', 'user_id', 'select')
    ) as t (tbl, owner_col, ops)
  loop
    using_clause := format('%I = (select auth.uid())', spec.owner_col);
    foreach op in array string_to_array(spec.ops, ',') loop
      execute format('grant %s on public.%I to authenticated', op, spec.tbl);
      execute format('drop policy if exists %I on public.%I', spec.tbl || '_' || op || '_own', spec.tbl);
      execute format(
        'create policy %I on public.%I for %s to authenticated %s',
        spec.tbl || '_' || op || '_own',
        spec.tbl,
        op,
        case op
          when 'insert' then 'with check (' || using_clause || ')'
          when 'update' then 'using (' || using_clause || ') with check (' || using_clause || ')'
          else 'using (' || using_clause || ')'
        end
      );
    end loop;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

grant select, insert, delete on public.user_roles to authenticated;

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists user_roles_select_manage on public.user_roles;
create policy user_roles_select_manage on public.user_roles
  for select to authenticated
  using ((select app.has_permission('roles.manage')));

-- A grant is an insert and a revocation is a delete; there is no update, so a
-- role row can never be quietly repointed at another account or partner.
drop policy if exists user_roles_insert_manage on public.user_roles;
create policy user_roles_insert_manage on public.user_roles
  for insert to authenticated
  with check ((select app.has_permission('roles.manage')));

drop policy if exists user_roles_delete_manage on public.user_roles;
create policy user_roles_delete_manage on public.user_roles
  for delete to authenticated
  using ((select app.has_permission('roles.manage')));

-- ---------------------------------------------------------------------------
-- Public reference data: anyone reads, only the service writes
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['teams', 'players', 'fixtures', 'match_events', 'feature_flags'] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_all', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_select_all', t
    );
  end loop;
end
$$;

-- flags.manage
grant insert, update, delete on public.feature_flags to authenticated;
drop policy if exists feature_flags_write on public.feature_flags;
create policy feature_flags_write on public.feature_flags
  for all to authenticated
  using ((select app.has_permission('flags.manage')))
  with check ((select app.has_permission('flags.manage')));

-- fixtures.override: corrections are their own rows, read by the service when
-- it composes a fixture. Supporters never see the internal reason.
grant select, insert, update on public.fixture_overrides to authenticated;
drop policy if exists fixture_overrides_manage on public.fixture_overrides;
create policy fixture_overrides_manage on public.fixture_overrides
  for all to authenticated
  using ((select app.has_permission('fixtures.override')))
  with check ((select app.has_permission('fixtures.override')));

-- ---------------------------------------------------------------------------
-- Editorial content
-- ---------------------------------------------------------------------------
--
--   anyone            what is live: published, inside its publish window
--   content.read      everything except drafts (moderator, editor, club_admin)
--   content.write     everything, and may create or change drafts and archived
--                     items only (editor, club_admin)
--   content.publish   may set any status and change live items (club_admin)
--
-- An editor therefore cannot publish, cannot schedule (which is publishing
-- with a delay) and cannot rewrite an item that is already live: the write
-- policy's USING clause only matches draft/archived rows and its WITH CHECK
-- only accepts draft/archived results.

grant select on public.content_items to anon, authenticated;
grant insert, update, delete on public.content_items to authenticated;

drop policy if exists content_items_select_live on public.content_items;
create policy content_items_select_live on public.content_items
  for select to anon, authenticated
  using (
    status = 'published'
    and publish_at <= now()
    and (expire_at is null or expire_at > now())
  );

drop policy if exists content_items_select_read on public.content_items;
create policy content_items_select_read on public.content_items
  for select to authenticated
  using (status <> 'draft' and (select app.has_permission('content.read')));

drop policy if exists content_items_select_write on public.content_items;
create policy content_items_select_write on public.content_items
  for select to authenticated
  using ((select app.has_permission('content.write')));

drop policy if exists content_items_insert_draft on public.content_items;
create policy content_items_insert_draft on public.content_items
  for insert to authenticated
  with check (status in ('draft', 'archived') and (select app.has_permission('content.write')));

drop policy if exists content_items_update_draft on public.content_items;
create policy content_items_update_draft on public.content_items
  for update to authenticated
  using (status in ('draft', 'archived') and (select app.has_permission('content.write')))
  with check (status in ('draft', 'archived') and (select app.has_permission('content.write')));

drop policy if exists content_items_delete_draft on public.content_items;
create policy content_items_delete_draft on public.content_items
  for delete to authenticated
  using (status = 'draft' and (select app.has_permission('content.write')));

drop policy if exists content_items_publish on public.content_items;
create policy content_items_publish on public.content_items
  for all to authenticated
  using ((select app.has_permission('content.publish')))
  with check ((select app.has_permission('content.publish')));

-- Fan Zone activities are editorial content with the same rules: an editor
-- drafts, a club_admin approves, and only approved activities are public.
grant select on public.activity_definitions to anon, authenticated;
grant insert, update, delete on public.activity_definitions to authenticated;

drop policy if exists activity_definitions_select_approved on public.activity_definitions;
create policy activity_definitions_select_approved on public.activity_definitions
  for select to anon, authenticated
  using (status = 'approved');

drop policy if exists activity_definitions_select_read on public.activity_definitions;
create policy activity_definitions_select_read on public.activity_definitions
  for select to authenticated
  using (status <> 'draft' and (select app.has_permission('content.read')));

drop policy if exists activity_definitions_select_write on public.activity_definitions;
create policy activity_definitions_select_write on public.activity_definitions
  for select to authenticated
  using ((select app.has_permission('content.write')));

drop policy if exists activity_definitions_insert_draft on public.activity_definitions;
create policy activity_definitions_insert_draft on public.activity_definitions
  for insert to authenticated
  with check (status in ('draft', 'archived') and (select app.has_permission('content.write')));

drop policy if exists activity_definitions_update_draft on public.activity_definitions;
create policy activity_definitions_update_draft on public.activity_definitions
  for update to authenticated
  using (status in ('draft', 'archived') and (select app.has_permission('content.write')))
  with check (status in ('draft', 'archived') and (select app.has_permission('content.write')));

drop policy if exists activity_definitions_delete_draft on public.activity_definitions;
create policy activity_definitions_delete_draft on public.activity_definitions
  for delete to authenticated
  using (status = 'draft' and (select app.has_permission('content.write')));

drop policy if exists activity_definitions_publish on public.activity_definitions;
create policy activity_definitions_publish on public.activity_definitions
  for all to authenticated
  using ((select app.has_permission('content.publish')))
  with check ((select app.has_permission('content.publish')));

-- ---------------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------------
--
-- Column grants keep three fields out of every person's reach: scan_status
-- (set by the service after inspecting the bytes), rights_status and the
-- timestamps. A supporter's upload is visible to its owner and to moderators
-- and to nobody else: approved photos are shown through the fan_cam_gallery
-- view (0004), which carries no account id.

grant select on public.media_assets to anon, authenticated;
grant insert (origin, owner_id, partner_id, bucket, object_path, mime_type, byte_size, width, height,
              sha256, alt, moderation_status)
  on public.media_assets to authenticated;
grant update (alt, moderation_status, deleted_at) on public.media_assets to authenticated;

drop policy if exists media_assets_select_public on public.media_assets;
create policy media_assets_select_public on public.media_assets
  for select to anon, authenticated
  using (
    deleted_at is null
    and scan_status = 'clean'
    and (origin = 'club' or (origin = 'partner' and moderation_status = 'approved'))
  );

drop policy if exists media_assets_select_own on public.media_assets;
create policy media_assets_select_own on public.media_assets
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists media_assets_select_moderation on public.media_assets;
create policy media_assets_select_moderation on public.media_assets
  for select to authenticated
  using (origin = 'supporter' and (select app.has_permission('moderation.review')));

drop policy if exists media_assets_select_content on public.media_assets;
create policy media_assets_select_content on public.media_assets
  for select to authenticated
  using (origin = 'club' and (select app.has_permission('content.read')));

drop policy if exists media_assets_select_campaigns on public.media_assets;
create policy media_assets_select_campaigns on public.media_assets
  for select to authenticated
  using (origin = 'partner' and app.has_permission_for_partner('campaigns.read', partner_id));

drop policy if exists media_assets_insert_own_upload on public.media_assets;
create policy media_assets_insert_own_upload on public.media_assets
  for insert to authenticated
  with check (origin = 'supporter' and owner_id = (select auth.uid()) and moderation_status = 'pending');

drop policy if exists media_assets_insert_club on public.media_assets;
create policy media_assets_insert_club on public.media_assets
  for insert to authenticated
  with check (origin = 'club' and (select app.has_permission('content.write')));

drop policy if exists media_assets_insert_partner on public.media_assets;
create policy media_assets_insert_partner on public.media_assets
  for insert to authenticated
  with check (
    origin = 'partner'
    and moderation_status = 'pending'
    and app.has_permission_for_partner('campaigns.write', partner_id)
  );

drop policy if exists media_assets_update_club on public.media_assets;
create policy media_assets_update_club on public.media_assets
  for update to authenticated
  using (origin = 'club' and (select app.has_permission('content.write')))
  with check (origin = 'club' and (select app.has_permission('content.write')));

-- Partner artwork is approved by the club, not by the partner.
drop policy if exists media_assets_update_partner_approval on public.media_assets;
create policy media_assets_update_partner_approval on public.media_assets
  for update to authenticated
  using (origin = 'partner' and (select app.has_permission('campaigns.approve')))
  with check (origin = 'partner' and (select app.has_permission('campaigns.approve')));

-- ---------------------------------------------------------------------------
-- Partners, campaigns and offers
-- ---------------------------------------------------------------------------
--
--   anyone              approved partners; approved campaigns and offers
--                       inside their dates
--   campaigns.read      every state, scoped: a partner_admin sees only their
--                       own partner's rows
--   campaigns.write     create and change rows that are not approved, scoped
--                       the same way; cannot produce an approved row
--   campaigns.approve   any change, including approval (club_admin)
--
-- Changing an approved campaign is itself an approval decision, so a
-- partner_admin cannot edit artwork or dates after sign-off.

grant select on public.partners to anon, authenticated;
grant insert, update, delete on public.partners to authenticated;

drop policy if exists partners_select_approved on public.partners;
create policy partners_select_approved on public.partners
  for select to anon, authenticated
  using (approved);

drop policy if exists partners_select_console on public.partners;
create policy partners_select_console on public.partners
  for select to authenticated
  using (app.has_permission_for_partner('campaigns.read', id));

drop policy if exists partners_manage on public.partners;
create policy partners_manage on public.partners
  for all to authenticated
  using ((select app.has_permission('campaigns.approve')))
  with check ((select app.has_permission('campaigns.approve')));

grant select on public.partner_campaigns to anon, authenticated;
grant insert, update, delete on public.partner_campaigns to authenticated;

drop policy if exists partner_campaigns_select_running on public.partner_campaigns;
create policy partner_campaigns_select_running on public.partner_campaigns
  for select to anon, authenticated
  using (status = 'approved' and starts_at <= now() and ends_at > now());

drop policy if exists partner_campaigns_select_console on public.partner_campaigns;
create policy partner_campaigns_select_console on public.partner_campaigns
  for select to authenticated
  using (app.has_permission_for_partner('campaigns.read', partner_id));

drop policy if exists partner_campaigns_insert_own on public.partner_campaigns;
create policy partner_campaigns_insert_own on public.partner_campaigns
  for insert to authenticated
  with check (
    status in ('draft', 'submitted')
    and app.has_permission_for_partner('campaigns.write', partner_id)
  );

drop policy if exists partner_campaigns_update_own on public.partner_campaigns;
create policy partner_campaigns_update_own on public.partner_campaigns
  for update to authenticated
  using (
    status in ('draft', 'submitted', 'rejected')
    and app.has_permission_for_partner('campaigns.write', partner_id)
  )
  with check (
    status in ('draft', 'submitted')
    and app.has_permission_for_partner('campaigns.write', partner_id)
  );

drop policy if exists partner_campaigns_delete_own on public.partner_campaigns;
create policy partner_campaigns_delete_own on public.partner_campaigns
  for delete to authenticated
  using (
    status in ('draft', 'submitted', 'rejected')
    and app.has_permission_for_partner('campaigns.write', partner_id)
  );

drop policy if exists partner_campaigns_approve on public.partner_campaigns;
create policy partner_campaigns_approve on public.partner_campaigns
  for all to authenticated
  using ((select app.has_permission('campaigns.approve')))
  with check ((select app.has_permission('campaigns.approve')));

grant select on public.offers to anon, authenticated;
grant insert, update, delete on public.offers to authenticated;

-- An offer is shown only to the audience it is for.
drop policy if exists offers_select_running_everyone on public.offers;
create policy offers_select_running_everyone on public.offers
  for select to anon, authenticated
  using (status = 'approved' and starts_at <= now() and ends_at > now() and eligibility = 'everyone');

drop policy if exists offers_select_running_eligible on public.offers;
create policy offers_select_running_eligible on public.offers
  for select to authenticated
  using (
    status = 'approved' and starts_at <= now() and ends_at > now()
    and (eligibility = 'signed_in' or (eligibility = 'members' and (select app.is_eligible_member())))
  );

drop policy if exists offers_select_console on public.offers;
create policy offers_select_console on public.offers
  for select to authenticated
  using (app.has_permission_for_partner('campaigns.read', partner_id));

drop policy if exists offers_insert_own on public.offers;
create policy offers_insert_own on public.offers
  for insert to authenticated
  with check (
    status in ('draft', 'submitted')
    and app.has_permission_for_partner('campaigns.write', partner_id)
  );

drop policy if exists offers_update_own on public.offers;
create policy offers_update_own on public.offers
  for update to authenticated
  using (
    status in ('draft', 'submitted', 'rejected')
    and app.has_permission_for_partner('campaigns.write', partner_id)
  )
  with check (
    status in ('draft', 'submitted')
    and app.has_permission_for_partner('campaigns.write', partner_id)
  );

drop policy if exists offers_delete_own on public.offers;
create policy offers_delete_own on public.offers
  for delete to authenticated
  using (
    status in ('draft', 'submitted', 'rejected')
    and app.has_permission_for_partner('campaigns.write', partner_id)
  );

drop policy if exists offers_approve on public.offers;
create policy offers_approve on public.offers
  for all to authenticated
  using ((select app.has_permission('campaigns.approve')))
  with check ((select app.has_permission('campaigns.approve')));

-- ---------------------------------------------------------------------------
-- Fan Zone entries and moderation
-- ---------------------------------------------------------------------------
--
-- A supporter sees only their own entries. Nobody else's row is ever readable
-- by a supporter, approved or not: other people's votes are private, and an
-- approved photo is reached through the fan_cam_gallery view instead.
--
-- Column grants make an entry immutable once made. The only change a person
-- can make to their own entry is to withdraw it.

grant select on public.fan_activities to authenticated;
grant insert (activity_id, activity_type, user_id, submission, media_asset_id, consent_record_id)
  on public.fan_activities to authenticated;
grant update (moderation_status) on public.fan_activities to authenticated;

drop policy if exists fan_activities_select_own on public.fan_activities;
create policy fan_activities_select_own on public.fan_activities
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists fan_activities_select_moderation on public.fan_activities;
create policy fan_activities_select_moderation on public.fan_activities
  for select to authenticated
  using (activity_type = 'fan_cam' and (select app.has_permission('moderation.review')));

drop policy if exists fan_activities_insert_own on public.fan_activities;
create policy fan_activities_insert_own on public.fan_activities
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists fan_activities_withdraw_own on public.fan_activities;
create policy fan_activities_withdraw_own on public.fan_activities
  for update to authenticated
  using (user_id = (select auth.uid()) and moderation_status <> 'withdrawn')
  with check (user_id = (select auth.uid()) and moderation_status = 'withdrawn');

-- moderation.review: read the queue and decide cases. A moderator changes the
-- decision fields only; what the case is about cannot be repointed.
grant select on public.moderation_cases to authenticated;
grant insert (fan_activity_id, opened_reason, report_reason) on public.moderation_cases to authenticated;
grant update (status, decision_reason, notes) on public.moderation_cases to authenticated;

drop policy if exists moderation_cases_select_review on public.moderation_cases;
create policy moderation_cases_select_review on public.moderation_cases
  for select to authenticated
  using ((select app.has_permission('moderation.review')));

drop policy if exists moderation_cases_select_own_report on public.moderation_cases;
create policy moderation_cases_select_own_report on public.moderation_cases
  for select to authenticated
  using (reported_by = (select auth.uid()));

-- Any signed-in supporter can report something that is publicly shown.
drop policy if exists moderation_cases_insert_report on public.moderation_cases;
create policy moderation_cases_insert_report on public.moderation_cases
  for insert to authenticated
  with check (
    opened_reason = 'report'
    and status = 'open'
    and reported_by = (select auth.uid())
    and app.fan_item_is_public(fan_activity_id)
  );

drop policy if exists moderation_cases_update_review on public.moderation_cases;
create policy moderation_cases_update_review on public.moderation_cases
  for update to authenticated
  using ((select app.has_permission('moderation.review')))
  with check ((select app.has_permission('moderation.review')));

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
--
-- notifications.schedule may prepare and schedule a send. Delivery state
-- (sending, sent, failed, the provider's message id) is written by the service.

grant select on public.notifications to authenticated;
grant insert (template_id, category, segment, user_id, consent_check, consent_purpose, send_status, scheduled_for)
  on public.notifications to authenticated;
grant update (template_id, category, segment, user_id, consent_check, consent_purpose, send_status, scheduled_for)
  on public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) and send_status = 'sent');

drop policy if exists notifications_select_schedule on public.notifications;
create policy notifications_select_schedule on public.notifications
  for select to authenticated
  using ((select app.has_permission('notifications.schedule')));

drop policy if exists notifications_insert_schedule on public.notifications;
create policy notifications_insert_schedule on public.notifications
  for insert to authenticated
  with check (send_status in ('draft', 'scheduled') and (select app.has_permission('notifications.schedule')));

drop policy if exists notifications_update_schedule on public.notifications;
create policy notifications_update_schedule on public.notifications
  for update to authenticated
  using (send_status in ('draft', 'scheduled') and (select app.has_permission('notifications.schedule')))
  with check (
    send_status in ('draft', 'scheduled', 'cancelled')
    and (select app.has_permission('notifications.schedule'))
  );

-- ---------------------------------------------------------------------------
-- Audit history
-- ---------------------------------------------------------------------------

-- audit.read. No person can insert, update or delete: rows are written by
-- triggers (0004), and a trigger refuses update and delete for everyone.
grant select on public.audit_logs to authenticated;
drop policy if exists audit_logs_select_read on public.audit_logs;
create policy audit_logs_select_read on public.audit_logs
  for select to authenticated
  using ((select app.has_permission('audit.read')));

-- ---------------------------------------------------------------------------
-- An account that is suspended or deleted cannot create anything
-- ---------------------------------------------------------------------------

-- RESTRICTIVE policies are AND-ed with the ones above. They close the gap
-- between an account being deleted and its last access token expiring: with a
-- still-valid token, `user_id = auth.uid()` would otherwise let a deleted
-- account write a fresh profile. Reading, withdrawing consent and withdrawing
-- an entry stay possible.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'preferences', 'marketing_consents', 'device_tokens', 'fan_cam_consents',
    'fan_activities', 'media_assets', 'moderation_cases'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_active_account_only', t);
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated
         with check ((select app.account_is_active()))',
      t || '_active_account_only', t
    );
  end loop;
end
$$;

-- Service-only tables (RLS on, no policy, no grant to anon or authenticated):
--   webhook_events, rate_limit_hits, and in 0005 retention_policies and
--   storage_purge_queue. rewards_wallets and reward_transactions have a
--   read-own policy above and nothing else: there is no policy, and no GRANT,
--   through which any person (club_admin included) could change a reward.
