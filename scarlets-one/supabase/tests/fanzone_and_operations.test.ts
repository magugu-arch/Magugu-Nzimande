import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestDatabase, ids, seedCast, sqlState } from './harness';

/**
 * Fan Zone entries, match-event revisions, rate limiting, retention and
 * account deletion: the rules that protect supporters and keep the record
 * honest, proved against a real PostgreSQL.
 */
let db: TestDatabase;

const POLL = '00000000-0000-4000-8000-00000000dd01';
const FAN_CAM = '00000000-0000-4000-8000-00000000dd02';

beforeAll(async () => {
  db = await TestDatabase.create();
  await seedCast(db);
  const su = db.superuser;
  await su.run(
    `insert into public.activity_definitions (id, kind, title, prompt, opens_at, closes_at, config, requires_sign_in, status)
     values
       ($1, 'poll', '{"en":"Poll"}', '{"en":"Pick one"}', now() - interval '1 hour', now() + interval '1 hour',
        '{"options":[{"id":"a"},{"id":"b"}]}', false, 'approved'),
       ($2, 'fan_cam', '{"en":"Fan Cam"}', '{"en":"Send a photo"}', now() - interval '1 hour', now() + interval '1 hour',
        '{}', true, 'approved')`,
    [POLL, FAN_CAM],
  );
});
afterAll(async () => db.close());
beforeEach(async () => db.begin());
afterEach(async () => db.rollback());

const vote = (userId: string, option: string) =>
  db.user(userId).run(
    `insert into public.fan_activities (activity_id, activity_type, user_id, submission)
       values ($1, 'poll', $2, jsonb_build_object('optionId', $3::text))`,
    [POLL, userId, option],
  );

describe('polls: one vote each', () => {
  it('takes a first vote and refuses a second from the same supporter', async () => {
    expect(await sqlState(vote(ids.alice, 'a'))).toBe('ok');
    expect(await sqlState(vote(ids.alice, 'b'))).toBe('23505');
    expect(await sqlState(vote(ids.bob, 'b'))).toBe('ok');
  });

  it('refuses an option that is not on the poll', async () => {
    expect(await sqlState(vote(ids.alice, 'zzz'))).toBe('23514');
  });

  it('refuses a vote cast in someone else’s name', async () => {
    const forged = db.user(ids.alice).run(
      `insert into public.fan_activities (activity_id, activity_type, user_id, submission)
         values ($1, 'poll', $2, '{"optionId":"a"}')`,
      [POLL, ids.bob],
    );
    expect(await sqlState(forged)).not.toBe('ok');
  });

  it('keeps one supporter’s vote private from another', async () => {
    await vote(ids.alice, 'a');
    const seen = await db
      .user(ids.bob)
      .rows(`select id from public.fan_activities where user_id = $1`, [ids.alice]);
    expect(seen).toHaveLength(0);
    const own = await db
      .user(ids.alice)
      .rows(`select id from public.fan_activities where user_id = $1`, [ids.alice]);
    expect(own).toHaveLength(1);
  });

  it('refuses a vote once the poll has closed', async () => {
    await db.superuser.run(
      `update public.activity_definitions set opens_at = now() - interval '2 hours', closes_at = now() - interval '1 hour' where id = $1`,
      [POLL],
    );
    expect(await sqlState(vote(ids.alice, 'a'))).toBe('23514');
  });
});

