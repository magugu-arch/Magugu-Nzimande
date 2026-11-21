import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TestDatabase, ids, seedCast, sqlState } from './harness';

let db: TestDatabase;

const campaign = {
  acmeDraft: '00000000-0000-4000-8000-0000000d0001',
  borthDraft: '00000000-0000-4000-8000-0000000d0002',
  acmeRunning: '00000000-0000-4000-8000-0000000d0003', // approved, on 'home', running now
} as const;
const fresh = '00000000-0000-4000-8000-0000000d00aa';
const fresh2 = '00000000-0000-4000-8000-0000000d00ab';

/** Inserts a campaign. Dates are offsets in days from now. */
const insertCampaign = (
  session: ReturnType<TestDatabase['user']>,
  c: {
    id: string;
    partner: string;
    placement?: string;
    status?: string;
    from?: number;
    to?: number;
  },
) =>
  session.run(
    `insert into public.partner_campaigns (id, partner_id, label, placement, title, body, starts_at, ends_at, status)
     values ($1, $2, 'partner_feature', $3, '{"en": "Title"}', '{"en": "Body"}',
             now() + make_interval(days => $4), now() + make_interval(days => $5), $6)`,
    [c.id, c.partner, c.placement ?? 'home', c.from ?? -1, c.to ?? 30, c.status ?? 'draft'],
  );

beforeAll(async () => {
  db = await TestDatabase.create();
  await seedCast(db);
  await insertCampaign(db.superuser, {
    id: campaign.acmeDraft,
    partner: ids.acme,
    placement: 'passport',
  });
  await insertCampaign(db.superuser, {
    id: campaign.borthDraft,
    partner: ids.borth,
    placement: 'passport',
  });
  await insertCampaign(db.superuser, {
    id: campaign.acmeRunning,
    partner: ids.acme,
    status: 'approved',
  });
});

afterAll(async () => {
  await db.close();
});

beforeEach(() => db.begin());
afterEach(() => db.rollback());

