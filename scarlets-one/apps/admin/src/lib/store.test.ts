import { describe, expect, it } from 'vitest';
import { isCampaignRunning, placement } from '@scarlets/domain';
import { DAY, HOUR, MINUTE } from './time';
import { SCORE_REFUSAL } from './fixture-rules';
import { REJECT_NEEDS_REASON } from './moderation-rules';
import { TEST_DEVICE } from './seed';
import {
  actorFor,
  admin,
  editor,
  expectFail,
  expectOk,
  lastAudit,
  moderator,
  partnerAdmin,
  snapshot,
  testStore,
} from './test-helpers';

const DRAFT = 'draft-venue-guide';

const fields = (over: Record<string, string> = {}) => ({
  titleEn: 'Find your way with the venue guide',
  titleCy: 'Dewch o hyd i’ch ffordd gyda chanllaw’r lleoliad',
  summaryEn: 'Entrances, facilities and help points on one map.',
  summaryCy: 'Mynedfeydd, cyfleusterau a mannau cymorth ar un map.',
  bodyEn: 'First paragraph.\n\nSecond paragraph.',
  bodyCy: '',
  translation: 'draft',
  ...over,
});

describe('content publishing workflow', () => {
  it('an editor writes a draft but cannot publish it', () => {
    const { store } = testStore();
    const created = expectOk(
      store.createContent(editor, {
        ...fields(),
        kind: 'feature',
        category: 'matchday',
        mediaId: 'first-visit',
      }),
    );
    expect(created.item.status).toBe('draft');
    expect(lastAudit(store)).toMatchObject({
      action: 'content.create',
      outcome: 'applied',
      entityId: created.item.id,
    });

    const refused = expectFail(store.publishContent(editor, created.item.id, { confirmed: true }));
    expect(refused.code).toBe('forbidden');
    expect(refused.message).toMatch(/^Refused\. Editor cannot publish/);
    expect(store.getContent(created.item.id)?.item.status).toBe('draft');
    expect(lastAudit(store)).toMatchObject({
      action: 'content.publish',
      permission: 'content.publish',
      outcome: 'refused',
      actorRole: 'editor',
    });
  });

  it('an editor cannot schedule, archive, pin or unpublish either', () => {
    const { store } = testStore();
    const attempts = [
      store.schedulePublish(editor, DRAFT, { publishAt: '2026-12-01T09:00:00Z', confirmed: true }),
      store.archiveContent(editor, 'story-red-wall'),
      store.setContentPinned(editor, 'story-red-wall', true),
      store.returnContentToDraft(editor, 'story-red-wall'),
    ];
    for (const attempt of attempts) expect(attempt).toMatchObject({ ok: false, code: 'forbidden' });
    expect(store.getContent(DRAFT)?.item.status).toBe('draft');
    expect(store.getContent('story-red-wall')?.item).toMatchObject({
      status: 'published',
      pinned: false,
    });
  });

  it('an editor can change drafts only: a published item is refused', () => {
    const { store } = testStore();
    const before = snapshot(store);
    const refused = expectFail(
      store.updateContent(editor, 'story-red-wall', fields({ titleEn: 'Changed' })),
    );
    expect(refused.code).toBe('forbidden');
    expect(refused.message).toContain('drafts only');
    expect(snapshot(store)).toBe(before);
    expect(lastAudit(store)).toMatchObject({
      action: 'content.update',
      permission: 'content.publish',
      outcome: 'refused',
    });
  });

  it('publishing needs a person to confirm the preview, then records who approved', () => {
    const { store } = testStore();
    const auditBefore = store.listAudit().length;

    const unconfirmed = expectFail(store.publishContent(admin, DRAFT, {}));
    expect(unconfirmed.code).toBe('invalid');
    expect(store.getContent(DRAFT)?.item.status).toBe('draft');
    // A validation failure changes nothing, so it writes nothing.
    expect(store.listAudit()).toHaveLength(auditBefore);

    const published = expectOk(store.publishContent(admin, DRAFT, { confirmed: true }));
    expect(published.item.status).toBe('published');
    expect(published.approval?.by).toBe(admin.name);
    expect(lastAudit(store)).toMatchObject({
      action: 'content.publish',
      outcome: 'applied',
      actorName: admin.name,
      actorRole: 'club_admin',
      entityId: DRAFT,
      before: 'status: draft',
    });
    expect(lastAudit(store).after).toContain('status: published');
    expect(expectFail(store.publishContent(admin, DRAFT, { confirmed: true })).code).toBe(
      'conflict',
    );
  });

  it('never lets the service role stand in for the human approver', () => {
    const { store } = testStore();
    const refused = expectFail(
      store.publishContent(actorFor('service'), DRAFT, { confirmed: true }),
    );
    expect(refused.code).toBe('forbidden');
    expect(store.getContent(DRAFT)?.item.status).toBe('draft');
  });

  it('schedules for a future time and releases it when the time comes', () => {
    const { store, advance } = testStore();
    expect(
      expectFail(
        store.schedulePublish(admin, DRAFT, { publishAt: '2026-11-21T09:00:00Z', confirmed: true }),
      ).message,
    ).toContain('in the future');
    expect(
      expectFail(store.schedulePublish(admin, DRAFT, { publishAt: 'soon', confirmed: true })).code,
    ).toBe('invalid');

    const scheduled = expectOk(
      store.schedulePublish(admin, DRAFT, { publishAt: '2026-11-21T12:00:00Z', confirmed: true }),
    );
    expect(scheduled.item).toMatchObject({
      status: 'scheduled',
      publishAt: '2026-11-21T12:00:00.000Z',
    });

    advance(HOUR);
    expect(store.getContent(DRAFT)?.item.status).toBe('scheduled');

    advance(HOUR + MINUTE);
    expect(store.getContent(DRAFT)?.item.status).toBe('published');
    const release = store.listAudit({ q: 'content.release' })[0];
    expect(release).toMatchObject({
      actorRole: 'service',
      actorName: 'Scheduler',
      entityId: DRAFT,
      outcome: 'applied',
    });
    expect(release?.after).toContain(`approved by ${admin.name}`);
  });

  it('pins only what supporters can see, and unpins on archive', () => {
    const { store } = testStore();
    expect(expectFail(store.setContentPinned(admin, DRAFT, true)).code).toBe('conflict');
    expect(expectOk(store.setContentPinned(admin, 'story-red-wall', true)).item.pinned).toBe(true);
    expect(lastAudit(store).action).toBe('content.pin');
    expect(expectOk(store.setContentPinned(admin, 'story-red-wall', false)).item.pinned).toBe(
      false,
    );
    expect(lastAudit(store).action).toBe('content.unpin');

    store.setContentPinned(admin, 'story-red-wall', true);
    const archived = expectOk(store.archiveContent(admin, 'story-red-wall'));
    expect(archived.item).toMatchObject({ status: 'archived', pinned: false });
    expect(expectOk(store.returnContentToDraft(admin, 'story-red-wall')).item.status).toBe('draft');
  });

  it('keeps Welsh status honest', () => {
    const { store } = testStore();
    // No Welsh title: saved as missing, whatever was asked for.
    const missing = expectOk(
      store.updateContent(editor, DRAFT, fields({ titleCy: '', translation: 'approved' })),
    );
    expect(missing.item.translation).toBe('missing');
    expect(missing.item.title).toEqual({ en: 'Find your way with the venue guide' });

    // Welsh present: an editor can save it as a draft translation, not sign it off.
    expect(expectOk(store.updateContent(editor, DRAFT, fields())).item.translation).toBe('draft');
    const selfApproved = expectFail(
      store.updateContent(editor, DRAFT, fields({ translation: 'approved' })),
    );
    expect(selfApproved.code).toBe('forbidden');
    expect(lastAudit(store)).toMatchObject({ outcome: 'refused', permission: 'content.publish' });

    // A club admin signs it off; an editor changing the Welsh afterwards cannot keep the approval.
    expect(
      expectOk(store.updateContent(admin, DRAFT, fields({ translation: 'approved' }))).item
        .translation,
    ).toBe('approved');
    expect(
      expectFail(
        store.updateContent(
          editor,
          DRAFT,
          fields({ summaryCy: 'Newid.', translation: 'approved' }),
        ),
      ).code,
    ).toBe('forbidden');
    expect(
      expectOk(
        store.updateContent(editor, DRAFT, fields({ summaryCy: 'Newid.', translation: 'draft' })),
      ).item.translation,
    ).toBe('draft');
  });

  it('matches Welsh body paragraphs to English ones, or refuses', () => {
    const { store } = testStore();
    const uneven = expectFail(
      store.updateContent(editor, DRAFT, fields({ bodyCy: 'Un paragraff.' })),
    );
    expect(uneven.code).toBe('invalid');
    const saved = expectOk(
      store.updateContent(editor, DRAFT, fields({ bodyCy: 'Paragraff un.\n\nParagraff dau.' })),
    );
    expect(saved.item.body).toEqual([
      { en: 'First paragraph.', cy: 'Paragraff un.' },
      { en: 'Second paragraph.', cy: 'Paragraff dau.' },
    ]);
  });

  it('records what changed, before and after', () => {
    const { store } = testStore();
    expectOk(store.updateContent(editor, DRAFT, fields({ titleEn: 'A clearer headline' })));
    const record = lastAudit(store);
    expect(record.before).toContain('title: “Find your way with the venue guide”');
    expect(record.after).toContain('title: “A clearer headline”');
    expect(record.entityLabel).toBe('A clearer headline');
    expect(
      expectFail(store.updateContent(editor, DRAFT, fields({ titleEn: 'A clearer headline' })))
        .message,
    ).toContain('Nothing to save');
  });
});