describe('Fan Cam: consent first, moderation before anyone else sees it', () => {
  // A supporter cannot choose a record's id: the database issues it.
  const upload = async () =>
    (
      await db.user(ids.alice).one<{ id: string }>(
        `insert into public.media_assets (origin, owner_id, bucket, object_path, mime_type, byte_size)
           values ('supporter', $1, 'fan-cam', $2, 'image/jpeg', 204800) returning id`,
        [ids.alice, `${ids.alice}/photo-1.jpg`],
      )
    ).id;
  const consent = async () =>
    (
      await db.user(ids.alice).one<{ id: string }>(
        `insert into public.fan_cam_consents (user_id, age_or_guardian, people_in_photo, display_and_moderation, policy_version)
           values ($1, true, true, true, 'v1') returning id`,
        [ids.alice],
      )
    ).id;
  const submit = (photoId: string, consentId: string | null) =>
    db.user(ids.alice).run(
      `insert into public.fan_activities (activity_id, activity_type, user_id, submission, media_asset_id, consent_record_id)
         values ($1, 'fan_cam', $2, '{"caption":"Scarves up"}', $3, $4)`,
      [FAN_CAM, ids.alice, photoId, consentId],
    );
  /** Upload, consent and send: the whole happy path. */
  const send = async () => submit(await upload(), await consent());

  it('rejects an upload of the wrong type, an oversized one, and one filed under another supporter', async () => {
    const insert = (path: string, mime: string, bytes: number, owner: string = ids.alice) =>
      db.user(ids.alice).run(
        `insert into public.media_assets (origin, owner_id, bucket, object_path, mime_type, byte_size)
           values ('supporter', $1, 'fan-cam', $2, $3, $4)`,
        [owner, path, mime, bytes],
      );
    expect(await sqlState(insert(`${ids.alice}/a.gif`, 'image/gif', 1000))).toBe('23514');
    expect(await sqlState(insert(`${ids.alice}/a.jpg`, 'image/jpeg', 11 * 1024 * 1024))).toBe(
      '23514',
    );
    expect(await sqlState(insert(`${ids.alice}/a.png`, 'image/jpeg', 1000))).toBe('23514');
    expect(await sqlState(insert(`${ids.bob}/a.jpg`, 'image/jpeg', 1000, ids.bob))).not.toBe('ok');
  });

  it('refuses a consent record unless all three permissions are given', async () => {
    const partial = db.user(ids.alice).run(
      `insert into public.fan_cam_consents (user_id, age_or_guardian, people_in_photo, display_and_moderation, policy_version)
         values ($1, true, true, false, 'v1')`,
      [ids.alice],
    );
    expect(await sqlState(partial)).toBe('23514');
  });

  it('refuses a photo with no consent record', async () => {
    expect(await sqlState(submit(await upload(), null))).toBe('23514');
  });

  it('does not let the sender name a moderation status at all', async () => {
    const photo = await upload();
    const consentId = await consent();
    const claimed = db.user(ids.alice).run(
      `insert into public.fan_activities (activity_id, activity_type, user_id, submission, media_asset_id, consent_record_id, moderation_status)
         values ($1, 'fan_cam', $2, '{}', $3, $4, 'approved')`,
      [FAN_CAM, ids.alice, photo, consentId],
    );
    expect(await sqlState(claimed)).toBe('42501');
  });

  it('holds a photo as pending and opens a moderation case', async () => {
    expect(await sqlState(send())).toBe('ok');
    const entry = await db
      .user(ids.alice)
      .one<{ id: string; moderation_status: string }>(
        `select id, moderation_status from public.fan_activities where activity_id = $1`,
        [FAN_CAM],
      );
    expect(entry.moderation_status).toBe('pending');
    const cases = await db
      .user(ids.mo)
      .rows<{ status: string; opened_reason: string }>(
        `select status, opened_reason from public.moderation_cases where fan_activity_id = $1`,
        [entry.id],
      );
    expect(cases).toEqual([{ status: 'open', opened_reason: 'pre_moderation' }]);
  });

  /** The upload scanner (a service) marks the file clean. Only then can it be approved. */
  const scanClean = () =>
    db.service.run(`update public.media_assets set scan_status = 'clean' where owner_id = $1`, [
      ids.alice,
    ]);
  const approve = () =>
    db
      .user(ids.mo)
      .run(
        `update public.moderation_cases set status = 'approved', decision_reason = 'ok' where status = 'open'`,
      );

  const gallery = async (userId: string) =>
    (await db.user(userId).rows(`select * from public.fan_cam_gallery`)).length;
  const rawRows = async (userId: string) =>
    (
      await db
        .user(userId)
        .rows(`select id from public.fan_activities where activity_id = $1`, [FAN_CAM])
    ).length;

  it('shows the photo to nobody else until a moderator approves it', async () => {
    await send();
    expect(await gallery(ids.bob)).toBe(0);
    // Another supporter can never read the entry itself, approved or not.
    expect(await rawRows(ids.bob)).toBe(0);

    // A supporter cannot approve it: not their own, and not through the case.
    const self = db
      .user(ids.alice)
      .run(
        `update public.fan_activities set moderation_status = 'approved' where activity_id = $1`,
        [FAN_CAM],
      );
    expect(await sqlState(self)).not.toBe('ok');
    await db
      .user(ids.bob)
      .run(`update public.moderation_cases set status = 'approved', decision_reason = 'ok'`)
      .catch(() => undefined);
    expect(await gallery(ids.bob)).toBe(0);

    // Not even a moderator can approve a file the scanner has not passed.
    expect(await sqlState(approve())).toBe('23514');
    expect(await gallery(ids.bob)).toBe(0);

    await scanClean();
    expect(await approve()).toBe(1);
    expect(await gallery(ids.bob)).toBe(1);
    expect(await rawRows(ids.bob)).toBe(0);
  });

  it('lets the sender withdraw, which takes the photo out of view for good', async () => {
    await send();
    await scanClean();
    await approve();
    expect(await gallery(ids.bob)).toBe(1);
    const withdrawn = await db
      .user(ids.alice)
      .run(
        `update public.fan_activities set moderation_status = 'withdrawn' where activity_id = $1`,
        [FAN_CAM],
      );
    expect(withdrawn).toBe(1);
    expect(await gallery(ids.bob)).toBe(0);
    // It cannot be brought back.
    await db
      .user(ids.alice)
      .run(
        `update public.fan_activities set moderation_status = 'pending' where activity_id = $1`,
        [FAN_CAM],
      )
      .catch(() => undefined);
    const after = await db
      .user(ids.alice)
      .one<{ moderation_status: string }>(
        `select moderation_status from public.fan_activities where activity_id = $1`,
        [FAN_CAM],
      );
    expect(after.moderation_status).toBe('withdrawn');
  });
});

