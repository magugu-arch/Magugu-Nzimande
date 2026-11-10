import { beforeAll, describe, expect, it } from 'vitest';
import {
  FAN_POST_STATUSES,
  MODERATION_ACTIONS,
  nextModerationStatus,
  ROLE_PERMISSIONS,
  ROLES,
} from '@kc-one/contracts';
import { as, attempt, freshDatabase, uuid, type Db } from './harness';

// People in the fixture data.
const ALICE = uuid(1); // supporter
const BOB = uuid(2); // supporter
const MOD = uuid(10); // moderator
const SUPPORT = uuid(11); // support agent
const CONTENT = uuid(12); // content admin
const ANALYST = uuid(13); // read-only analyst
const ROOT = uuid(14); // super admin

const alice = { role: 'authenticated', userId: ALICE } as const;
const bob = { role: 'authenticated', userId: BOB } as const;
const mod = { role: 'authenticated', userId: MOD } as const;
const support = { role: 'authenticated', userId: SUPPORT } as const;
const content = { role: 'authenticated', userId: CONTENT } as const;
const analyst = { role: 'authenticated', userId: ANALYST } as const;
const root = { role: 'authenticated', userId: ROOT } as const;
const anon = { role: 'anon' } as const;

const POST_ALICE_PENDING = uuid(100);
const POST_BOB_APPROVED = uuid(101);
const POST_ALICE_ESCALATED = uuid(102);
const REWARD = uuid(200);

let db: Db;

async function count(actor: Parameters<typeof as>[1], sql: string, params: unknown[] = []) {
  return as(db, actor, async (tx) => (await tx.query(sql, params)).rows.length);
}

beforeAll(async () => {
  db = await freshDatabase();
  // Seed as the migration owner (trusted), the way server functions write.
  await db.exec(`
    insert into auth.users (id) values
      ('${ALICE}'), ('${BOB}'), ('${MOD}'), ('${SUPPORT}'), ('${CONTENT}'), ('${ANALYST}'), ('${ROOT}');
    insert into public.admin_users (user_id, role) values
      ('${MOD}', 'moderator'), ('${SUPPORT}', 'support_agent'), ('${CONTENT}', 'content_admin'),
      ('${ANALYST}', 'analyst'), ('${ROOT}', 'super_admin');
    insert into public.profiles (id, display_name) values ('${ALICE}', 'Alice'), ('${BOB}', 'Bob');
    insert into public.member_accounts (user_id, provider, provider_ref, verification_state, member_number_last4, source)
      values ('${ALICE}', 'crm', 'A-1', 'verified', 'AB12', 'crm'), ('${BOB}', 'crm', 'B-1', 'pending', null, 'crm');
    insert into public.tickets (user_id, provider, provider_ref, event_name, source)
      values ('${ALICE}', 'tix', 'T-A', 'Match', 'tix'), ('${BOB}', 'tix', 'T-B', 'Match', 'tix');
    insert into public.reward_wallets (user_id, balance, source) values ('${ALICE}', 100, 'loyalty'), ('${BOB}', 5, 'loyalty');
    insert into public.rewards_catalog (id, source, provider_ref, title, category, terms)
      values ('${REWARD}', 'loyalty', 'R-1', 'Reward', 'experience', 'Terms');
    insert into public.notifications (user_id, category, title) values ('${ALICE}', 'matchday', 'Hi Alice'), ('${BOB}', 'matchday', 'Hi Bob');
    insert into public.fan_posts (id, author_id, media_kind, shows_minors, guardian_consent, rights_confirmed, consent_terms_version, consent_rules_version)
      values ('${POST_ALICE_PENDING}', '${ALICE}', 'image', false, false, true, 'v1', 'v1'),
             ('${POST_BOB_APPROVED}', '${BOB}', 'image', false, false, true, 'v1', 'v1'),
             ('${POST_ALICE_ESCALATED}', '${ALICE}', 'image', true, true, true, 'v1', 'v1');
    update public.fan_posts set status = 'approved' where id = '${POST_BOB_APPROVED}';
    update public.fan_posts set status = 'escalated' where id = '${POST_ALICE_ESCALATED}';
    insert into public.fixtures (source, provider_ref, competition_id, competition_name, home_team_id, home_team_name, home_is_club,
      away_team_id, away_team_name, away_is_club, approved)
      values ('feed', 'F-1', 'c', 'C', 'kc', 'Kaizer Chiefs', true, 'o', 'O', false, true),
             ('manual', 'F-2', 'c', 'C', 'kc', 'Kaizer Chiefs', true, 'o', 'O', false, false);
    insert into public.content_items (kind, title, status) values ('article', 'Live story', 'published'), ('article', 'Draft story', 'draft');
  `);
}, 60_000);

