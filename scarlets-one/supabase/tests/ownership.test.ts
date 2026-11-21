import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestDatabase, ids, seedCast, sqlState } from './harness';

let db: TestDatabase;

const OWNED_TABLES = [
  'profiles',
  'preferences',
  'marketing_consents',
  'consent_log',
  'memberships',
  'rewards_wallets',
  'reward_transactions',
  'device_tokens',
] as const;

/** Gives one supporter a row in every table a supporter can own. */
async function giveEverything(userId: string, tag: string): Promise<void> {
  const su = db.superuser;
  await su.run(`insert into public.profiles (user_id, display_name) values ($1, $2)`, [
    userId,
    `Name ${tag}`,
  ]);
  await su.run(`insert into public.preferences (user_id, match_alerts) values ($1, true)`, [
    userId,
  ]);
  await su.run(
    `insert into public.marketing_consents (user_id, purpose, granted, policy_version)
     values ($1, 'club_email', true, 'v1')`,
    [userId],
  );
  await su.run(
    `insert into public.memberships (user_id, club_member_token, member_ref_masked, eligibility_status, source_system)
     values ($1, $2, '••••0000', 'pending_verification', 'demo-membership')`,
    [userId, `token-for-${tag}-0001`],
  );
  const wallet = await su.one<{ id: string }>(
    `insert into public.rewards_wallets (user_id, scheme_id, provider_member_ref)
     values ($1, 'demo-scheme', $2) returning id`,
    [userId, `member-ref-${tag}`],
  );
  await su.run(
    `insert into public.reward_transactions (provider_txn_id, wallet_id, user_id, type, occurred_at, source_system)
     values ($1, $2, $3, 'earned', now(), 'demo-rewards')`,
    [`txn-${tag}`, wallet.id, userId],
  );
  await su.run(
    `insert into public.device_tokens (user_id, platform, token) values ($1, 'ios', $2)`,
    [userId, `push-token-for-${tag}-0000000000`],
  );
}

beforeAll(async () => {
  db = await TestDatabase.create();
  await seedCast(db);
  await giveEverything(ids.alice, 'alice');
  await giveEverything(ids.bob, 'bob');
});

afterAll(async () => {
  await db.close();
});

beforeEach(() => db.begin());
afterEach(() => db.rollback());

