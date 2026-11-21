import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RATE_LIMIT_PER_MINUTE } from '../../packages/domain/src/fanzone';
import { rolePermissions } from '../../packages/domain/src/roles';
import { TestDatabase, ids, migrationFiles, seedCast, sqlState } from './harness';

let db: TestDatabase;

beforeAll(async () => {
  db = await TestDatabase.create();
  await seedCast(db);
});

afterAll(async () => {
  await db.close();
});

/** A count of everything the migrations create, to compare before and after a second run. */
async function fingerprint(): Promise<Record<string, unknown>> {
  return db.superuser.one(`
    select
      (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('public', 'app') and c.relkind in ('r', 'v')) as relations,
      (select count(*)::int from pg_policies where schemaname in ('public', 'app', 'storage')) as policies,
      (select count(*)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where not t.tgisinternal and n.nspname in ('public', 'auth')) as triggers,
      (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'app')) as functions,
      (select count(*)::int from pg_constraint c join pg_namespace n on n.oid = c.connamespace
        where n.nspname in ('public', 'app')) as constraints,
      (select count(*)::int from app.role_permissions) as role_permissions,
      (select count(*)::int from public.retention_policies) as retention_policies
  `);
}

describe('migrations', () => {
  it('apply in order to a fresh PostgreSQL 18', async () => {
    expect(migrationFiles()).toEqual([
      '0001_extensions_and_roles.sql',
      '0002_core_tables.sql',
      '0003_rls_policies.sql',
      '0004_functions_and_triggers.sql',
      '0005_retention.sql',
      '0006_storage_and_realtime.sql',
    ]);
    const { version } = await db.superuser.one<{ version: number }>(
      `select current_setting('server_version_num')::int as version`,
    );
    expect(Math.floor(version / 10_000)).toBe(18);
  });

  it('create every table the brief names', async () => {
    const tables = await db.superuser.rows<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(tables.map((t) => t.relname)).toEqual(
      expect.arrayContaining([
        'users',
        'profiles',
        'preferences',
        'memberships',
        'fixtures',
        'match_events',
        'teams',
        'players',
        'content_items',
        'media_assets',
        'partner_campaigns',
        'offers',
        'rewards_wallets',
        'reward_transactions',
        'fan_activities',
        'moderation_cases',
        'notifications',
        'device_tokens',
        'audit_logs',
        'webhook_events',
        'retention_policies',
        'rate_limit_hits',
        'consent_log',
        'user_roles',
      ]),
    );
  });

  it('can be applied a second time without error and without changing anything', async () => {
    const before = await fingerprint();
    await db.applyMigrations();
    expect(await fingerprint()).toEqual(before);
  });

  it('were applied by a role that is neither superuser nor BYPASSRLS, and that role owns the tables', async () => {
    const owner = await db.superuser.one(
      `select r.rolname, r.rolsuper, r.rolbypassrls
       from pg_class c join pg_roles r on r.oid = c.relowner
       where c.oid = 'public.users'::regclass`,
    );
    expect(owner).toEqual({ rolname: 'migrator', rolsuper: false, rolbypassrls: false });
  });
});