describe('schema hygiene', () => {
  it('enables RLS on every public table', async () => {
    const r = await db.query<{ tablename: string }>(
      `select c.relname as tablename from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(r.rows).toEqual([]);
  });

  it('stores no ticket entry secrets', async () => {
    const r = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'tickets'`,
    );
    const cols = r.rows.map((x) => x.column_name).join(',');
    expect(cols).not.toMatch(/token|qr|barcode|secret/);
  });

  it('mirrors the TypeScript role-permission matrix exactly', async () => {
    const r = await db.query<{ role: string; permission: string }>(
      'select role, permission from public.role_permissions',
    );
    for (const role of ROLES) {
      const sql = r.rows
        .filter((x) => x.role === role)
        .map((x) => x.permission)
        .sort();
      expect(sql).toEqual([...ROLE_PERMISSIONS[role]].sort());
    }
  });

  it('mirrors the TypeScript moderation transitions exactly', async () => {
    for (const s of FAN_POST_STATUSES) {
      for (const a of MODERATION_ACTIONS) {
        const r = await db.query<{ n: string | null }>(
          `select private.next_moderation_status($1::public.fan_post_status, $2::public.moderation_action) as n`,
          [s, a],
        );
        expect(r.rows[0]?.n ?? null).toBe(nextModerationStatus(s, a));
      }
    }
  });
});

describe('supporters cannot reach each other’s private data', () => {
  const ownOnly = [
    ['profiles', 'id'],
    ['member_accounts', 'user_id'],
    ['tickets', 'user_id'],
    ['reward_wallets', 'user_id'],
    ['notifications', 'user_id'],
  ] as const;

  for (const [table, col] of ownOnly) {
    it(`${table}: sees only their own rows`, async () => {
      expect(await count(alice, `select 1 from public.${table}`)).toBe(1);
      expect(await count(alice, `select 1 from public.${table} where ${col} = $1`, [BOB])).toBe(0);
      expect(await count(anon, `select 1 from public.${table}`)).toBe(0);
    });
  }

  it('cannot edit someone else’s profile, and can edit their own', async () => {
    const r = await as(db, alice, async (tx) => {
      const other = await tx.query(
        `update public.profiles set display_name = 'Hacked' where id = $1 returning id`,
        [BOB],
      );
      const own = await tx.query(
        `update public.profiles set display_name = 'Alicia' where id = $1 returning id`,
        [ALICE],
      );
      return [other.rows.length, own.rows.length];
    });
    expect(r).toEqual([0, 1]);
  });

  it('cannot write provider-synchronised data', async () => {
    expect(
      await attempt(
        db,
        alice,
        `insert into public.tickets (user_id, provider, provider_ref, event_name, source) values ($1, 'x', 'forged', 'Free', 'x')`,
        [ALICE],
      ),
    ).toMatch(/row-level security/);
    expect(
      await attempt(
        db,
        alice,
        `insert into public.reward_wallets (user_id, balance, source) values ($1, 999999, 'x')`,
        [ALICE],
      ),
    ).toMatch(/row-level security|duplicate/);
    const changed = await as(
      db,
      alice,
      async (tx) =>
        (await tx.query(`update public.reward_wallets set balance = 999999 returning 1`)).rows
          .length,
    );
    expect(changed).toBe(0);
    const verified = await as(
      db,
      bob,
      async (tx) =>
        (
          await tx.query(
            `update public.member_accounts set verification_state = 'verified' returning 1`,
          )
        ).rows.length,
    );
    expect(verified).toBe(0);
  });

  it('can mark a notification read but not rewrite it', async () => {
    expect(
      await attempt(
        db,
        alice,
        `update public.notifications set read_at = now() where user_id = $1`,
        [ALICE],
      ),
    ).toBeNull();
    expect(await attempt(db, alice, `update public.notifications set title = 'Changed'`)).toMatch(
      /permission denied/,
    );
  });

  it('support agents can look up a profile for support; analysts cannot', async () => {
    expect(await count(support, `select 1 from public.profiles`)).toBe(2);
    expect(await count(analyst, `select 1 from public.profiles`)).toBe(0);
  });
});