describe('match events are append-only revisions', () => {
  const insert = (revision: number, side: string) =>
    db.service.run(
      `insert into public.match_events (fixture_id, provider_event_id, revision, event_type, clock_minute, team_side, source_timestamp)
       values ($1, 'evt-1', $2, 'try', 23, $3, now())`,
      [ids.fixture, revision, side],
    );

  it('stores a correction as a new revision beside the original', async () => {
    expect(await sqlState(insert(1, 'home'))).toBe('ok');
    expect(await sqlState(insert(2, 'away'))).toBe('ok');
    const rows = await db.service.rows(
      `select revision, team_side from public.match_events where provider_event_id = 'evt-1' order by revision`,
    );
    expect(rows).toEqual([
      { revision: 1, team_side: 'home' },
      { revision: 2, team_side: 'away' },
    ]);
  });

  it('rejects the same revision twice', async () => {
    await insert(1, 'home');
    expect(await sqlState(insert(1, 'away'))).toBe('23505');
  });

  it('cannot be edited or deleted, even by the service role', async () => {
    await insert(1, 'home');
    expect(
      await sqlState(db.service.run(`update public.match_events set team_side = 'away'`)),
    ).not.toBe('ok');
    expect(await sqlState(db.service.run(`delete from public.match_events`))).not.toBe('ok');
  });

  it('cannot be written by a person, whatever their console role', async () => {
    for (const id of [ids.alice, ids.erin, ids.cleo]) {
      const attempt = db.user(id).run(
        `insert into public.match_events (fixture_id, provider_event_id, revision, event_type, clock_minute, source_timestamp)
           values ($1, 'evt-x', 1, 'kick_off', 0, now())`,
        [ids.fixture],
      );
      expect(await sqlState(attempt)).toBe('42501');
    }
  });
});