describe('fixtures: visibility and notices, never a score', () => {
  const FIXTURE = 'fx-example-connacht';

  it('hides and shows a fixture', () => {
    const { store } = testStore();
    expect(expectOk(store.setFixtureVisibility(admin, FIXTURE, false)).visible).toBe(false);
    expect(lastAudit(store)).toMatchObject({
      action: 'fixture.hide',
      before: 'visible to supporters',
      after: 'hidden from supporters',
    });
    expect(expectFail(store.setFixtureVisibility(admin, FIXTURE, false)).code).toBe('conflict');
    expect(expectOk(store.setFixtureVisibility(admin, FIXTURE, true)).visible).toBe(true);
  });

  it('saves an editorial notice in both languages', () => {
    const { store } = testStore();
    const saved = expectOk(
      store.setFixtureNotice(admin, FIXTURE, {
        kind: 'postponed',
        noteEn: 'Postponed. A new date will follow.',
        noteCy: 'Gohiriwyd. Bydd dyddiad newydd yn dilyn.',
      }),
    );
    expect(saved.notice).toEqual({
      kind: 'postponed',
      text: {
        en: 'Postponed. A new date will follow.',
        cy: 'Gohiriwyd. Bydd dyddiad newydd yn dilyn.',
      },
    });
    expect(lastAudit(store)).toMatchObject({ action: 'fixture.notice', before: 'no notice' });
    expect(expectOk(store.clearFixtureNotice(admin, FIXTURE)).notice).toBeNull();
  });

  it.each([
    [
      'a score field',
      { kind: 'information', noteEn: 'Result confirmed.', score: { home: 24, away: 18 } },
    ],
    [
      'separate home and away scores',
      { kind: 'information', noteEn: 'Result confirmed.', homeScore: 24, awayScore: 18 },
    ],
    ['a result field', { kind: 'information', noteEn: 'Result confirmed.', result: '24-18' }],
  ])('refuses %s, even from a club admin', (_label, input) => {
    const { store } = testStore();
    const before = snapshot(store);
    const auditBefore = store.listAudit().length;
    const refused = expectFail(store.setFixtureNotice(admin, FIXTURE, input));
    expect(refused).toMatchObject({ code: 'invalid', message: SCORE_REFUSAL });
    expect(snapshot(store)).toBe(before);
    expect(store.listAudit()).toHaveLength(auditBefore);
  });

  it('refuses a score typed into the note', () => {
    const { store } = testStore();
    for (const noteEn of [
      'Full time: Scarlets 24-18 Demo XV',
      'We won 24 – 18',
      'Won by 6 points',
    ]) {
      const refused = expectFail(
        store.setFixtureNotice(admin, FIXTURE, { kind: 'information', noteEn }),
      );
      expect(refused.code).toBe('invalid');
      expect(refused.message).toContain(SCORE_REFUSAL);
    }
    expect(
      expectFail(
        store.setFixtureNotice(admin, FIXTURE, {
          kind: 'information',
          noteEn: 'Fine',
          noteCy: 'Sgôr 24-18',
        }),
      ).code,
    ).toBe('invalid');
    expect(store.listFixtures().every((record) => record.notice === null)).toBe(true);
  });

  it('refuses any field it does not know', () => {
    const { store } = testStore();
    const refused = expectFail(
      store.setFixtureNotice(admin, FIXTURE, {
        kind: 'information',
        noteEn: 'Fine',
        status: 'full_time',
      }),
    );
    expect(refused.code).toBe('invalid');
  });

  it('allows times and dates in a notice', () => {
    const { store } = testStore();
    expectOk(
      store.setFixtureNotice(admin, FIXTURE, {
        kind: 'time_change',
        noteEn: 'Kick-off moves to 19:35 on 12 December. Gates open 17:30-18:00.',
      }),
    );
  });

  it('holds no score anywhere in the console', () => {
    const { store } = testStore();
    store.setFixtureNotice(admin, FIXTURE, { kind: 'information', noteEn: 'Fine', score: '1-0' });
    const [first] = store.listFixtures();
    // @ts-expect-error A console fixture has no score: that field belongs to the provider.
    expect(first?.fixture.score).toBeUndefined();
    // @ts-expect-error Nor a status.
    expect(first?.fixture.status).toBeUndefined();
    expect(JSON.stringify(store.listFixtures())).not.toMatch(/"score"|"homeScore"|"result"/);
  });
});