describe('a supporter and their own records', () => {
  it.each(OWNED_TABLES)('reads only their own rows in %s', async (table) => {
    for (const [me, other] of [
      [ids.alice, ids.bob],
      [ids.bob, ids.alice],
    ] as const) {
      const mine = await db
        .user(me)
        .rows<{ user_id: string }>(`select user_id from public.${table}`);
      expect(mine.length).toBeGreaterThan(0);
      expect(new Set(mine.map((r) => r.user_id))).toEqual(new Set([me]));
      // Asking for the other person's rows by id finds nothing either.
      expect(
        await db.user(me).rows(`select 1 from public.${table} where user_id = $1`, [other]),
      ).toEqual([]);
    }
  });

  it('sees their own account row and nobody else’s', async () => {
    const rows = await db.user(ids.alice).rows<{ id: string }>(`select id from public.users`);
    expect(rows).toEqual([{ id: ids.alice }]);
  });

  it('can create and change their own profile, preferences and device token', async () => {
    const carol = ids.erin; // any account without these rows yet
    expect(
      await db
        .user(carol)
        .run(
          `insert into public.profiles (user_id, display_name, language) values ($1, 'Erin', 'cy')`,
          [carol],
        ),
    ).toBe(1);
    expect(
      await db
        .user(carol)
        .run(`update public.profiles set display_name = 'Erin E' where user_id = $1`, [carol]),
    ).toBe(1);
    expect(
      await db
        .user(carol)
        .run(`insert into public.preferences (user_id, club_news) values ($1, true)`, [carol]),
    ).toBe(1);
    expect(
      await db
        .user(carol)
        .run(
          `insert into public.device_tokens (user_id, platform, token) values ($1, 'android', 'push-token-erin-000000000000')`,
          [carol],
        ),
    ).toBe(1);
    expect(
      await db.user(carol).run(`delete from public.device_tokens where user_id = $1`, [carol]),
    ).toBe(1);
  });

  it.each([
    ['profiles', `update public.profiles set display_name = 'Hacked' where user_id = $1`],
    ['preferences', `update public.preferences set match_alerts = false where user_id = $1`],
    [
      'marketing_consents',
      `update public.marketing_consents set granted = false where user_id = $1`,
    ],
    ['device_tokens', `update public.device_tokens set revoked_at = now() where user_id = $1`],
    ['profiles (delete)', `delete from public.profiles where user_id = $1`],
    ['memberships (delete)', `delete from public.memberships where user_id = $1`],
    ['device_tokens (delete)', `delete from public.device_tokens where user_id = $1`],
  ])('cannot change another supporter’s %s', async (_label, statement) => {
    expect(await db.user(ids.bob).run(statement, [ids.alice])).toBe(0);
  });

  it('the other supporter’s rows are untouched after those attempts', async () => {
    await db
      .user(ids.bob)
      .run(`update public.profiles set display_name = 'Hacked' where user_id = $1`, [ids.alice]);
    await db.user(ids.bob).run(`delete from public.memberships where user_id = $1`, [ids.alice]);
    const profile = await db.superuser.one(
      `select display_name from public.profiles where user_id = $1`,
      [ids.alice],
    );
    expect(profile).toEqual({ display_name: 'Name alice' });
    expect(
      await db.superuser.rows(`select 1 from public.memberships where user_id = $1`, [ids.alice]),
    ).toHaveLength(1);
  });

  it.each([
    [
      'membership',
      `update public.memberships set eligibility_status = 'eligible' where user_id = $1`,
    ],
    [
      'wallet',
      `update public.rewards_wallets set balance = 1, balance_as_of = now() where user_id = $1`,
    ],
    ['transactions', `update public.reward_transactions set amount = 1 where user_id = $1`],
    ['wallet (delete)', `delete from public.rewards_wallets where user_id = $1`],
    ['transactions (delete)', `delete from public.reward_transactions where user_id = $1`],
  ])(
    'cannot write another supporter’s %s (or their own): there is no such privilege',
    async (_label, statement) => {
      expect(await sqlState(db.user(ids.bob).run(statement, [ids.alice]))).toBe('42501');
      expect(await sqlState(db.user(ids.alice).run(statement, [ids.alice]))).toBe('42501');
    },
  );

  it('cannot insert a row that belongs to someone else', async () => {
    const asBob = db.user(ids.bob);
    await db.superuser.run(`delete from public.profiles where user_id = $1`, [ids.alice]);
    expect(
      await sqlState(
        asBob.run(`insert into public.profiles (user_id, display_name) values ($1, 'Imposter')`, [
          ids.alice,
        ]),
      ),
    ).toBe('42501');
    expect(
      await sqlState(
        asBob.run(
          `insert into public.device_tokens (user_id, platform, token) values ($1, 'ios', 'push-token-imposter-0000000')`,
          [ids.alice],
        ),
      ),
    ).toBe('42501');
    expect(
      await sqlState(
        asBob.run(
          `insert into public.marketing_consents (user_id, purpose, granted, policy_version) values ($1, 'club_sms', true, 'v1')`,
          [ids.alice],
        ),
      ),
    ).toBe('42501');
  });

  it('cannot move their own row to another account', async () => {
    expect(
      await sqlState(
        db
          .user(ids.bob)
          .run(`update public.device_tokens set user_id = $1 where user_id = $2`, [
            ids.alice,
            ids.bob,
          ]),
      ),
    ).toBe('42501');
  });

  it('cannot give themselves a verified membership: only the service writes eligibility', async () => {
    await db.superuser.run(`delete from public.memberships where user_id = $1`, [ids.alice]);
    expect(
      await sqlState(
        db.user(ids.alice).run(
          `insert into public.memberships (user_id, club_member_token, eligibility_status, source_system)
           values ($1, 'self-made-token-0001', 'eligible', 'demo-membership')`,
          [ids.alice],
        ),
      ),
    ).toBe('42501');
    expect(
      await db.service.run(
        `insert into public.memberships (user_id, club_member_token, eligibility_status, source_system)
         values ($1, 'verified-token-0001', 'eligible', 'demo-membership')`,
        [ids.alice],
      ),
    ).toBe(1);
    // The supporter can unlink it again.
    expect(
      await db
        .user(ids.alice)
        .run(`delete from public.memberships where user_id = $1`, [ids.alice]),
    ).toBe(1);
  });

  it('cannot change their own account status or contact fields', async () => {
    expect(
      await sqlState(
        db
          .user(ids.alice)
          .run(`update public.users set account_status = 'active' where id = $1`, [ids.alice]),
      ),
    ).toBe('42501');
  });

  it('a visitor with no session can read none of it', async () => {
    for (const table of ['users', ...OWNED_TABLES, 'fan_activities', 'user_roles', 'audit_logs']) {
      expect(await sqlState(db.anon.rows(`select * from public.${table}`)), table).toBe('42501');
    }
  });

  it('a push token moves with the device when a different account signs in on it', async () => {
    const token = 'push-token-for-alice-0000000000';
    // Bob cannot see or take Alice's token row directly...
    expect(
      await sqlState(
        db
          .user(ids.bob)
          .run(
            `insert into public.device_tokens (user_id, platform, token) values ($1, 'ios', $2)`,
            [ids.bob, token],
          ),
      ),
    ).toBe('23505');
    // ...but registering it hands the device over.
    await db.user(ids.bob).one(`select public.register_device_token($1, 'ios', 'en')`, [token]);
    expect(
      await db.superuser.one(`select user_id from public.device_tokens where token = $1`, [token]),
    ).toEqual({
      user_id: ids.bob,
    });
    expect(
      await sqlState(db.anon.one(`select public.register_device_token($1, 'ios', 'en')`, [token])),
    ).toBe('42501');
  });
});