describe('rate limiting', () => {
  const hit = () =>
    db.service.one<{ allowed: boolean; remaining: number }>(
      `select allowed, remaining from public.check_rate_limit('user:' || $1, 'test.action', 2, interval '1 minute')`,
      [ids.alice],
    );

  it('allows up to the limit inside the window and then refuses', async () => {
    expect(await hit()).toEqual({ allowed: true, remaining: 1 });
    expect(await hit()).toEqual({ allowed: true, remaining: 0 });
    expect(await hit()).toEqual({ allowed: false, remaining: 0 });
  });

  it('counts each subject and each action separately', async () => {
    await hit();
    await hit();
    const other = await db.service.one<{ allowed: boolean }>(
      `select allowed from public.check_rate_limit('user:' || $1, 'test.action', 2, interval '1 minute')`,
      [ids.bob],
    );
    expect(other.allowed).toBe(true);
  });

  it('cannot be called by a client to spend someone else’s allowance', async () => {
    const attempt = db
      .user(ids.alice)
      .rows(
        `select * from public.check_rate_limit('user:' || $1, 'fanzone.submit', 1, interval '1 minute')`,
        [ids.bob],
      );
    expect(await sqlState(attempt)).toBe('42501');
  });
});

describe('retention and account deletion', () => {
  it('deletes push tokens that have not been seen for the retention period, and keeps recent ones', async () => {
    await db.superuser.run(
      `insert into public.device_tokens (user_id, platform, token, last_seen_at) values
         ($1, 'ios', 'stale-token-0000000000000000', now() - interval '200 days'),
         ($1, 'ios', 'fresh-token-0000000000000000', now() - interval '2 days')`,
      [ids.alice],
    );
    const report = await db.service.rows<{ policy_key: string; rows_affected: string }>(
      `select * from public.purge_expired()`,
    );
    const tokens = report.find((r) => r.policy_key === 'device_tokens.unused');
    expect(Number(tokens?.rows_affected)).toBe(1);
    const left = await db.superuser.rows<{ token: string }>(
      `select token from public.device_tokens`,
    );
    expect(left.map((r) => r.token)).toEqual(['fresh-token-0000000000000000']);
  });

  it('cannot be run by a signed-in person', async () => {
    expect(await sqlState(db.user(ids.cleo).rows(`select * from public.purge_expired()`))).toBe(
      '42501',
    );
  });

  it('carries a retention policy for every kind of record it purges, with no reward data among them', async () => {
    const policies = await db.superuser.rows<{ key: string; target_table: string }>(
      `select key, target_table from public.retention_policies order by key`,
    );
    expect(policies.length).toBeGreaterThanOrEqual(8);
    expect(policies.some((p) => /reward/.test(p.target_table))).toBe(false);
  });

  it('lets a supporter delete their own account: contact details go, the audit record stays without them', async () => {
    await db.user(ids.alice).run(
      `insert into public.profiles (user_id, display_name, language) values ($1, 'Alice Example', 'cy')
       on conflict (user_id) do update set display_name = excluded.display_name`,
      [ids.alice],
    );
    await db.user(ids.alice).rows(`select public.delete_my_account()`);
    const account = await db.superuser.one<{ account_status: string; email: string | null }>(
      `select account_status, email from public.users where id = $1`,
      [ids.alice],
    );
    expect(account).toEqual({ account_status: 'deleted', email: null });
    const names = await db.superuser.rows(
      `select 1 from public.profiles where user_id = $1 and display_name = 'Alice Example'`,
      [ids.alice],
    );
    expect(names).toHaveLength(0);
    const audit = await db.superuser.rows<{ record: string }>(
      `select (to_jsonb(a))::text as record from public.audit_logs a where a.action = 'account.deleted' and a.entity_id = $1`,
      [ids.alice],
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]?.record).not.toMatch(/Alice Example|example\.test/);
  });

  it('does not let one supporter delete another’s account', async () => {
    expect(
      await sqlState(db.user(ids.bob).rows(`select public.delete_account($1)`, [ids.alice])),
    ).toBe('42501');
    const account = await db.superuser.one<{ account_status: string }>(
      `select account_status from public.users where id = $1`,
      [ids.alice],
    );
    expect(account.account_status).not.toBe('deleted');
  });
});
