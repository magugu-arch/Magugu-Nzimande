import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

export type Row = Record<string, unknown>;
type DbRole = 'postgres' | 'anon' | 'authenticated' | 'service_role';

/** Every migration, in the order `supabase db push` would apply them. */
export function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

/**
 * One identity talking to the database. Each call switches to that identity's
 * role and JWT subject first, exactly as PostgREST does for a request, and
 * switches back afterwards.
 */
export interface Session {
  /** Run a statement and return its rows. */
  rows<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run a statement and return the first row (throws if there is none). */
  one<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T>;
  /** Run a statement and return how many rows it changed. */
  run(sql: string, params?: unknown[]): Promise<number>;
}

/**
 * A fresh in-process PostgreSQL with the Supabase stand-in and every
 * migration applied.
 *
 * Tests call `begin()` before and `rollback()` after each case, so cases
 * cannot affect each other. Inside that transaction each statement gets its
 * own savepoint: a statement the database refuses (which is what most of
 * these tests are about) is undone without aborting the rest of the case.
 */
export class TestDatabase {
  private inTransaction = false;

  private constructor(readonly pg: PGlite) {}

  static async create(): Promise<TestDatabase> {
    const pg = new PGlite({ extensions: { btree_gist } });
    await pg.exec(readFileSync(join(here, 'supabase_shim.sql'), 'utf8'));
    const db = new TestDatabase(pg);
    await db.applyMigrations();
    return db;
  }

  /** Applies every migration as `migrator`, the non-superuser stand-in for Supabase's `postgres`. */
  async applyMigrations(): Promise<void> {
    await this.pg.exec('set role migrator');
    try {
      for (const name of migrationFiles()) {
        try {
          await this.pg.exec(readFileSync(join(migrationsDir, name), 'utf8'));
        } catch (error) {
          throw new Error(`${name}: ${(error as Error).message}`, { cause: error });
        }
      }
    } finally {
      await this.pg.exec('reset role');
    }
  }

  /**
   * PGlite's superuser. Used to arrange data, and to show that the append-only
   * rules hold even for the most privileged role there is. Never used to show
   * that something is allowed.
   */
  get superuser(): Session {
    return this.session('postgres');
  }

  /** No session: the `anon` role with no JWT subject. */
  get anon(): Session {
    return this.session('anon');
  }

  /** The backend: the `service_role` role, which bypasses RLS. */
  get service(): Session {
    return this.session('service_role');
  }

  /** A signed-in person: the `authenticated` role with `sub` = their account id. */
  user(id: string): Session {
    return this.session('authenticated', id);
  }

  async begin(): Promise<void> {
    await this.pg.exec('begin');
    this.inTransaction = true;
  }

  async rollback(): Promise<void> {
    await this.pg.exec('rollback');
    this.inTransaction = false;
  }

  async close(): Promise<void> {
    await this.pg.close();
  }

  private session(role: DbRole, sub = ''): Session {
    const query = async <T extends Row>(sql: string, params: unknown[] = []) => {
      await this.pg.exec('reset role');
      await this.pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub]);
      if (role !== 'postgres') await this.pg.exec(`set role ${role}`);
      if (this.inTransaction) await this.pg.exec('savepoint statement');
      try {
        const result = await this.pg.query<T>(sql, params);
        if (this.inTransaction) await this.pg.exec('release savepoint statement');
        return result;
      } catch (error) {
        if (this.inTransaction) await this.pg.exec('rollback to savepoint statement');
        throw error;
      } finally {
        await this.pg.exec('reset role');
        await this.pg.exec(`select set_config('request.jwt.claim.sub', '', false)`);
      }
    };

    return {
      rows: async <T extends Row = Row>(sql: string, params?: unknown[]) =>
        (await query<T>(sql, params)).rows,
      one: async <T extends Row = Row>(sql: string, params?: unknown[]) => {
        const [first] = (await query<T>(sql, params)).rows;
        if (first === undefined) throw new Error(`Expected a row from: ${sql}`);
        return first;
      },
      run: async (sql: string, params?: unknown[]) => (await query(sql, params)).affectedRows ?? 0,
    };
  }
}

/**
 * The SQLSTATE a statement fails with, or 'ok' if it succeeds. Asserting on
 * the code says *why* something was refused, not just that it was:
 *
 *   42501  insufficient privilege: no GRANT, an RLS WITH CHECK, or a guard trigger
 *   23505  unique violation
 *   23514  check violation
 *   23P01  exclusion violation
 *   23503  foreign-key violation
 */
export async function sqlState(attempt: Promise<unknown>): Promise<string> {
  try {
    await attempt;
    return 'ok';
  } catch (error) {
    return (error as { code?: string }).code ?? `no SQLSTATE: ${(error as Error).message}`;
  }
}

/** Readable, fixed account ids. */
export const ids = {
  alice: '00000000-0000-4000-8000-0000000000a1',
  bob: '00000000-0000-4000-8000-0000000000b2',
  erin: '00000000-0000-4000-8000-0000000000e3', // editor
  mo: '00000000-0000-4000-8000-0000000000d4', // moderator
  cleo: '00000000-0000-4000-8000-0000000000c5', // club_admin
  pat: '00000000-0000-4000-8000-0000000000f6', // partner_admin for Acme
  quinn: '00000000-0000-4000-8000-0000000000f7', // partner_admin for Borth
  acme: '00000000-0000-4000-8000-00000000aa01', // partner
  borth: '00000000-0000-4000-8000-00000000aa02', // partner
  scarlets: '00000000-0000-4000-8000-00000000bb01', // team
  visitors: '00000000-0000-4000-8000-00000000bb02', // team
  fixture: '00000000-0000-4000-8000-00000000cc01',
} as const;

/**
 * The cast every test file starts from: two supporters, one person in each
 * console role, two partners and one fixture. Accounts are created the way a
 * real sign-up creates them: a row in auth.users, which the migration's
 * trigger turns into a row in public.users.
 */
export async function seedCast(db: TestDatabase): Promise<void> {
  const su = db.superuser;
  for (const id of [ids.alice, ids.bob, ids.erin, ids.mo, ids.cleo, ids.pat, ids.quinn]) {
    await su.run(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@example.test`]);
  }
  await su.run(
    `insert into public.partners (id, name, approved) values ($1, 'Acme', true), ($2, 'Borth', true)`,
    [ids.acme, ids.borth],
  );
  await su.run(
    `insert into public.user_roles (user_id, role, partner_id) values
       ($1, 'editor', null), ($2, 'moderator', null), ($3, 'club_admin', null),
       ($4, 'partner_admin', $6), ($5, 'partner_admin', $7)`,
    [ids.erin, ids.mo, ids.cleo, ids.pat, ids.quinn, ids.acme, ids.borth],
  );
  await su.run(
    `insert into public.teams (id, name, short_name, is_scarlets) values
       ($1, 'Scarlets', 'SCA', true), ($2, 'Visitors', 'VIS', false)`,
    [ids.scarlets, ids.visitors],
  );
  await su.run(
    `insert into public.fixtures (id, provider_id, squad, competition, home_team_id, away_team_id,
                                  venue_name, kickoff_utc)
     values ($1, 'demo-fixture-1', 'first_team', '{"en": "Demo competition"}', $2, $3,
             'Demo ground', now() + interval '2 days')`,
    [ids.fixture, ids.scarlets, ids.visitors],
  );
}
