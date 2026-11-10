-- Row Level Security for every table, plus the few RPCs through which
-- supporters and staff change protected state. Tested in supabase/tests.

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create policy "permissions readable by signed-in users" on public.permissions
  for select to authenticated using (true);
create policy "role permissions readable by signed-in users" on public.role_permissions
  for select to authenticated using (true);
create policy "squads are public" on public.squads
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
create policy "staff see their own row; role managers see all" on public.admin_users
  for select to authenticated
  using (user_id = auth.uid() or private.has_permission('roles.manage'));
-- No insert/update/delete policies: role changes go through set_staff_role().

create or replace function public.set_staff_role(p_user uuid, p_role public.staff_role, p_active boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('roles.manage') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'you cannot change your own role' using errcode = '42501';
  end if;
  insert into public.admin_users (user_id, role, active) values (p_user, p_role, p_active)
  on conflict (user_id) do update set role = excluded.role, active = excluded.active, updated_at = now();
  perform private.audit('staff.role_set', 'admin_users', p_user::text,
    jsonb_build_object('role', p_role, 'active', p_active));
end;
$$;

revoke execute on function public.set_staff_role(uuid, public.staff_role, boolean) from public, anon;
grant execute on function public.set_staff_role(uuid, public.staff_role, boolean) to authenticated;

create policy "audit log readable with audit.read" on public.audit_logs
  for select to authenticated using (private.has_permission('audit.read'));
-- No write policies: rows arrive only through private.audit().

create policy "sync logs readable with ops.read" on public.integration_sync_logs
  for select to authenticated using (private.has_permission('ops.read'));

create policy "feature flags readable with ops.read" on public.feature_flags
  for select to authenticated using (private.has_permission('ops.read'));

-- ---------------------------------------------------------------------------
-- Supporters
-- ---------------------------------------------------------------------------
create policy "own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid() or private.has_permission('support.read_profile'));
create policy "create own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "own notification preferences" on public.notification_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Provider-synchronised, owner read-only. Writes come from server functions.
create policy "own member account" on public.member_accounts
  for select to authenticated using (user_id = auth.uid());
create policy "own entitlements" on public.membership_entitlements
  for select to authenticated using (user_id = auth.uid());
create policy "own tickets" on public.tickets
  for select to authenticated using (user_id = auth.uid());
create policy "own wallet" on public.reward_wallets
  for select to authenticated using (user_id = auth.uid());
create policy "own reward transactions" on public.reward_transactions
  for select to authenticated using (user_id = auth.uid());

create policy "own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Supporters may change read_at and nothing else.
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Football
-- ---------------------------------------------------------------------------
create policy "approved fixtures are public" on public.fixtures
  for select to anon, authenticated using (approved or private.has_permission('fixtures.manage'));
create policy "fixture managers write fixtures" on public.fixtures
  for all to authenticated
  using (private.has_permission('fixtures.manage'))
  with check (private.has_permission('fixtures.manage'));

create policy "match detail follows its fixture" on public.matches
  for select to anon, authenticated
  using (exists (select 1 from public.fixtures f where f.id = fixture_id and f.approved));
create policy "match events follow their fixture" on public.match_events
  for select to anon, authenticated
  using (exists (select 1 from public.fixtures f where f.id = fixture_id and f.approved));

create policy "approved players are public" on public.players
  for select to anon, authenticated using (approved or private.has_permission('fixtures.manage'));
create policy "fixture managers write players" on public.players
  for all to authenticated
  using (private.has_permission('fixtures.manage'))
  with check (private.has_permission('fixtures.manage'));

-- ---------------------------------------------------------------------------
-- Fan Moments
-- ---------------------------------------------------------------------------
create policy "approved moments are public; authors and moderators see more" on public.fan_posts
  for select to anon, authenticated
  using (
    (status = 'approved' and removed_at is null)
    or author_id = auth.uid()
    or private.has_permission('moderation.read')
  );
create policy "supporters submit their own moments" on public.fan_posts
  for insert to authenticated with check (author_id = auth.uid());
-- No update/delete policies: status changes go through the functions below.

create policy "media follows its post" on public.fan_media
  for select to authenticated
  using (exists (
    select 1 from public.fan_posts p
    where p.id = post_id
      and ((p.status = 'approved' and p.removed_at is null) or p.author_id = auth.uid() or private.has_permission('moderation.read'))
  ));
create policy "authors attach media to their own pending posts" on public.fan_media
  for insert to authenticated
  with check (exists (
    select 1 from public.fan_posts p
    where p.id = post_id and p.author_id = auth.uid() and p.status in ('pending_review', 'escalated')
  ));

create policy "supporters file reports as themselves" on public.fan_reports
  for insert to authenticated with check (reporter_id = auth.uid());
create policy "reporters see their reports; moderators see all" on public.fan_reports
  for select to authenticated
  using (reporter_id = auth.uid() or private.has_permission('moderation.read'));

create policy "moderation history for moderators" on public.moderation_actions
  for select to authenticated using (private.has_permission('moderation.read'));

create or replace function public.moderate_fan_post(p_post uuid, p_action public.moderation_action, p_reason text)
returns public.fan_post_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur public.fan_post_status;
  nxt public.fan_post_status;
begin
  if not (
    private.has_permission('moderation.act')
    or (p_action = 'escalate' and private.has_permission('moderation.escalate'))
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  select status into cur from public.fan_posts where id = p_post for update;
  if not found then
    raise exception 'moment not found' using errcode = 'P0002';
  end if;
  nxt := private.next_moderation_status(cur, p_action);
  if nxt is null then
    raise exception 'cannot % a moment that is %', p_action, cur using errcode = '22023';
  end if;
  update public.fan_posts set status = nxt, status_reason = p_reason, updated_at = now() where id = p_post;
  insert into public.moderation_actions (post_id, actor_id, action, from_status, to_status, reason)
  values (p_post, auth.uid(), p_action, cur, nxt, p_reason);
  perform private.audit('fan_post.' || p_action::text, 'fan_posts', p_post::text,
    jsonb_build_object('from', cur, 'to', nxt, 'reason', p_reason));
  return nxt;
end;
$$;

-- Mirror of ownerCanDelete() in packages/contracts/src/fan.ts.
create or replace function public.remove_my_fan_post(p_post uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare cur public.fan_post_status;
begin
  select status into cur from public.fan_posts where id = p_post and author_id = auth.uid() for update;
  if not found then
    raise exception 'moment not found' using errcode = 'P0002';
  end if;
  if cur in ('escalated', 'removed_by_user') then
    raise exception 'this moment is held for review and cannot be removed now' using errcode = '42501';
  end if;
  update public.fan_posts set status = 'removed_by_user', removed_at = now(), updated_at = now() where id = p_post;
  perform private.audit('fan_post.removed_by_user', 'fan_posts', p_post::text, jsonb_build_object('from', cur));
end;
$$;

revoke execute on function public.moderate_fan_post(uuid, public.moderation_action, text) from public, anon;
revoke execute on function public.remove_my_fan_post(uuid) from public, anon;
grant execute on function public.moderate_fan_post(uuid, public.moderation_action, text) to authenticated;
grant execute on function public.remove_my_fan_post(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rewards
-- ---------------------------------------------------------------------------
create policy "active rewards are public" on public.rewards_catalog
  for select to anon, authenticated using (active or private.has_permission('rewards.manage'));

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------
create policy "live content is public; staff see everything" on public.content_items
  for select to anon, authenticated
  using (private.is_live_content(status, publish_at, unpublish_at) or private.has_permission('content.read'));
create policy "content writers create" on public.content_items
  for insert to authenticated with check (private.has_permission('content.write'));
create policy "content writers update" on public.content_items
  for update to authenticated
  using (private.has_permission('content.write'))
  with check (private.has_permission('content.write'));

create policy "live modules are public; staff see everything" on public.home_modules
  for select to anon, authenticated
  using (private.is_live_content(status, publish_at, unpublish_at) or private.has_permission('content.read'));
create policy "content writers create modules" on public.home_modules
  for insert to authenticated with check (private.has_permission('content.write'));
create policy "content writers update modules" on public.home_modules
  for update to authenticated
  using (private.has_permission('content.write'))
  with check (private.has_permission('content.write'));

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------
create policy "campaign drafters read" on public.notification_campaigns
  for select to authenticated using (private.has_permission('notifications.draft'));
create policy "campaign drafters create" on public.notification_campaigns
  for insert to authenticated with check (private.has_permission('notifications.draft'));
create policy "campaign drafters update" on public.notification_campaigns
  for update to authenticated
  using (private.has_permission('notifications.draft'))
  with check (private.has_permission('notifications.draft'));
