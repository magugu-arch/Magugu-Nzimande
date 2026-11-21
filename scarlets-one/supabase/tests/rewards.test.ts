import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestDatabase, ids, seedCast, sqlState } from './harness';

let db: TestDatabase;
let aliceWallet: string;
let bobWallet: string;

const INSERT_TXN = `
  insert into public.reward_transactions (provider_txn_id, wallet_id, user_id, type, amount, occurred_at, source_system)
  values ($1, $2, $3, 'earned', $4, now(), 'demo-rewards')`;

beforeAll(async () => {
  db = await TestDatabase.create();
  await seedCast(db);
  const wallet = async (user: string, ref: string) =>
    (
      await db.service.one<{ id: string }>(
        `insert into public.rewards_wallets (user_id, scheme_id, provider_member_ref)
         values ($1, 'demo-scheme', $2) returning id`,
        [user, ref],
      )
    ).id;
  aliceWallet = await wallet(ids.alice, 'ref-alice');
  bobWallet = await wallet(ids.bob, 'ref-bob');
});

afterAll(async () => {
  await db.close();
});

beforeEach(() => db.begin());
afterEach(() => db.rollback());

describe('nobody but the service role can change a reward', () => {
  const people = [
    ['supporter (the wallet’s owner)', ids.alice],
    ['editor', ids.erin],
    ['moderator', ids.mo],
    ['partner_admin', ids.pat],
    ['club_admin', ids.cleo],
  ] as const;

  it.each(people)('a %s cannot insert a reward transaction', async (_role, id) => {
    expect(
      await sqlState(db.user(id).run(INSERT_TXN, ['txn-by-person', aliceWallet, ids.alice, 100])),
    ).toBe('42501');
    expect(await db.superuser.rows(`select 1 from public.reward_transactions`)).toEqual([]);
  });

  it.each(people)(
    'a %s cannot change a wallet balance, create a wallet or delete one',
    async (_role, id) => {
      const asPerson = db.user(id);
      expect(
        await sqlState(
          asPerson.run(
            `update public.rewards_wallets set balance = 5000, balance_as_of = now() where id = $1`,
            [aliceWallet],
          ),
        ),
      ).toBe('42501');
      expect(
        await sqlState(
          asPerson.run(
            `insert into public.rewards_wallets (user_id, scheme_id, provider_member_ref) values ($1, 'other-scheme', 'ref-x')`,
            [id],
          ),
        ),
      ).toBe('42501');
      expect(
        await sqlState(
          asPerson.run(`delete from public.rewards_wallets where id = $1`, [aliceWallet]),
        ),
      ).toBe('42501');
      expect(
        await db.superuser.one(`select balance from public.rewards_wallets where id = $1`, [
          aliceWallet,
        ]),
      ).toEqual({
        balance: null,
      });
    },
  );

  it('a visitor cannot read or write rewards', async () => {
    expect(await sqlState(db.anon.rows(`select * from public.rewards_wallets`))).toBe('42501');
    expect(await sqlState(db.anon.run(INSERT_TXN, ['txn-anon', aliceWallet, ids.alice, 1]))).toBe(
      '42501',
    );
  });

  it('there is no policy and no grant through which a person could write: the table says so itself', async () => {
    const policies = await db.superuser.rows(
      `select tablename, cmd, roles::text[] as roles from pg_policies
       where schemaname = 'public' and tablename in ('rewards_wallets', 'reward_transactions') order by tablename`,
    );
    expect(policies).toEqual([
      { tablename: 'reward_transactions', cmd: 'SELECT', roles: ['authenticated'] },
      { tablename: 'rewards_wallets', cmd: 'SELECT', roles: ['authenticated'] },
    ]);
  });

  it('the service role can record a transaction and update the wallet from the provider', async () => {
    expect(await db.service.run(INSERT_TXN, ['txn-service-1', aliceWallet, ids.alice, 250])).toBe(
      1,
    );
    expect(
      await db.service.run(
        `update public.rewards_wallets set balance = 250, balance_as_of = now(), sync_status = 'synced', last_synced_at = now() where id = $1`,
        [aliceWallet],
      ),
    ).toBe(1);
    // And the supporter can then read their own, and only their own.
    expect(
      await db
        .user(ids.alice)
        .rows(`select provider_txn_id, amount::int as amount from public.reward_transactions`),
    ).toEqual([{ provider_txn_id: 'txn-service-1', amount: 250 }]);
    expect(
      await db
        .user(ids.alice)
        .one(`select balance::int as balance, sync_status from public.rewards_wallets`),
    ).toEqual({
      balance: 250,
      sync_status: 'synced',
    });
    expect(await db.user(ids.bob).rows(`select 1 from public.reward_transactions`)).toEqual([]);
    expect(
      await db
        .user(ids.bob)
        .rows(`select 1 from public.rewards_wallets where id = $1`, [aliceWallet]),
    ).toEqual([]);
  });

  it('a transaction cannot be filed under a wallet that belongs to someone else', async () => {
    expect(
      await sqlState(db.service.run(INSERT_TXN, ['txn-mismatch', bobWallet, ids.alice, 1])),
    ).toBe('23503');
  });
});