describe('marketing consent', () => {
  it('is off by default, and no row at all means no consent', async () => {
    await db
      .user(ids.erin)
      .run(
        `insert into public.marketing_consents (user_id, purpose, policy_version) values ($1, 'partner_offers', 'v1')`,
        [ids.erin],
      );
    expect(
      await db
        .user(ids.erin)
        .one(`select granted from public.marketing_consents where purpose = 'partner_offers'`),
    ).toEqual({
      granted: false,
    });
    expect(await db.user(ids.mo).rows(`select 1 from public.marketing_consents`)).toEqual([]);
  });

  it('is stored apart from service notification preferences: turning on alerts grants nothing', async () => {
    await db
      .user(ids.erin)
      .run(
        `insert into public.preferences (user_id, match_alerts, ticket_reminders, club_news) values ($1, true, true, true)`,
        [ids.erin],
      );
    expect(
      await db.superuser.rows(`select 1 from public.marketing_consents where user_id = $1`, [
        ids.erin,
      ]),
    ).toEqual([]);
    expect(
      await db.superuser.rows(`select 1 from public.consent_log where user_id = $1`, [ids.erin]),
    ).toEqual([]);
    const columns = await db.superuser.rows<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'preferences'`,
    );
    expect(columns.map((c) => c.column_name).sort()).toEqual([
      'club_news',
      'match_alerts',
      'ticket_reminders',
      'updated_at',
      'user_id',
    ]);
  });

  it('logs every change: given, withdrawn, re-confirmed and removed', async () => {
    const me = db.user(ids.erin);
    await me.run(
      `insert into public.marketing_consents (user_id, purpose, granted, policy_version) values ($1, 'club_push', true, 'v1')`,
      [ids.erin],
    );
    await me.run(
      `update public.marketing_consents set granted = false where user_id = $1 and purpose = 'club_push'`,
      [ids.erin],
    );
    await me.run(
      `update public.marketing_consents set granted = true, policy_version = 'v2' where user_id = $1 and purpose = 'club_push'`,
      [ids.erin],
    );
    // A change that is not a consent change is not logged.
    await me.run(
      `update public.marketing_consents set updated_at = now() where user_id = $1 and purpose = 'club_push'`,
      [ids.erin],
    );
    await me.run(
      `delete from public.marketing_consents where user_id = $1 and purpose = 'club_push'`,
      [ids.erin],
    );

    const log = await me.rows(
      `select purpose, granted, policy_version, source from public.consent_log where purpose = 'club_push' order by id`,
    );
    expect(log).toEqual([
      { purpose: 'club_push', granted: true, policy_version: 'v1', source: 'app' },
      { purpose: 'club_push', granted: false, policy_version: 'v1', source: 'app' },
      { purpose: 'club_push', granted: true, policy_version: 'v2', source: 'app' },
      { purpose: 'club_push', granted: false, policy_version: 'v2', source: 'app' },
    ]);
  });

  it('the consent log is append-only for the supporter, the service role and the superuser', async () => {
    expect(
      await sqlState(db.user(ids.alice).run(`update public.consent_log set granted = false`)),
    ).toBe('42501');
    expect(await sqlState(db.user(ids.alice).run(`delete from public.consent_log`))).toBe('42501');
    expect(
      await sqlState(
        db
          .user(ids.alice)
          .run(
            `insert into public.consent_log (user_id, purpose, granted, source) values ($1, 'club_sms', true, 'app')`,
            [ids.alice],
          ),
      ),
    ).toBe('42501');
    expect(await sqlState(db.service.run(`update public.consent_log set granted = false`))).toBe(
      '42501',
    );
    expect(await sqlState(db.service.run(`delete from public.consent_log`))).toBe('42501');
    for (const statement of [
      `update public.consent_log set granted = false`,
      `delete from public.consent_log`,
      `truncate public.consent_log`,
    ]) {
      await expect(db.superuser.run(statement)).rejects.toThrow(/consent_log is append-only/);
    }
    expect(
      await db.superuser.rows(`select 1 from public.consent_log where user_id = $1`, [ids.alice]),
    ).toHaveLength(1);
  });
});

describe('console roles are granted by a club_admin and by nobody else', () => {
  it('a supporter cannot make themselves an admin, or see who is one', async () => {
    expect(
      await sqlState(
        db
          .user(ids.alice)
          .run(`insert into public.user_roles (user_id, role) values ($1, 'club_admin')`, [
            ids.alice,
          ]),
      ),
    ).toBe('42501');
    expect(await db.user(ids.alice).rows(`select * from public.user_roles`)).toEqual([]);
    expect(await db.user(ids.alice).rows(`select * from public.audit_logs`)).toEqual([]);
  });

  it('an editor, a moderator and a partner_admin cannot grant roles either', async () => {
    for (const id of [ids.erin, ids.mo, ids.pat]) {
      expect(
        await sqlState(
          db
            .user(id)
            .run(`insert into public.user_roles (user_id, role) values ($1, 'club_admin')`, [id]),
        ),
      ).toBe('42501');
    }
  });

  it('a club_admin grants and revokes, and the grant is attributed to them whatever they claim', async () => {
    const asCleo = db.user(ids.cleo);
    const granted = await asCleo.one(
      `insert into public.user_roles (user_id, role, granted_by) values ($1, 'editor', $2) returning granted_by`,
      [ids.alice, ids.bob],
    );
    expect(granted).toEqual({ granted_by: ids.cleo });
    expect(
      (
        await db
          .user(ids.alice)
          .one<{ ok: boolean }>(`select app.has_permission('content.write') as ok`)
      ).ok,
    ).toBe(true);
    // There is no UPDATE on a role row at all.
    expect(
      await sqlState(
        asCleo.run(`update public.user_roles set role = 'club_admin' where user_id = $1`, [
          ids.alice,
        ]),
      ),
    ).toBe('42501');
    expect(await asCleo.run(`delete from public.user_roles where user_id = $1`, [ids.alice])).toBe(
      1,
    );
    expect(
      (
        await db
          .user(ids.alice)
          .one<{ ok: boolean }>(`select app.has_permission('content.write') as ok`)
      ).ok,
    ).toBe(false);
  });

  it('a suspended admin loses every permission at once', async () => {
    await db.superuser.run(`update public.users set account_status = 'suspended' where id = $1`, [
      ids.cleo,
    ]);
    expect(
      (
        await db
          .user(ids.cleo)
          .one<{ ok: boolean }>(`select app.has_permission('roles.manage') as ok`)
      ).ok,
    ).toBe(false);
    expect(
      await sqlState(
        db
          .user(ids.cleo)
          .run(`insert into public.user_roles (user_id, role) values ($1, 'editor')`, [ids.alice]),
      ),
    ).toBe('42501');
  });

  it('a suspended supporter can still read and withdraw, but cannot create', async () => {
    await db.superuser.run(`update public.users set account_status = 'suspended' where id = $1`, [
      ids.alice,
    ]);
    const me = db.user(ids.alice);
    expect(await me.rows(`select 1 from public.profiles`)).toHaveLength(1);
    expect(
      await me.run(`update public.marketing_consents set granted = false where user_id = $1`, [
        ids.alice,
      ]),
    ).toBe(1);
    await db.superuser.run(`delete from public.preferences where user_id = $1`, [ids.alice]);
    expect(
      await sqlState(me.run(`insert into public.preferences (user_id) values ($1)`, [ids.alice])),
    ).toBe('42501');
  });
});