describe('campaigns: one running campaign per placement', () => {
  const HOME_DRAFT = 'cmp-draft-home-community';
  const MATCH_CENTRE_DRAFT = 'cmp-draft-match-centre';

  const campaign = (over: Record<string, string> = {}) => ({
    partnerId: 'slot-community',
    label: 'partner_feature',
    placement: 'match_centre',
    titleEn: 'A sample panel',
    titleCy: '',
    bodyEn: 'Sample body.',
    bodyCy: '',
    mediaId: 'stadium-bowl',
    startsAt: '2027-03-01T00:00:00Z',
    endsAt: '2027-04-01T00:00:00Z',
    cta: 'none',
    ...over,
  });

  it('a partner admin drafts; only a club admin approves', () => {
    const { store } = testStore();
    const draft = expectOk(store.createCampaign(partnerAdmin, campaign()));
    expect(draft.status).toBe('draft');
    expect(draft.campaign.terms).toBeNull();

    const refused = expectFail(store.approveCampaign(partnerAdmin, draft.campaign.id));
    expect(refused.code).toBe('forbidden');
    expect(store.getCampaign(draft.campaign.id)?.status).toBe('draft');
    expect(lastAudit(store)).toMatchObject({
      action: 'campaign.approve',
      outcome: 'refused',
      actorRole: 'partner_admin',
    });

    const approved = expectOk(store.approveCampaign(admin, draft.campaign.id));
    expect(approved).toMatchObject({ status: 'approved', approval: { by: admin.name } });
    expect(lastAudit(store)).toMatchObject({
      action: 'campaign.approve',
      outcome: 'applied',
      before: 'status: draft',
    });
  });

  it('refuses to approve a second campaign for a placement that is taken', () => {
    const { store } = testStore();
    const before = snapshot(store);
    const auditBefore = store.listAudit().length;
    const refused = expectFail(store.approveCampaign(admin, HOME_DRAFT));
    expect(refused.code).toBe('conflict');
    expect(refused.message).toContain('Home already has “Beat the lights in the Fan Zone”');
    expect(refused.message).toContain('Only one campaign can run in a placement at a time');
    expect(snapshot(store)).toBe(before);
    expect(store.listAudit()).toHaveLength(auditBefore);
  });

  it('approves when the placement is free, then blocks an overlap', () => {
    const { store } = testStore();
    expectOk(store.approveCampaign(admin, MATCH_CENTRE_DRAFT)); // 1 Dec 2026 to 1 Mar 2027

    const overlapping = expectOk(
      store.createCampaign(partnerAdmin, campaign({ startsAt: '2027-02-15T00:00:00Z' })),
    );
    expect(expectFail(store.approveCampaign(admin, overlapping.campaign.id)).code).toBe('conflict');

    // Back to back is fine: one ends at the instant the next starts.
    const next = expectOk(store.createCampaign(partnerAdmin, campaign()));
    expectOk(store.approveCampaign(admin, next.campaign.id));
  });

  it('frees the placement when a campaign goes back to draft', () => {
    const { store } = testStore();
    expectOk(store.returnCampaignToDraft(admin, 'cmp-home-reaction-wall'));
    expectOk(store.approveCampaign(admin, HOME_DRAFT));
    expect(store.runningCampaigns().home).toBeNull(); // the draft starts on 1 December
    expect(expectFail(store.approveCampaign(admin, 'cmp-home-reaction-wall')).code).toBe(
      'conflict',
    );
  });

  it('never has two approved campaigns running in one placement', () => {
    const { store } = testStore();
    store.approveCampaign(admin, MATCH_CENTRE_DRAFT);
    store.approveCampaign(admin, HOME_DRAFT);
    for (const next of [
      campaign(),
      campaign({ placement: 'home' }),
      campaign({ placement: 'passport', startsAt: '2026-09-01T00:00:00Z' }),
    ]) {
      const created = store.createCampaign(partnerAdmin, next);
      if (created.ok) store.approveCampaign(admin, created.data.campaign.id);
    }
    const approved = store
      .listCampaigns()
      .filter((record) => record.status === 'approved')
      .map((record) => record.campaign);
    for (let day = 0; day < 420; day += 7) {
      const at = new Date(new Date('2026-08-01T12:00:00Z').getTime() + day * DAY);
      for (const where of placement.options) {
        const running = approved.filter((c) => c.placement === where && isCampaignRunning(c, at));
        expect(running.length, `${where} on ${at.toISOString()}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps an approved campaign from being edited into a clash, or by a partner admin', () => {
    const { store } = testStore();
    const refused = expectFail(
      store.updateCampaign(partnerAdmin, 'cmp-shop', campaign({ placement: 'partner_world' })),
    );
    expect(refused.code).toBe('forbidden');
    expect(lastAudit(store)).toMatchObject({ permission: 'campaigns.approve', outcome: 'refused' });

    const clash = expectFail(
      store.updateCampaign(
        admin,
        'cmp-shop',
        campaign({
          placement: 'home',
          startsAt: '2026-08-01T00:00:00Z',
          endsAt: '2027-06-30T00:00:00Z',
        }),
      ),
    );
    expect(clash.code).toBe('conflict');
    expect(store.getCampaign('cmp-shop')?.campaign.placement).toBe('partner_world');
  });

  it('accepts only the placeholder partner slots and a visible label', () => {
    const { store } = testStore();
    expect(
      expectFail(store.createCampaign(partnerAdmin, campaign({ partnerId: 'acme-energy' })))
        .message,
    ).toContain('New partners are not created here');
    expect(expectFail(store.createCampaign(partnerAdmin, campaign({ label: '' }))).code).toBe(
      'invalid',
    );
    expect(
      expectFail(store.createCampaign(partnerAdmin, campaign({ endsAt: '2027-02-01T00:00:00Z' })))
        .message,
    ).toContain('end after it starts');
    expect(store.listPartners().every((partner) => partner.approved === false)).toBe(true);
  });
});

describe('moderation: nothing is published until approved', () => {
  it('starts with every Fan Cam photo held', () => {
    const { store } = testStore();
    const fanCam = store.listCases().filter((c) => c.kind === 'fan_cam');
    expect(fanCam.length).toBeGreaterThanOrEqual(4);
    expect(fanCam.every((c) => c.state === 'pending')).toBe(true);
    expect(store.publishedFanCam()).toEqual([]);
  });

  it('reject requires a reason', () => {
    const { store } = testStore();
    const auditBefore = store.listAudit().length;
    for (const reason of [undefined, '', '   ', 'no']) {
      const refused = expectFail(
        store.decideCase(moderator, 'mod-fancam-02', { decision: 'reject', reason }),
      );
      expect(refused).toMatchObject({ code: 'invalid', message: REJECT_NEEDS_REASON });
    }
    expect(store.listCases().find((c) => c.id === 'mod-fancam-02')?.state).toBe('pending');
    expect(store.listAudit()).toHaveLength(auditBefore);

    const rejected = expectOk(
      store.decideCase(moderator, 'mod-fancam-02', {
        decision: 'reject',
        reason: 'Offensive banner in shot',
      }),
    );
    expect(rejected).toMatchObject({
      state: 'rejected',
      decision: { by: moderator.name, reason: 'Offensive banner in shot' },
    });
    expect(lastAudit(store)).toMatchObject({
      action: 'moderation.reject',
      outcome: 'applied',
      actorRole: 'moderator',
    });
    expect(lastAudit(store).after).toContain('Offensive banner in shot');
    expect(store.publishedFanCam()).toEqual([]);
  });

  it('approve publishes exactly that photo', () => {
    const { store } = testStore();
    expectOk(store.decideCase(moderator, 'mod-fancam-01', { decision: 'approve' }));
    expect(store.publishedFanCam().map((c) => c.id)).toEqual(['mod-fancam-01']);
    expect(lastAudit(store)).toMatchObject({
      action: 'moderation.approve',
      before: 'pending: not visible to supporters',
    });
    expect(
      expectFail(
        store.decideCase(moderator, 'mod-fancam-01', {
          decision: 'reject',
          reason: 'Changed my mind',
        }),
      ).code,
    ).toBe('conflict');
  });

  it('escalate takes the case to safeguarding and keeps it hidden', () => {
    const { store } = testStore();
    const escalated = expectOk(
      store.decideCase(moderator, 'mod-fancam-03', { decision: 'escalate' }),
    );
    expect(escalated.state).toBe('escalated');
    expect(store.publishedFanCam()).toEqual([]);
    expect(lastAudit(store).action).toBe('moderation.escalate');
    expect(expectFail(store.reopenCase(moderator, 'mod-fancam-03')).message).toContain(
      'safeguarding lead',
    );
  });

  it('a privacy report holds the story until a moderator decides', () => {
    const { store } = testStore();
    const story = (id: string) => store.listStories().find((s) => s.id === id)?.moderation;
    expect(story('ss-meeting')).toBe('pending'); // privacy: held on report
    expect(story('ss-screen')).toBe('approved'); // spam: stays up until reviewed

    expectOk(
      store.decideCase(moderator, 'mod-story-01', {
        decision: 'reject',
        reason: 'Removed at the request of a person pictured',
      }),
    );
    expect(story('ss-meeting')).toBe('rejected');
    expectOk(store.decideCase(moderator, 'mod-story-02', { decision: 'approve' }));
    expect(story('ss-screen')).toBe('approved');
  });

  it('reopening hides the photo again', () => {
    const { store } = testStore();
    store.decideCase(moderator, 'mod-fancam-01', { decision: 'approve' });
    expectOk(store.reopenCase(moderator, 'mod-fancam-01'));
    expect(store.publishedFanCam()).toEqual([]);
    expect(lastAudit(store).action).toBe('moderation.reopen');
  });

  it('an editor cannot moderate', () => {
    const { store } = testStore();
    expect(
      expectFail(store.decideCase(editor, 'mod-fancam-01', { decision: 'approve' })).code,
    ).toBe('forbidden');
    expect(store.publishedFanCam()).toEqual([]);
  });
});

describe('notifications: consent, frequency cap and the test flow', () => {
  const push = (over: Record<string, string> = {}) => ({
    titleEn: 'Sample push',
    titleCy: '',
    bodyEn: 'Sample message.',
    bodyCy: '',
    segment: 'season_members',
    category: 'marketing',
    sendAt: '2026-11-22T12:00:00Z',
    ...over,
  });

  it('marketing reaches only people who gave marketing consent', () => {
    const { store } = testStore();
    const segment = store.listSegments().find((s) => s.id === 'following_first_team');
    expect(segment).toMatchObject({ pushEnabled: 1000, marketingConsent: 400 });

    const marketing = expectOk(
      store.scheduleNotification(admin, push({ segment: 'following_first_team' })),
    );
    expect(marketing.recipients).toBe(400);
    expect(lastAudit(store).after).toContain('reaches 400 of 1000');

    const service = expectOk(
      store.scheduleNotification(
        admin,
        push({ segment: 'following_first_team', category: 'service' }),
      ),
    );
    expect(service.recipients).toBe(1000);
  });

  it('caps marketing at two per segment in any seven days', () => {
    const { store } = testStore();
    // Seeded for season members: one sent on 18 Nov, one scheduled for 23 Nov.
    const before = snapshot(store);
    const auditBefore = store.listAudit().length;
    const capped = expectFail(
      store.scheduleNotification(admin, push({ sendAt: '2026-11-22T12:00:00Z' })),
    );
    expect(capped.code).toBe('conflict');
    expect(capped.message).toContain('Frequency cap reached');
    expect(capped.message).toContain('at most 2 marketing pushes in any 7 days');
    expect(snapshot(store)).toBe(before);
    expect(store.listAudit()).toHaveLength(auditBefore);

    // 26 Nov is more than seven days after the 18th, so only the 23rd shares its window.
    expectOk(store.scheduleNotification(admin, push({ sendAt: '2026-11-26T12:00:00Z' })));
    expect(
      expectFail(store.scheduleNotification(admin, push({ sendAt: '2026-11-27T12:00:00Z' }))).code,
    ).toBe('conflict');
    // Exactly seven days after the 23rd is a new window.
    expectOk(store.scheduleNotification(admin, push({ sendAt: '2026-11-30T12:00:00Z' })));
  });

  it('counts each segment and category separately, and ignores cancelled pushes', () => {
    const { store } = testStore();
    expectOk(store.scheduleNotification(admin, push({ segment: 'matchday_attendees' })));
    expectOk(store.scheduleNotification(admin, push({ category: 'service' })));

    expectOk(store.cancelNotification(admin, 'ntf-seed-02'));
    expect(lastAudit(store).action).toBe('notification.cancel');
    expectOk(store.scheduleNotification(admin, push()));
  });

  it('caps service messages too, at four in 24 hours', () => {
    const { store } = testStore();
    for (const hour of ['09', '10', '11', '12']) {
      expectOk(
        store.scheduleNotification(
          admin,
          push({ category: 'service', sendAt: `2026-11-25T${hour}:00:00Z` }),
        ),
      );
    }
    const fifth = expectFail(
      store.scheduleNotification(
        admin,
        push({ category: 'service', sendAt: '2026-11-25T13:00:00Z' }),
      ),
    );
    expect(fifth.message).toContain('at most 4 service pushes in any 24 hours');
  });

  it('refuses a send time in the past and incomplete content', () => {
    const { store } = testStore();
    expect(
      expectFail(store.scheduleNotification(admin, push({ sendAt: '2026-11-20T12:00:00Z' })))
        .message,
    ).toContain('in the future');
    expect(expectFail(store.scheduleNotification(admin, push({ titleEn: ' ' }))).code).toBe(
      'invalid',
    );
    expect(expectFail(store.scheduleNotification(admin, push({ segment: 'everyone' }))).code).toBe(
      'invalid',
    );
    expect(expectFail(store.scheduleNotification(admin, push({ category: 'urgent' }))).code).toBe(
      'invalid',
    );
  });

  it('send test records a simulated delivery to the test device and reaches no supporter', () => {
    const { store } = testStore();
    const pushesBefore = JSON.stringify(store.listNotifications());

    const delivery = expectOk(store.sendTestNotification(admin, { notificationId: 'ntf-seed-03' }));
    expect(delivery).toMatchObject({
      notificationId: 'ntf-seed-03',
      device: TEST_DEVICE,
      status: 'delivered_simulated',
      sentBy: admin.name,
      category: 'service',
      en: { title: 'Demo: matchday information' },
      cy: { title: 'Demo: gwybodaeth diwrnod gêm', fallback: true },
    });
    expect(store.listTests()).toHaveLength(1);
    expect(JSON.stringify(store.listNotifications())).toBe(pushesBefore);
    expect(lastAudit(store)).toMatchObject({
      action: 'notification.test',
      outcome: 'applied',
      entityId: delivery.id,
    });
    expect(lastAudit(store).after).toContain(TEST_DEVICE);
  });

  it('sends a test straight from the compose form without scheduling anything', () => {
    const { store } = testStore();
    const pushesBefore = store.listNotifications().length;
    const delivery = expectOk(
      store.sendTestNotification(admin, {
        draft: push({ titleCy: 'Hysbysiad enghreifftiol', bodyCy: 'Neges enghreifftiol.' }),
      }),
    );
    expect(delivery.notificationId).toBeNull();
    expect(delivery.cy).toEqual({
      title: 'Hysbysiad enghreifftiol',
      body: 'Neges enghreifftiol.',
      fallback: false,
    });
    expect(store.listNotifications()).toHaveLength(pushesBefore);
    // Tests do not count towards the cap: the segment is already at two marketing pushes.
    expectOk(store.sendTestNotification(admin, { draft: push() }));
    expect(
      expectFail(store.sendTestNotification(admin, { draft: push({ bodyEn: '' }) })).code,
    ).toBe('invalid');
    expect(expectFail(store.sendTestNotification(moderator, { draft: push() })).code).toBe(
      'forbidden',
    );
  });

  it('sends what is due, as the scheduler, and says who scheduled it', () => {
    const { store, advance } = testStore();
    advance(3 * DAY);
    const sent = store.listNotifications().find((n) => n.id === 'ntf-seed-02');
    expect(sent?.status).toBe('sent');
    const record = store.listAudit({ q: 'notification.send' })[0];
    expect(record).toMatchObject({ actorRole: 'service', entityId: 'ntf-seed-02' });
    expect(record?.after).toContain('scheduled by Demo Club Admin');
    expect(expectFail(store.cancelNotification(admin, 'ntf-seed-02')).code).toBe('conflict');
  });
});

describe('roles and demo sign-in', () => {
  const clubAdmin = { id: 'u-club-admin', name: 'Demo Club Admin', role: 'club_admin' } as const;

  it('a club admin changes a role, and the log says from what to what', () => {
    const { store } = testStore();
    expect(expectOk(store.changeRole(clubAdmin, 'u-editor', 'moderator')).role).toBe('moderator');
    expect(lastAudit(store)).toMatchObject({
      action: 'role.change',
      entityId: 'u-editor',
      entityLabel: 'Demo Editor',
      before: 'role: Editor',
      after: 'role: Moderator',
    });
    expect(expectOk(store.startSession('u-editor')).role).toBe('moderator');
  });

  it('refuses the changes that would break the model', () => {
    const { store } = testStore();
    expect(expectFail(store.changeRole(clubAdmin, 'u-club-admin', 'editor')).message).toContain(
      'your own role',
    );
    expect(expectFail(store.changeRole(clubAdmin, 'u-editor', 'service')).message).toContain(
      'cannot be given to a person',
    );
    expect(expectFail(store.changeRole(clubAdmin, 'u-editor', 'owner')).code).toBe('invalid');
    expect(expectFail(store.changeRole(clubAdmin, 'svc-scheduler', 'editor')).message).toContain(
      'System accounts',
    );
    expect(expectFail(store.changeRole(clubAdmin, 'u-editor', 'editor')).code).toBe('conflict');
    expect(expectFail(store.changeRole(clubAdmin, 'nobody', 'editor')).code).toBe('not_found');
  });

  it('only console roles can sign in', () => {
    const { store } = testStore();
    for (const id of ['u-club-admin', 'u-editor', 'u-moderator', 'u-partner-admin']) {
      expect(store.startSession(id).ok).toBe(true);
    }
    expect(expectFail(store.startSession('svc-scheduler')).message).toContain(
      'Service accounts cannot sign in',
    );
    expect(expectFail(store.startSession('someone-else')).code).toBe('not_found');

    expectOk(store.changeRole(clubAdmin, 'u-moderator', 'supporter'));
    expect(lastAudit(store).after).toBe('role: Supporter (no console access)');
    expect(expectFail(store.startSession('u-moderator')).message).toContain(
      'Supporter accounts cannot sign in',
    );
  });
});

describe('audit log', () => {
  it('starts with the seed record and numbers every record in order', () => {
    const { store } = testStore();
    expect(store.listAudit()).toMatchObject([
      { seq: 1, action: 'store.seed', actorRole: 'service' },
    ]);
    store.setFixtureVisibility(admin, 'fx-u18-demo', false);
    store.decideCase(moderator, 'mod-fancam-01', { decision: 'approve' });
    store.publishContent(editor, DRAFT, { confirmed: true });
    const seqs = store.listAudit().map((record) => record.seq);
    expect(seqs).toEqual([4, 3, 2, 1]);
  });

  it('carries actor, role, action, entity, before, after and time on every record', () => {
    const { store, now } = testStore();
    store.setFixtureVisibility(admin, 'fx-u18-demo', false);
    expect(lastAudit(store)).toEqual({
      seq: 2,
      at: now().toISOString(),
      actorId: admin.id,
      actorName: admin.name,
      actorRole: 'club_admin',
      area: 'fixtures',
      action: 'fixture.hide',
      permission: 'fixtures.override',
      entityType: 'fixture',
      entityId: 'fx-u18-demo',
      entityLabel: 'Scarlets U18 v Demo U18 XV',
      before: 'visible to supporters',
      after: 'hidden from supporters',
      outcome: 'applied',
    });
  });

  it('is append-only: nothing a caller does to a copy reaches the log', () => {
    const { store } = testStore();
    store.setFixtureVisibility(admin, 'fx-u18-demo', false);
    const copy = store.listAudit();
    copy[0]!.after = 'tampered';
    copy.length = 0;
    expect(store.listAudit()).toHaveLength(2);
    expect(lastAudit(store).after).toBe('hidden from supporters');
    // The store exposes no way to edit or remove a record.
    const names = Object.getOwnPropertyNames(Object.getPrototypeOf(store));
    expect(names.filter((name) => /audit/i.test(name)).sort()).toEqual([
      'auditActors',
      'listAudit',
    ]);
  });

  it('filters by area, outcome, actor and text', () => {
    const { store } = testStore();
    store.setFixtureVisibility(admin, 'fx-u18-demo', false);
    store.publishContent(editor, DRAFT, { confirmed: true });
    store.publishContent(admin, DRAFT, { confirmed: true });
    expect(store.listAudit({ area: 'content' }).map((r) => r.outcome)).toEqual([
      'applied',
      'refused',
    ]);
    expect(store.listAudit({ outcome: 'refused' })).toHaveLength(1);
    expect(store.listAudit({ actorId: editor.id })).toHaveLength(1);
    expect(store.listAudit({ q: 'venue guide' })).toHaveLength(2);
    expect(store.listAudit({ area: 'roles' })).toEqual([]);
    expect(
      store
        .auditActors()
        .map((a) => a.id)
        .sort(),
    ).toEqual([admin.id, editor.id, 'svc-scheduler'].sort());
  });

  it('counts what the overview shows', () => {
    const { store } = testStore();
    const counts = store.counts();
    expect(counts.content).toMatchObject({ draft: 2, scheduled: 1, review: 1 });
    expect(counts.moderation).toEqual({ pending: 7, escalated: 0 });
    expect(counts.campaigns).toEqual({ draft: 2, approved: 5, running: 5 });
    expect(counts.notifications).toEqual({ scheduled: 2, sent: 1, tests: 0 });
    expect(counts.staff).toBe(6);
  });
});