describe('Fan Moments', () => {
  it('shows approved moments publicly and pending ones only to their author and moderators', async () => {
    expect(await count(anon, `select 1 from public.fan_posts`)).toBe(1);
    expect(await count(bob, `select 1 from public.fan_posts`)).toBe(1);
    expect(await count(alice, `select 1 from public.fan_posts`)).toBe(3);
    expect(await count(mod, `select 1 from public.fan_posts`)).toBe(3);
  });

  it('forces new moments into review, and escalates ones showing children', async () => {
    const statuses = await as(db, alice, async (tx) => {
      const a = await tx.query<{ status: string }>(
        `insert into public.fan_posts (author_id, media_kind, status, shows_minors, rights_confirmed, consent_terms_version, consent_rules_version)
         values ($1, 'image', 'approved', false, true, 'v1', 'v1') returning status`,
        [ALICE],
      );
      const b = await tx.query<{ status: string }>(
        `insert into public.fan_posts (author_id, media_kind, shows_minors, guardian_consent, rights_confirmed, consent_terms_version, consent_rules_version)
         values ($1, 'image', true, true, true, 'v1', 'v1') returning status`,
        [ALICE],
      );
      return [a.rows[0]?.status, b.rows[0]?.status];
    });
    expect(statuses).toEqual(['pending_review', 'escalated']);
  });

  it('rejects posting as someone else, without consent, or showing children without a guardian', async () => {
    const insert = `insert into public.fan_posts (author_id, media_kind, shows_minors, guardian_consent, rights_confirmed, consent_terms_version, consent_rules_version) values ($1, 'image', $2, $3, $4, $5, 'v1')`;
    expect(await attempt(db, alice, insert, [BOB, false, false, true, 'v1'])).toMatch(
      /row-level security/,
    );
    expect(await attempt(db, alice, insert, [ALICE, false, false, false, 'v1'])).toMatch(
      /check constraint/,
    );
    expect(await attempt(db, alice, insert, [ALICE, false, false, true, ''])).toMatch(
      /check constraint/,
    );
    expect(await attempt(db, alice, insert, [ALICE, true, false, true, 'v1'])).toMatch(
      /check constraint/,
    );
  });

  it('does not let an author approve their own moment', async () => {
    const changed = await as(
      db,
      alice,
      async (tx) =>
        (
          await tx.query(
            `update public.fan_posts set status = 'approved' where id = $1 returning 1`,
            [POST_ALICE_PENDING],
          )
        ).rows.length,
    );
    expect(changed).toBe(0);
    expect(
      await attempt(db, alice, `select public.moderate_fan_post($1, 'approve', 'mine')`, [
        POST_ALICE_PENDING,
      ]),
    ).toMatch(/permission denied/);
  });

  it('lets authors remove their own moments, except while escalated', async () => {
    expect(
      await attempt(db, alice, `select public.remove_my_fan_post($1)`, [POST_ALICE_PENDING]),
    ).toBeNull();
    expect(
      await attempt(db, alice, `select public.remove_my_fan_post($1)`, [POST_ALICE_ESCALATED]),
    ).toMatch(/held for review/);
    expect(
      await attempt(db, bob, `select public.remove_my_fan_post($1)`, [POST_ALICE_PENDING]),
    ).toMatch(/not found/);
  });

  it('lets moderators act with a reason, records it and audits it', async () => {
    const r = await as(db, mod, async (tx) => {
      const status = await tx.query<{ s: string }>(
        `select public.moderate_fan_post($1, 'approve', 'Meets the rules') as s`,
        [POST_ALICE_PENDING],
      );
      const history = await tx.query(`select 1 from public.moderation_actions where post_id = $1`, [
        POST_ALICE_PENDING,
      ]);
      const audit = await tx.query<{ c: number }>(
        `select count(*)::int as c from public.audit_logs where action = 'fan_post.approve' and entity_id = $1`,
        [POST_ALICE_PENDING],
      );
      return { status: status.rows[0]?.s, history: history.rows.length, audit: audit.rows[0]?.c };
    });
    // Moderators lack audit.read, so they cannot see the audit row they created.
    expect(r).toEqual({ status: 'approved', history: 1, audit: 0 });
  });

  it('requires a reason and an allowed transition', async () => {
    expect(
      await attempt(db, mod, `select public.moderate_fan_post($1, 'approve', '  ')`, [
        POST_ALICE_PENDING,
      ]),
    ).toMatch(/reason is required/);
    expect(
      await attempt(db, mod, `select public.moderate_fan_post($1, 'restore', 'x')`, [
        POST_BOB_APPROVED,
      ]),
    ).toMatch(/cannot restore/);
  });

  it('lets support agents escalate but not approve; content admins cannot moderate', async () => {
    expect(
      await attempt(
        db,
        support,
        `select public.moderate_fan_post($1, 'escalate', 'Possible child safety issue')`,
        [POST_BOB_APPROVED],
      ),
    ).toBeNull();
    expect(
      await attempt(db, support, `select public.moderate_fan_post($1, 'approve', 'x')`, [
        POST_ALICE_PENDING,
      ]),
    ).toMatch(/permission denied/);
    expect(
      await attempt(db, content, `select public.moderate_fan_post($1, 'hide', 'x')`, [
        POST_BOB_APPROVED,
      ]),
    ).toMatch(/permission denied/);
  });

  it('accepts one report per supporter, filed as themselves, visible only to them and moderators', async () => {
    const report = `insert into public.fan_reports (post_id, reporter_id, reason) values ($1, $2, 'spam')`;
    expect(await attempt(db, alice, report, [POST_BOB_APPROVED, BOB])).toMatch(
      /row-level security/,
    );
    const counts = await as(db, alice, async (tx) => {
      await tx.query(report, [POST_BOB_APPROVED, ALICE]);
      let dup = 'none';
      await tx.query('savepoint s');
      try {
        await tx.query(report, [POST_BOB_APPROVED, ALICE]);
      } catch (e) {
        dup = String(e);
        await tx.query('rollback to savepoint s');
      }
      return { dup, mine: (await tx.query('select 1 from public.fan_reports')).rows.length };
    });
    expect(counts.dup).toMatch(/duplicate key/);
    expect(counts.mine).toBe(1);
  });
});