describe('no reward economics are invented', () => {
  it('a new wallet has no balance, no tier and no sync, and a new transaction has no amount or expiry', async () => {
    expect(
      await db.superuser.one(
        `select balance, balance_as_of, tier, sync_status, last_synced_at from public.rewards_wallets where id = $1`,
        [aliceWallet],
      ),
    ).toEqual({
      balance: null,
      balance_as_of: null,
      tier: null,
      sync_status: 'never_synced',
      last_synced_at: null,
    });

    const txn = await db.service.one(
      `insert into public.reward_transactions (provider_txn_id, wallet_id, user_id, type, occurred_at, source_system)
       values ('txn-no-amount', $1, $2, 'pending', now(), 'demo-rewards')
       returning amount, expires_at, redemption_ref`,
      [aliceWallet, ids.alice],
    );
    expect(txn).toEqual({ amount: null, expires_at: null, redemption_ref: null });
  });

  it('no reward column has a default value, and the amount and balance are nullable', async () => {
    const columns = await db.superuser.rows(
      `select table_name, column_name, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public'
         and (table_name, column_name) in (('rewards_wallets', 'balance'), ('rewards_wallets', 'tier'),
              ('reward_transactions', 'amount'), ('reward_transactions', 'expires_at'))
       order by table_name, column_name`,
    );
    expect(columns).toEqual([
      {
        table_name: 'reward_transactions',
        column_name: 'amount',
        is_nullable: 'YES',
        column_default: null,
      },
      {
        table_name: 'reward_transactions',
        column_name: 'expires_at',
        is_nullable: 'YES',
        column_default: null,
      },
      {
        table_name: 'rewards_wallets',
        column_name: 'balance',
        is_nullable: 'YES',
        column_default: null,
      },
      {
        table_name: 'rewards_wallets',
        column_name: 'tier',
        is_nullable: 'YES',
        column_default: null,
      },
    ]);
  });

  it('a balance must carry the provider’s timestamp', async () => {
    expect(
      await sqlState(
        db.service.run(`update public.rewards_wallets set balance = 10 where id = $1`, [
          aliceWallet,
        ]),
      ),
    ).toBe('23514');
  });

  it('the migrations seed no wallet, transaction, membership or offer', async () => {
    const fresh = await TestDatabase.create();
    try {
      const counts = await fresh.superuser.one(
        `select (select count(*)::int from public.rewards_wallets) as wallets,
                (select count(*)::int from public.reward_transactions) as transactions,
                (select count(*)::int from public.memberships) as memberships,
                (select count(*)::int from public.offers) as offers,
                (select count(*)::int from public.partner_campaigns) as campaigns`,
      );
      expect(counts).toEqual({
        wallets: 0,
        transactions: 0,
        memberships: 0,
        offers: 0,
        campaigns: 0,
      });
    } finally {
      await fresh.close();
    }
  });
});

