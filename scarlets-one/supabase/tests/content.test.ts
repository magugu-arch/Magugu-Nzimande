import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestDatabase, ids, seedCast, sqlState } from './harness';

let db: TestDatabase;

const item = {
  live: '00000000-0000-4000-8000-0000000c0001',
  draft: '00000000-0000-4000-8000-0000000c0002',
  scheduled: '00000000-0000-4000-8000-0000000c0003',
  embargoed: '00000000-0000-4000-8000-0000000c0004', // published, publish time still to come
  expired: '00000000-0000-4000-8000-0000000c0005',
  archived: '00000000-0000-4000-8000-0000000c0006',
} as const;

const INSERT_ITEM = `
  insert into public.content_items (id, kind, category, title, summary, status, publish_at, expire_at)
  values ($1, 'news', 'club', $2, '{"en": "Summary"}', $3, $4, $5)`;

const visibleIds = async (session: ReturnType<TestDatabase['user']>) =>
  (await session.rows<{ id: string }>(`select id from public.content_items order by id`)).map(
    (r) => r.id,
  );

beforeAll(async () => {
  db = await TestDatabase.create();
  await seedCast(db);
  const su = db.superuser;
  const past = `now() - interval '1 hour'`;
  const future = `now() + interval '1 day'`;
  for (const [id, status, publishAt, expireAt] of [
    [item.live, 'published', past, 'null'],
    [item.draft, 'draft', 'null', 'null'],
    [item.scheduled, 'scheduled', future, 'null'],
    [item.embargoed, 'published', future, 'null'],
    [item.expired, 'published', `now() - interval '2 days'`, past],
    [item.archived, 'archived', past, 'null'],
  ] as const) {
    await su.run(
      `insert into public.content_items (id, kind, category, title, summary, status, publish_at, expire_at)
       values ($1, 'news', 'club', '{"en": "Title", "cy": "Teitl"}', '{"en": "Summary"}', $2,
               ${publishAt}, ${expireAt})`,
      [id, status],
    );
  }
});

afterAll(async () => {
  await db.close();
});

beforeEach(() => db.begin());
afterEach(() => db.rollback());

describe('reading content', () => {
  it('a visitor with no session reads what is live and nothing else', async () => {
    expect(await visibleIds(db.anon)).toEqual([item.live]);
  });

  it('a visitor cannot read a draft even by asking for it by id', async () => {
    expect(
      await db.anon.rows(`select * from public.content_items where id = $1`, [item.draft]),
    ).toEqual([]);
    expect(await db.anon.rows(`select * from public.content_items where status = 'draft'`)).toEqual(
      [],
    );
  });

  it('a signed-in supporter sees exactly what a visitor sees', async () => {
    expect(await visibleIds(db.user(ids.alice))).toEqual([item.live]);
  });

  it('published content is not shown before its publish time or after it expires', async () => {
    const seen = await visibleIds(db.anon);
    expect(seen).not.toContain(item.embargoed);
    expect(seen).not.toContain(item.expired);
    expect(seen).not.toContain(item.scheduled);
  });

  it('an editor and a club_admin read everything, drafts included', async () => {
    expect(await visibleIds(db.user(ids.erin))).toEqual(Object.values(item).sort());
    expect(await visibleIds(db.user(ids.cleo))).toEqual(Object.values(item).sort());
  });

  it('a moderator (content.read) reads everything except drafts', async () => {
    const seen = await visibleIds(db.user(ids.mo));
    expect(seen).toEqual(
      Object.values(item)
        .filter((id) => id !== item.draft)
        .sort(),
    );
  });

  it('a partner_admin has no content permission and sees only what is live', async () => {
    expect(await visibleIds(db.user(ids.pat))).toEqual([item.live]);
  });
});