describe('content and campaigns', () => {
  it('shows only live content to the public and everything to staff', async () => {
    expect(await count(anon, `select 1 from public.content_items`)).toBe(1);
    expect(await count(analyst, `select 1 from public.content_items`)).toBe(2);
  });

  it('lets content admins draft and publish; others cannot write', async () => {
    const insert = `insert into public.content_items (kind, title, status) values ('article', 'New', $1)`;
    expect(await attempt(db, content, insert, ['draft'])).toBeNull();
    expect(await attempt(db, content, insert, ['published'])).toBeNull();
    expect(await attempt(db, mod, insert, ['draft'])).toMatch(/row-level security/);
    expect(await attempt(db, analyst, insert, ['draft'])).toMatch(/row-level security/);
    expect(await attempt(db, alice, insert, ['published'])).toMatch(
      /row-level security|content.publish/,
    );
  });

  it('audits publication', async () => {
    const n = await as(db, content, async (tx) => {
      await tx.query(
        `update public.content_items set status = 'published' where title = 'Draft story'`,
      );
      return 1;
    });
    expect(n).toBe(1);
    // Run again and read the audit trail as an analyst within one transaction.
    await db.exec('begin');
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [CONTENT]);
    await db.exec('set local role authenticated');
    await db.query(
      `update public.content_items set status = 'archived' where title = 'Live story'`,
    );
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [ANALYST]);
    const rows = await db.query<{ action: string }>(
      `select action from public.audit_logs where action = 'content.archived'`,
    );
    await db.exec('rollback');
    expect(rows.rows).toHaveLength(1);
  });

  it('separates drafting campaigns from scheduling them, and refuses past schedules', async () => {
    const draft = `insert into public.notification_campaigns (category, title, body, audience, status, scheduled_for) values ('matchday', 'T', 'B', 'opted_in_all', $1, $2)`;
    const later = new Date(Date.now() + 3600_000).toISOString();
    expect(await attempt(db, content, draft, ['scheduled', later])).toBeNull();
    expect(await attempt(db, content, draft, ['scheduled', new Date().toISOString()])).toMatch(
      /5 minutes/,
    );
    expect(await attempt(db, content, draft, ['sent', later])).toMatch(/delivery service/);
    expect(await attempt(db, mod, draft, ['draft', null])).toMatch(/row-level security/);
  });

  it('never sends account messages as campaigns', async () => {
    expect(
      await attempt(
        db,
        content,
        `insert into public.notification_campaigns (category, title, body, audience) values ('account', 'T', 'B', 'opted_in_all')`,
      ),
    ).toMatch(/check constraint/);
  });
});