describe('schema-wide invariants', () => {
  it('row-level security is enabled on every table in public and app', async () => {
    const unprotected = await db.superuser.rows(
      `select n.nspname || '.' || c.relname as table_name
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname in ('public', 'app') and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(unprotected).toEqual([]);
  });

  it('every date or time column is timestamptz, so every instant is stored in UTC', async () => {
    const offenders = await db.superuser.rows(
      `select table_schema || '.' || table_name || '.' || column_name as column_name, data_type
       from information_schema.columns
       where table_schema in ('public', 'app')
         and data_type in ('timestamp without time zone', 'date', 'time without time zone', 'time with time zone')`,
    );
    expect(offenders).toEqual([]);

    const { n } = await db.superuser.one<{ n: number }>(
      `select count(*)::int as n from information_schema.columns
       where table_schema = 'public' and data_type = 'timestamp with time zone'`,
    );
    expect(n).toBeGreaterThan(40);
  });

  it('every function pins its search_path, and every SECURITY DEFINER function pins it to empty', async () => {
    const functions = await db.superuser.rows<{
      name: string;
      definer: boolean;
      config: string[] | null;
    }>(
      `select n.nspname || '.' || p.proname as name, p.prosecdef as definer, p.proconfig as config
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'app')`,
    );
    expect(functions.length).toBeGreaterThan(30);
    const unpinned = functions.filter(
      (f) => !(f.config ?? []).some((c) => c.startsWith('search_path=')),
    );
    expect(unpinned.map((f) => f.name)).toEqual([]);
    const definerWithPath = functions.filter(
      (f) => f.definer && !(f.config ?? []).includes('search_path=""'),
    );
    expect(definerWithPath.map((f) => f.name)).toEqual([]);
  });

  it('the permission matrix in the database equals rolePermissions in the domain package', async () => {
    const rows = await db.superuser.rows<{ role: string; permission: string }>(
      `select role, permission from app.role_permissions`,
    );
    const fromDatabase = rows.map((r) => `${r.role}:${r.permission}`).sort();
    const fromDomain = Object.entries(rolePermissions)
      .flatMap(([role, granted]) => granted.map((permission) => `${role}:${permission}`))
      .sort();
    expect(fromDatabase).toEqual(fromDomain);
  });

  it('app.has_permission answers exactly as the matrix does for each console role', async () => {
    const people = {
      editor: ids.erin,
      moderator: ids.mo,
      club_admin: ids.cleo,
      supporter: ids.alice,
    } as const;
    const all = [...new Set(Object.values(rolePermissions).flat())];
    for (const [role, id] of Object.entries(people)) {
      const granted = await db
        .user(id)
        .rows<{ permission: string }>(
          `select p as permission from unnest($1::text[]) as p where app.has_permission(p)`,
          [all],
        );
      expect(granted.map((g) => g.permission).sort(), role).toEqual(
        [...rolePermissions[role as keyof typeof people]].sort(),
      );
    }
  });

  it('a partner_admin holds their permissions for their own partner only', async () => {
    const check = (partner: string, permission: string) =>
      db
        .user(ids.pat)
        .one<{ ok: boolean }>(`select app.has_permission_for_partner($1, $2) as ok`, [
          permission,
          partner,
        ]);
    expect((await check(ids.acme, 'campaigns.write')).ok).toBe(true);
    expect((await check(ids.acme, 'campaigns.read')).ok).toBe(true);
    expect((await check(ids.borth, 'campaigns.write')).ok).toBe(false);
    expect((await check(ids.acme, 'campaigns.approve')).ok).toBe(false);
    // Unscoped checks never match a partner-scoped role.
    const unscoped = await db
      .user(ids.pat)
      .one<{ ok: boolean }>(`select app.has_permission('campaigns.write') as ok`);
    expect(unscoped.ok).toBe(false);
  });

  it('the service role cannot be given to a person', async () => {
    expect(
      await sqlState(
        db.superuser.run(`insert into public.user_roles (user_id, role) values ($1, 'service')`, [
          ids.alice,
        ]),
      ),
    ).toBe('23514');
    // And nothing a person can hold grants rewards.adjust.
    for (const id of [ids.alice, ids.erin, ids.mo, ids.cleo, ids.pat]) {
      const { ok } = await db
        .user(id)
        .one<{ ok: boolean }>(`select app.has_permission('rewards.adjust') as ok`);
      expect(ok).toBe(false);
    }
  });

  it('app.current_role reports the most senior role', async () => {
    const roleOf = async (session: ReturnType<TestDatabase['user']>) =>
      (await session.one<{ role: string | null }>(`select app.current_role() as role`)).role;
    expect(await roleOf(db.user(ids.alice))).toBe('supporter');
    expect(await roleOf(db.user(ids.erin))).toBe('editor');
    expect(await roleOf(db.user(ids.cleo))).toBe('club_admin');
    expect(await roleOf(db.user(ids.pat))).toBe('partner_admin');
    expect(await roleOf(db.service)).toBe('service');
    expect(await roleOf(db.anon)).toBeNull();
  });

  it('the Fan Zone rate limit matches RATE_LIMIT_PER_MINUTE in the domain package', async () => {
    const rule = await db.superuser.one(
      `select max_hits, per = interval '1 minute' as per_minute from app.rate_limit_rules where action = 'fanzone.submit'`,
    );
    expect(rule).toEqual({ max_hits: RATE_LIMIT_PER_MINUTE, per_minute: true });
  });
});

describe('privileges', () => {
  const privilege = async (role: string, table: string, privileges: string) =>
    (
      await db.superuser.one<{ ok: boolean }>(`select has_table_privilege($1, $2, $3) as ok`, [
        role,
        `public.${table}`,
        privileges,
      ])
    ).ok;

  it('anon and authenticated hold no privilege at all on the service-only tables', async () => {
    for (const table of [
      'webhook_events',
      'rate_limit_hits',
      'retention_policies',
      'storage_purge_queue',
    ]) {
      for (const role of ['anon', 'authenticated']) {
        expect(
          await privilege(
            role,
            table,
            'select, insert, update, delete, truncate, references, trigger',
          ),
          `${role} on ${table}`,
        ).toBe(false);
      }
    }
  });

  it('no person can be granted a way to write rewards, audit history or the consent log', async () => {
    for (const table of [
      'rewards_wallets',
      'reward_transactions',
      'audit_logs',
      'consent_log',
      'match_events',
    ]) {
      for (const role of ['anon', 'authenticated']) {
        expect(
          await privilege(role, table, 'insert, update, delete, truncate'),
          `${role} on ${table}`,
        ).toBe(false);
      }
    }
  });

  it('anon can read only what is meant to be public', async () => {
    const readable = await db.superuser.rows<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'v') and has_table_privilege('anon', c.oid, 'select')
       order by 1`,
    );
    expect(readable.map((r) => r.relname)).toEqual([
      'activity_definitions',
      'content_items',
      'fan_cam_gallery',
      'feature_flags',
      'fixtures',
      'match_events',
      'media_assets',
      'offers',
      'partner_campaigns',
      'partners',
      'players',
      'teams',
    ]);
    const writable = await db.superuser.rows(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'v')
         and has_table_privilege('anon', c.oid, 'insert, update, delete, truncate')`,
    );
    expect(writable).toEqual([]);
  });

  it('even the service role cannot truncate, or update or delete the append-only tables', async () => {
    const truncatable = await db.superuser.rows(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('service_role', c.oid, 'truncate')`,
    );
    expect(truncatable).toEqual([]);
    for (const table of ['audit_logs', 'consent_log', 'match_events']) {
      expect(await privilege('service_role', table, 'update, delete'), table).toBe(false);
      expect(await privilege('service_role', table, 'insert'), table).toBe(true);
    }
  });

  it('only the intended functions are callable as RPCs', async () => {
    const callable = async (role: string) =>
      (
        await db.superuser.rows<{ proname: string }>(
          `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and has_function_privilege($1, p.oid, 'execute') order by 1`,
          [role],
        )
      ).map((r) => r.proname);

    expect(await callable('anon')).toEqual(['poll_results']);
    expect(await callable('authenticated')).toEqual([
      'delete_my_account',
      'poll_results',
      'register_device_token',
    ]);
    expect(await callable('service_role')).toEqual([
      'check_rate_limit',
      'claim_webhook_event',
      'complete_webhook_event',
      'delete_account',
      'poll_results',
      'purge_expired',
      'register_device_token',
    ]);
  });

  it('PUBLIC can execute nothing in the app schema, and anon only the read-only policy helpers', async () => {
    const forAnon = await db.superuser.rows<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app' and has_function_privilege('anon', p.oid, 'execute') order by 1`,
    );
    expect(forAnon.map((r) => r.proname)).toEqual([
      'account_is_active',
      'current_role',
      'fan_item_is_public',
      'has_permission',
      'has_permission_for_partner',
      'is_eligible_member',
      'is_localized_text',
      'is_service',
    ]);
  });
});