describe('a partner_admin works only on their own partner’s campaigns', () => {
  it('sees their own partner’s campaigns in every state, and no other partner’s drafts', async () => {
    const seen = await db
      .user(ids.pat)
      .rows<{ id: string }>(`select id from public.partner_campaigns order by id`);
    expect(seen.map((r) => r.id)).toEqual([campaign.acmeDraft, campaign.acmeRunning]);
    const quinn = await db
      .user(ids.quinn)
      .rows<{ id: string }>(`select id from public.partner_campaigns order by id`);
    // Quinn (Borth) sees Borth's draft, plus Acme's campaign only because it is public.
    expect(quinn.map((r) => r.id)).toEqual([campaign.borthDraft, campaign.acmeRunning]);
  });

  it('can create and edit a campaign for their own partner', async () => {
    const asPat = db.user(ids.pat);
    expect(
      await insertCampaign(asPat, { id: fresh, partner: ids.acme, placement: 'fan_zone' }),
    ).toBe(1);
    expect(
      await asPat.run(
        `update public.partner_campaigns set title = '{"en": "Edited"}', status = 'submitted' where id = $1`,
        [fresh],
      ),
    ).toBe(1);
    expect(
      await asPat.run(`update public.partner_campaigns set priority = 5 where id = $1`, [
        campaign.acmeDraft,
      ]),
    ).toBe(1);
  });

  it('cannot edit or delete another partner’s campaign', async () => {
    const asPat = db.user(ids.pat);
    expect(
      await asPat.run(
        `update public.partner_campaigns set title = '{"en": "Hijacked"}' where id = $1`,
        [campaign.borthDraft],
      ),
    ).toBe(0);
    expect(
      await asPat.run(`delete from public.partner_campaigns where id = $1`, [campaign.borthDraft]),
    ).toBe(0);
    expect(
      await db.superuser.one(
        `select title ->> 'en' as title from public.partner_campaigns where id = $1`,
        [campaign.borthDraft],
      ),
    ).toEqual({
      title: 'Title',
    });
  });

  it('cannot create a campaign for another partner, or move their own campaign to one', async () => {
    const asPat = db.user(ids.pat);
    expect(await sqlState(insertCampaign(asPat, { id: fresh, partner: ids.borth }))).toBe('42501');
    expect(
      await sqlState(
        asPat.run(`update public.partner_campaigns set partner_id = $2 where id = $1`, [
          campaign.acmeDraft,
          ids.borth,
        ]),
      ),
    ).toBe('42501');
  });

  it('cannot approve: not on insert, not by update, and cannot forge the approval stamp', async () => {
    const asPat = db.user(ids.pat);
    expect(
      await sqlState(
        insertCampaign(asPat, {
          id: fresh,
          partner: ids.acme,
          placement: 'matchday',
          status: 'approved',
        }),
      ),
    ).toBe('42501');
    expect(
      await sqlState(
        asPat.run(`update public.partner_campaigns set status = 'approved' where id = $1`, [
          campaign.acmeDraft,
        ]),
      ),
    ).toBe('42501');
    // Setting approved_by / approved_at directly is ignored: the stamp follows the status.
    await asPat.run(
      `update public.partner_campaigns set approved_by = $2, approved_at = now() where id = $1`,
      [campaign.acmeDraft, ids.pat],
    );
    expect(
      await db.superuser.one(
        `select status, approved_by, approved_at from public.partner_campaigns where id = $1`,
        [campaign.acmeDraft],
      ),
    ).toEqual({
      status: 'draft',
      approved_by: null,
      approved_at: null,
    });
  });

  it('cannot change a campaign once it has been approved', async () => {
    const asPat = db.user(ids.pat);
    expect(
      await asPat.run(
        `update public.partner_campaigns set title = '{"en": "Swapped after sign-off"}' where id = $1`,
        [campaign.acmeRunning],
      ),
    ).toBe(0);
    expect(
      await asPat.run(
        `update public.partner_campaigns set ends_at = ends_at + interval '1 year' where id = $1`,
        [campaign.acmeRunning],
      ),
    ).toBe(0);
    expect(
      await asPat.run(`delete from public.partner_campaigns where id = $1`, [campaign.acmeRunning]),
    ).toBe(0);
  });

  it('cannot edit the partner record itself (its `approved` flag belongs to the club)', async () => {
    expect(
      await db
        .user(ids.pat)
        .run(`update public.partners set approved = true, name = 'Acme Plus' where id = $1`, [
          ids.acme,
        ]),
    ).toBe(0);
  });

  it('the same rules hold for offers', async () => {
    const asPat = db.user(ids.pat);
    const insertOffer = (partner: string, status: string) =>
      asPat.run(
        `insert into public.offers (id, partner_id, placement, title, starts_at, ends_at, status, destination_url)
         values ($1, $2, 'partner_world', '{"en": "Offer"}', now(), now() + interval '7 days', $3, 'https://partner.example/offer')`,
        [fresh, partner, status],
      );
    expect(await sqlState(insertOffer(ids.borth, 'draft'))).toBe('42501');
    expect(await sqlState(insertOffer(ids.acme, 'approved'))).toBe('42501');
    expect(await insertOffer(ids.acme, 'draft')).toBe(1);
    expect(
      await sqlState(
        asPat.run(`update public.offers set status = 'approved' where id = $1`, [fresh]),
      ),
    ).toBe('42501');
    expect(
      await db.user(ids.quinn).rows(`select 1 from public.offers where id = $1`, [fresh]),
    ).toEqual([]);
  });
});