describe('writing content', () => {
  const newId = '00000000-0000-4000-8000-0000000c00aa';

  it('an editor can create and edit a draft, and it is attributed to them whatever they claim', async () => {
    const created = await db.user(ids.erin).one(
      `insert into public.content_items (id, kind, category, title, summary, created_by)
       values ($1, 'feature', 'history', '{"en": "Draft"}', '{"en": "Summary"}', $2)
       returning status, created_by, published_by`,
      [newId, ids.bob],
    );
    expect(created).toEqual({ status: 'draft', created_by: ids.erin, published_by: null });
    expect(
      await db
        .user(ids.erin)
        .run(`update public.content_items set title = '{"en": "Better draft"}' where id = $1`, [
          newId,
        ]),
    ).toBe(1);
    expect(await db.anon.rows(`select 1 from public.content_items where id = $1`, [newId])).toEqual(
      [],
    );
  });

  it('an editor cannot publish: not on insert, not by updating a draft', async () => {
    const asErin = db.user(ids.erin);
    expect(
      await sqlState(
        asErin.run(INSERT_ITEM, [
          newId,
          '{"en": "T"}',
          'published',
          new Date().toISOString(),
          null,
        ]),
      ),
    ).toBe('42501');
    expect(
      await sqlState(
        asErin.run(
          `update public.content_items set status = 'published', publish_at = now() where id = $1`,
          [item.draft],
        ),
      ),
    ).toBe('42501');
    expect(
      await db.superuser.one(`select status from public.content_items where id = $1`, [item.draft]),
    ).toEqual({
      status: 'draft',
    });
  });

  it('an editor cannot schedule either: scheduling is publishing with a delay', async () => {
    expect(
      await sqlState(
        db
          .user(ids.erin)
          .run(
            `update public.content_items set status = 'scheduled', publish_at = now() + interval '1 minute' where id = $1`,
            [item.draft],
          ),
      ),
    ).toBe('42501');
  });

  it('an editor cannot rewrite, unpublish or delete an item that is already live', async () => {
    const asErin = db.user(ids.erin);
    expect(
      await asErin.run(
        `update public.content_items set title = '{"en": "Rewritten"}' where id = $1`,
        [item.live],
      ),
    ).toBe(0);
    expect(
      await asErin.run(`update public.content_items set status = 'draft' where id = $1`, [
        item.live,
      ]),
    ).toBe(0);
    expect(await asErin.run(`delete from public.content_items where id = $1`, [item.live])).toBe(0);
    expect(
      await db.superuser.one(
        `select title ->> 'en' as title, status from public.content_items where id = $1`,
        [item.live],
      ),
    ).toEqual({
      title: 'Title',
      status: 'published',
    });
  });

  it('a club_admin can publish, and the publication is stamped with who and when', async () => {
    const published = await db
      .user(ids.cleo)
      .one<{ status: string; published_by: string; stamped: boolean }>(
        `update public.content_items set status = 'published', publish_at = now() - interval '1 second', published_by = $2
       where id = $1 returning status, published_by, published_at is not null as stamped`,
        [item.draft, ids.bob],
      );
    expect(published).toEqual({ status: 'published', published_by: ids.cleo, stamped: true });
    // Now anyone can read it.
    expect(
      await db.anon.rows(`select 1 from public.content_items where id = $1`, [item.draft]),
    ).toHaveLength(1);
  });

  it('a club_admin can create a published item directly and take one down', async () => {
    const asCleo = db.user(ids.cleo);
    expect(
      await asCleo.run(INSERT_ITEM, [
        newId,
        '{"en": "Direct"}',
        'published',
        new Date(Date.now() - 1000).toISOString(),
        null,
      ]),
    ).toBe(1);
    expect(
      await asCleo.run(`update public.content_items set status = 'archived' where id = $1`, [
        item.live,
      ]),
    ).toBe(1);
    expect(await visibleIds(db.anon)).toEqual([newId]);
    expect(
      await db.superuser.one(`select published_by from public.content_items where id = $1`, [
        item.live,
      ]),
    ).toEqual({
      published_by: null,
    });
  });

  it('a moderator cannot create, edit or delete content', async () => {
    const asMo = db.user(ids.mo);
    expect(await sqlState(asMo.run(INSERT_ITEM, [newId, '{"en": "T"}', 'draft', null, null]))).toBe(
      '42501',
    );
    expect(
      await asMo.run(
        `update public.content_items set title = '{"en": "Moderated"}' where id = $1`,
        [item.live],
      ),
    ).toBe(0);
    expect(
      await asMo.run(`update public.content_items set status = 'archived' where id = $1`, [
        item.archived,
      ]),
    ).toBe(0);
    expect(await asMo.run(`delete from public.content_items where id = $1`, [item.live])).toBe(0);
    expect(
      await db.superuser.one(
        `select title ->> 'en' as title from public.content_items where id = $1`,
        [item.live],
      ),
    ).toEqual({
      title: 'Title',
    });
  });

  it('a supporter, a partner_admin and a visitor cannot write content at all', async () => {
    for (const id of [ids.alice, ids.pat]) {
      expect(
        await sqlState(db.user(id).run(INSERT_ITEM, [newId, '{"en": "T"}', 'draft', null, null])),
      ).toBe('42501');
      expect(
        await db
          .user(id)
          .run(`update public.content_items set pinned = true where id = $1`, [item.live]),
      ).toBe(0);
    }
    expect(
      await sqlState(db.anon.run(INSERT_ITEM, [newId, '{"en": "T"}', 'draft', null, null])),
    ).toBe('42501');
    expect(await sqlState(db.anon.run(`update public.content_items set pinned = true`))).toBe(
      '42501',
    );
  });

  it('content is stored as language variants: English is required, Welsh optional, nothing else', async () => {
    const asErin = db.user(ids.erin);
    const insert = (title: string) => asErin.run(INSERT_ITEM, [newId, title, 'draft', null, null]);
    expect(await sqlState(insert('{"cy": "Dim ond Cymraeg"}'))).toBe('23514');
    expect(await sqlState(insert('{"en": "English", "fr": "Français"}'))).toBe('23514');
    expect(await sqlState(insert('"just a string"'))).toBe('23514');
    expect(await insert('{"en": "English", "cy": "Cymraeg"}')).toBe(1);
  });

  it('every status change is in the audit history, with who made it and no article text', async () => {
    await db
      .user(ids.cleo)
      .run(
        `update public.content_items set status = 'published', publish_at = now(), title = '{"en": "Secret headline"}' where id = $1`,
        [item.draft],
      );
    const entry = await db.user(ids.cleo).one(
      `select actor_id, actor_role, action, changed_columns, before, after
       from public.audit_logs where entity_type = 'content_items' and entity_id = $1 order by id desc limit 1`,
      [item.draft],
    );
    expect(entry).toMatchObject({
      actor_id: ids.cleo,
      actor_role: 'club_admin',
      action: 'content_items.update',
      before: { status: 'draft', publish_at: null },
    });
    expect((entry.after as { status: string }).status).toBe('published');
    // The title changed, and the history says so by name only.
    expect(entry.changed_columns).toContain('title');
    expect(JSON.stringify(entry)).not.toContain('Secret headline');
  });
});