describe('reward events are idempotent', () => {
  it('the same provider_txn_id cannot be stored twice', async () => {
    expect(await db.service.run(INSERT_TXN, ['txn-dup', aliceWallet, ids.alice, 100])).toBe(1);
    expect(
      await sqlState(db.service.run(INSERT_TXN, ['txn-dup', aliceWallet, ids.alice, 100])),
    ).toBe('23505');
    // Not for another supporter either: the provider's id is the key.
    expect(await sqlState(db.service.run(INSERT_TXN, ['txn-dup', bobWallet, ids.bob, 100]))).toBe(
      '23505',
    );
    expect(
      await db.superuser.rows(
        `select 1 from public.reward_transactions where provider_txn_id = 'txn-dup'`,
      ),
    ).toHaveLength(1);
  });

  it('a replayed delivery can be absorbed with ON CONFLICT DO NOTHING', async () => {
    const upsert = `${INSERT_TXN} on conflict (provider_txn_id) do nothing`;
    expect(await db.service.run(upsert, ['txn-replay', aliceWallet, ids.alice, 100])).toBe(1);
    expect(await db.service.run(upsert, ['txn-replay', aliceWallet, ids.alice, 100])).toBe(0);
  });

  it('claim_webhook_event lets each delivery be processed once', async () => {
    const claim = async () =>
      (
        await db.service.one<{ go: boolean }>(
          `select public.claim_webhook_event('demo-rewards', 'evt-1', 'txn.created') as go`,
        )
      ).go;
    expect(await claim()).toBe(true);
    expect(await claim()).toBe(false);
    expect(await claim()).toBe(false);
    expect(
      await db.service.one(
        `select attempts, status from public.webhook_events where event_id = 'evt-1'`,
      ),
    ).toEqual({
      attempts: 3,
      status: 'received',
    });
    await db.service.run(`select public.complete_webhook_event('demo-rewards', 'evt-1', true)`);
    expect(await claim()).toBe(false);
  });

  it('a delivery that failed can be claimed again, and the same id from another provider is a different event', async () => {
    const claim = async (provider: string) =>
      (
        await db.service.one<{ go: boolean }>(
          `select public.claim_webhook_event($1, 'evt-2') as go`,
          [provider],
        )
      ).go;
    expect(await claim('demo-rewards')).toBe(true);
    await db.service.run(
      `select public.complete_webhook_event('demo-rewards', 'evt-2', false, 'provider_timeout')`,
    );
    expect(await claim('demo-rewards')).toBe(true);
    expect(await claim('demo-rewards')).toBe(false);
    expect(await claim('demo-ticketing')).toBe(true);
  });

  it('the webhook table itself refuses a duplicate, and no person can reach it', async () => {
    await db.service.run(
      `insert into public.webhook_events (provider, event_id) values ('demo-rewards', 'evt-3')`,
    );
    expect(
      await sqlState(
        db.service.run(
          `insert into public.webhook_events (provider, event_id) values ('demo-rewards', 'evt-3')`,
        ),
      ),
    ).toBe('23505');
    for (const id of [ids.alice, ids.cleo]) {
      expect(await sqlState(db.user(id).rows(`select * from public.webhook_events`))).toBe('42501');
      expect(
        await sqlState(
          db.user(id).one(`select public.claim_webhook_event('demo-rewards', 'evt-9')`),
        ),
      ).toBe('42501');
    }
  });
});

describe('reward changes leave an audit trail without the money in it', () => {
  it('records that the balance changed, by whom, and not what it is', async () => {
    await db.service.run(
      `update public.rewards_wallets set balance = 98765, balance_as_of = now(), sync_status = 'synced' where id = $1`,
      [aliceWallet],
    );
    await db.service.run(INSERT_TXN, ['txn-audited', aliceWallet, ids.alice, 43210]);
    const entries = await db.superuser.rows(
      `select actor_role, action, changed_columns, before, after from public.audit_logs
       where entity_type in ('rewards_wallets', 'reward_transactions') and occurred_at >= now() order by id`,
    );
    expect(entries).toEqual([
      {
        actor_role: 'service',
        action: 'rewards_wallets.update',
        changed_columns: ['balance', 'balance_as_of', 'sync_status'],
        before: { sync_status: 'never_synced' },
        after: { sync_status: 'synced' },
      },
      {
        actor_role: 'service',
        action: 'reward_transactions.insert',
        changed_columns: [],
        before: null,
        after: { type: 'earned', status: 'confirmed', source_system: 'demo-rewards' },
      },
    ]);
    expect(JSON.stringify(entries)).not.toMatch(/98765|43210|ref-alice/);
  });
});