describe('approval belongs to the club', () => {
  it('a club_admin approves, and the approval is stamped with who and when', async () => {
    const approved = await db.user(ids.cleo).one(
      `update public.partner_campaigns set status = 'approved' where id = $1
       returning status, approved_by, approved_at is not null as stamped`,
      [campaign.acmeDraft],
    );
    expect(approved).toEqual({ status: 'approved', approved_by: ids.cleo, stamped: true });
  });

  it('an editor (campaigns.read) can see every campaign but change none', async () => {
    const asErin = db.user(ids.erin);
    expect(await asErin.rows(`select 1 from public.partner_campaigns`)).toHaveLength(3);
    expect(await asErin.run(`update public.partner_campaigns set priority = 9`)).toBe(0);
    expect(await sqlState(insertCampaign(asErin, { id: fresh, partner: ids.acme }))).toBe('42501');
  });

  it('a supporter and a visitor see only approved campaigns inside their dates', async () => {
    await insertCampaign(db.superuser, {
      id: fresh,
      partner: ids.borth,
      placement: 'matchday',
      status: 'approved',
      from: 5,
      to: 10,
    });
    await insertCampaign(db.superuser, {
      id: fresh2,
      partner: ids.borth,
      placement: 'fan_zone',
      status: 'approved',
      from: -10,
      to: -5,
    });
    for (const session of [db.anon, db.user(ids.alice)]) {
      const seen = await session.rows<{ id: string }>(`select id from public.partner_campaigns`);
      expect(seen.map((r) => r.id)).toEqual([campaign.acmeRunning]);
    }
    expect(
      await sqlState(db.user(ids.alice).run(`update public.partner_campaigns set priority = 1`)),
    ).toBe('ok');
    expect(await db.user(ids.alice).run(`update public.partner_campaigns set priority = 1`)).toBe(
      0,
    );
    expect(await sqlState(db.anon.run(`update public.partner_campaigns set priority = 1`))).toBe(
      '42501',
    );
  });

  it('every commercial placement carries a label and an https destination', async () => {
    expect(
      await sqlState(
        db.superuser.run(
          `insert into public.partner_campaigns (partner_id, label, placement, title, body, starts_at, ends_at)
           values ($1, null, 'home', '{"en": "T"}', '{"en": "B"}', now(), now() + interval '1 day')`,
          [ids.acme],
        ),
      ),
    ).toBe('23502');
    expect(
      await sqlState(
        db.superuser.run(
          `update public.partner_campaigns set cta = '{"url": "javascript:alert(1)"}' where id = $1`,
          [campaign.acmeDraft],
        ),
      ),
    ).toBe('23514');
  });
});

describe('at most one approved campaign per placement at a time', () => {
  // campaign.acmeRunning is approved on 'home' from yesterday for 30 days.

  it('a second approved campaign overlapping it on the same placement is rejected', async () => {
    expect(
      await sqlState(
        insertCampaign(db.user(ids.cleo), {
          id: fresh,
          partner: ids.borth,
          status: 'approved',
          from: 10,
          to: 40,
        }),
      ),
    ).toBe('23P01');
  });

  it('approving an overlapping draft is rejected too, even for the service role', async () => {
    await insertCampaign(db.superuser, {
      id: fresh,
      partner: ids.borth,
      status: 'submitted',
      from: 10,
      to: 40,
    });
    expect(
      await sqlState(
        db
          .user(ids.cleo)
          .run(`update public.partner_campaigns set status = 'approved' where id = $1`, [fresh]),
      ),
    ).toBe('23P01');
    expect(
      await sqlState(
        db.service.run(`update public.partner_campaigns set status = 'approved' where id = $1`, [
          fresh,
        ]),
      ),
    ).toBe('23P01');
    expect(
      await sqlState(
        db.superuser.run(`update public.partner_campaigns set status = 'approved' where id = $1`, [
          fresh,
        ]),
      ),
    ).toBe('23P01');
  });

  it('moving an approved campaign’s dates into another’s window is rejected', async () => {
    await insertCampaign(db.superuser, {
      id: fresh,
      partner: ids.borth,
      status: 'approved',
      from: 30,
      to: 60,
    });
    expect(
      await sqlState(
        db
          .user(ids.cleo)
          .run(
            `update public.partner_campaigns set starts_at = now() + interval '20 days' where id = $1`,
            [fresh],
          ),
      ),
    ).toBe('23P01');
  });

  it('campaigns that are not approved may overlap freely while they wait', async () => {
    const asCleo = db.user(ids.cleo);
    expect(
      await insertCampaign(asCleo, {
        id: fresh,
        partner: ids.borth,
        status: 'submitted',
        from: 0,
        to: 20,
      }),
    ).toBe(1);
    expect(
      await insertCampaign(asCleo, {
        id: fresh2,
        partner: ids.acme,
        status: 'draft',
        from: 0,
        to: 20,
      }),
    ).toBe(1);
  });

  it('an approved campaign on a different placement, or straight after on the same one, is fine', async () => {
    const asCleo = db.user(ids.cleo);
    expect(
      await insertCampaign(asCleo, {
        id: fresh,
        partner: ids.borth,
        placement: 'match_centre',
        status: 'approved',
        from: 0,
        to: 20,
      }),
    ).toBe(1);
    // Back to back: the first ends exactly when the second starts.
    const { ends_at: endsAt } = await db.superuser.one<{ ends_at: string }>(
      `select ends_at from public.partner_campaigns where id = $1`,
      [campaign.acmeRunning],
    );
    expect(
      await asCleo.run(
        `insert into public.partner_campaigns (id, partner_id, label, placement, title, body, starts_at, ends_at, status)
         values ($1, $2, 'sponsored', 'home', '{"en": "Next"}', '{"en": "Body"}', $3, $3::timestamptz + interval '7 days', 'approved')`,
        [fresh2, ids.borth, endsAt],
      ),
    ).toBe(1);
  });

  it('so there is never more than one approved campaign running on a placement', async () => {
    const asCleo = db.user(ids.cleo);
    await sqlState(
      insertCampaign(asCleo, {
        id: fresh,
        partner: ids.borth,
        status: 'approved',
        from: -5,
        to: 5,
      }),
    );
    await insertCampaign(asCleo, {
      id: fresh2,
      partner: ids.borth,
      placement: 'passport',
      status: 'approved',
      from: -5,
      to: 5,
    });
    const running = await db.anon.rows(
      `select placement, count(*)::int as n from public.partner_campaigns group by placement order by placement`,
    );
    expect(running).toEqual([
      { placement: 'home', n: 1 },
      { placement: 'passport', n: 1 },
    ]);
  });
});