describe('Fan Zone activities follow the same editorial rules', () => {
  const activity = '00000000-0000-4000-8000-0000000c00bb';
  const INSERT_ACTIVITY = `
    insert into public.activity_definitions (id, kind, title, prompt, opens_at, closes_at, config, status)
    values ($1, 'poll', '{"en": "Poll"}', '{"en": "Who?"}', now() - interval '1 hour', now() + interval '1 hour',
            '{"options": [{"id": "a"}, {"id": "b"}]}', $2)`;

  it('an editor drafts, cannot approve, and a draft is invisible to supporters', async () => {
    const asErin = db.user(ids.erin);
    expect(await sqlState(asErin.run(INSERT_ACTIVITY, [activity, 'approved']))).toBe('42501');
    expect(await asErin.run(INSERT_ACTIVITY, [activity, 'draft'])).toBe(1);
    expect(
      await sqlState(
        asErin.run(`update public.activity_definitions set status = 'approved' where id = $1`, [
          activity,
        ]),
      ),
    ).toBe('42501');
    expect(
      await db
        .user(ids.alice)
        .rows(`select 1 from public.activity_definitions where id = $1`, [activity]),
    ).toEqual([]);
    expect(
      await db.anon.rows(`select 1 from public.activity_definitions where id = $1`, [activity]),
    ).toEqual([]);
  });

  it('a club_admin approves, and then everyone can see it', async () => {
    await db.user(ids.erin).run(INSERT_ACTIVITY, [activity, 'draft']);
    expect(
      await db
        .user(ids.cleo)
        .run(`update public.activity_definitions set status = 'approved' where id = $1`, [
          activity,
        ]),
    ).toBe(1);
    expect(
      await db.anon.rows(`select 1 from public.activity_definitions where id = $1`, [activity]),
    ).toHaveLength(1);
  });
});