describe('football data', () => {
  it('hides unapproved manual fixtures from the public', async () => {
    expect(await count(anon, `select 1 from public.fixtures`)).toBe(1);
    expect(await count(content, `select 1 from public.fixtures`)).toBe(2);
    expect(await attempt(db, alice, `update public.fixtures set approved = true`)).toBeNull();
    expect(await count(anon, `select 1 from public.fixtures`)).toBe(1);
  });

  it('refuses a half-entered score', async () => {
    expect(
      await attempt(
        db,
        content,
        `update public.fixtures set home_score = 1 where provider_ref = 'F-2'`,
      ),
    ).toMatch(/check constraint/);
  });
});

describe('audit log and staff roles', () => {
  it('is append-only, even for the database owner', async () => {
    await db.exec(`select private.audit('test.event', 'test', '1', '{}')`);
    await expect(db.exec(`update public.audit_logs set action = 'tampered'`)).rejects.toThrow(
      /append-only/,
    );
    await expect(db.exec(`delete from public.audit_logs`)).rejects.toThrow(/append-only/);
  });

  it('is readable by analysts but not by moderators or supporters', async () => {
    expect(await count(analyst, `select 1 from public.audit_logs`)).toBeGreaterThan(0);
    expect(await count(mod, `select 1 from public.audit_logs`)).toBe(0);
    expect(await count(alice, `select 1 from public.audit_logs`)).toBe(0);
  });

  it('lets only super admins change roles, never their own, with an audit entry', async () => {
    expect(
      await attempt(db, mod, `select public.set_staff_role($1, 'super_admin')`, [MOD]),
    ).toMatch(/permission denied/);
    expect(await attempt(db, root, `select public.set_staff_role($1, 'analyst')`, [ROOT])).toMatch(
      /your own role/,
    );
    const audited = await as(db, root, async (tx) => {
      await tx.query(`select public.set_staff_role($1, 'moderator')`, [ALICE]);
      return (
        await tx.query(
          `select 1 from public.audit_logs where action = 'staff.role_set' and entity_id = $1`,
          [ALICE],
        )
      ).rows.length;
    });
    expect(audited).toBe(1);
    expect(await count(mod, `select 1 from public.admin_users`)).toBe(1);
    expect(await count(root, `select 1 from public.admin_users`)).toBe(5);
  });

  it('cannot insert staff rows directly', async () => {
    expect(
      await attempt(
        db,
        alice,
        `insert into public.admin_users (user_id, role) values ($1, 'super_admin')`,
        [ALICE],
      ),
    ).toMatch(/row-level security/);
  });
});

describe('rewards', () => {
  it('records one redemption per idempotency key', async () => {
    const key = '3b241101-e2bb-4255-8caf-4136c566a962';
    const insert = `insert into public.reward_transactions (user_id, reward_id, idempotency_key) values ($1, $2, $3) on conflict (user_id, idempotency_key) do nothing returning id`;
    await db.exec('begin');
    const first = await db.query(insert, [ALICE, REWARD, key]);
    const retry = await db.query(insert, [ALICE, REWARD, key]);
    await db.exec('rollback');
    expect(first.rows).toHaveLength(1);
    expect(retry.rows).toHaveLength(0);
  });

  it('will not mark a redemption confirmed without the provider reference', async () => {
    await expect(
      db.query(
        `insert into public.reward_transactions (user_id, reward_id, idempotency_key, status) values ($1, $2, gen_random_uuid(), 'confirmed')`,
        [ALICE, REWARD],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('cannot be redeemed directly by a supporter', async () => {
    expect(
      await attempt(
        db,
        alice,
        `insert into public.reward_transactions (user_id, reward_id, idempotency_key) values ($1, $2, gen_random_uuid())`,
        [ALICE, REWARD],
      ),
    ).toMatch(/row-level security/);
  });
});

describe('storage', () => {
  it('lets supporters upload only into their own folder of the private bucket', async () => {
    const put = `insert into storage.objects (bucket_id, name) values ('fan-media', $1)`;
    expect(await attempt(db, alice, put, [`${ALICE}/post/photo.jpg`])).toBeNull();
    expect(await attempt(db, alice, put, [`${BOB}/post/photo.jpg`])).toMatch(/row-level security/);
    const bucket = await db.query<{ public: boolean }>(
      `select public from storage.buckets where id = 'fan-media'`,
    );
    expect(bucket.rows[0]?.public).toBe(false);
  });
});