describe('offers are shown only to the audience they are for', () => {
  const offer = {
    everyone: '00000000-0000-4000-8000-0000000d0101',
    signedIn: '00000000-0000-4000-8000-0000000d0102',
    members: '00000000-0000-4000-8000-0000000d0103',
  };

  beforeEach(async () => {
    for (const [id, eligibility] of [
      [offer.everyone, 'everyone'],
      [offer.signedIn, 'signed_in'],
      [offer.members, 'members'],
    ] as const) {
      await db.superuser.run(
        `insert into public.offers (id, partner_id, placement, title, eligibility, starts_at, ends_at, status)
         values ($1, $2, 'partner_world', '{"en": "Offer"}', $3, now() - interval '1 day', now() + interval '1 day', 'approved')`,
        [id, ids.acme, eligibility],
      );
    }
  });

  const seenBy = async (session: ReturnType<TestDatabase['user']>) =>
    (await session.rows<{ id: string }>(`select id from public.offers order by id`)).map(
      (r) => r.id,
    );

  it('a visitor sees offers for everyone; a signed-in supporter also sees signed-in offers', async () => {
    expect(await seenBy(db.anon)).toEqual([offer.everyone]);
    expect(await seenBy(db.user(ids.alice))).toEqual([offer.everyone, offer.signedIn]);
  });

  it('a member-only offer appears once the membership system has confirmed the member', async () => {
    await db.service.run(
      `insert into public.memberships (user_id, club_member_token, eligibility_status, source_system)
       values ($1, 'verified-token-0002', 'pending_verification', 'demo-membership')`,
      [ids.alice],
    );
    expect(await seenBy(db.user(ids.alice))).not.toContain(offer.members);
    await db.service.run(
      `update public.memberships set eligibility_status = 'eligible' where user_id = $1`,
      [ids.alice],
    );
    expect(await seenBy(db.user(ids.alice))).toEqual([
      offer.everyone,
      offer.signedIn,
      offer.members,
    ]);
    expect(await seenBy(db.user(ids.bob))).toEqual([offer.everyone, offer.signedIn]);
  });
});
