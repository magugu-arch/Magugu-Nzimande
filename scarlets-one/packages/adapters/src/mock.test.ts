import { describe, expect, it } from 'vitest';
import {
  campaign,
  campaignFor,
  contentItem,
  fanActivity,
  fixture,
  matchEvent,
  mediaAsset,
  passport,
  scoreFromEvents,
} from '@scarlets/domain';
import {
  EXAMPLE_FIXTURE_ID,
  SIM_FIXTURE_ID,
  activitySeed,
  campaignSeed,
  contentSeed,
  createDemoClock,
  createMockAdapters,
  defaultControls,
  fixtureSeeds,
  mediaSeed,
  memoryStore,
  partnerSeed,
  scenarios,
  simStateAt,
  type Account,
  type DemoControls,
  type ScenarioId,
} from './index';

const guest: Account = { state: 'guest', userId: null, deviceId: 'device-1', member: false };
const supporter: Account = {
  state: 'signed_in',
  userId: 'u1',
  deviceId: 'device-1',
  member: false,
};
const member: Account = { state: 'signed_in', userId: 'u2', deviceId: 'device-1', member: true };

function setup(scenario: ScenarioId, over: Partial<DemoControls> = {}, advanceMs = 0) {
  const controls: DemoControls = { ...defaultControls, scenario, ...over };
  const clock = createDemoClock(scenario, 0, () => advanceMs);
  return createMockAdapters({
    controls: () => controls,
    clock: () => clock.now(),
    store: memoryStore(),
  });
}

describe('demo clock', () => {
  it('starts at the scenario moment and then runs forward in real time', () => {
    const clock = createDemoClock('pre_match', 1_000, () => 61_000);
    expect(clock.now().toISOString()).toBe('2026-11-21T10:01:00.000Z');
    expect(
      createDemoClock('live', 5, () => 5)
        .now()
        .toISOString(),
    ).toBe(scenarios.live.startsAt.replace('Z', '.000Z'));
  });
});

describe('seed data', () => {
  it('validates against the domain schemas', () => {
    for (const item of contentSeed) expect(contentItem.safeParse(item).success).toBe(true);
    for (const item of activitySeed) expect(fanActivity.safeParse(item).success).toBe(true);
    for (const item of campaignSeed) expect(campaign.safeParse(item).success).toBe(true);
    for (const item of mediaSeed) expect(mediaAsset.safeParse(item).success).toBe(true);
  });

  it('carries all 39 supplied visuals, each marked as concept material', () => {
    expect(mediaSeed).toHaveLength(39);
    expect(mediaSeed.map((m) => m.number)).toEqual(Array.from({ length: 39 }, (_, i) => i + 1));
    expect(mediaSeed.filter((m) => m.kind === 'identity').map((m) => m.id)).toEqual([
      'crest',
      'shirt-reference',
    ]);
    expect(mediaSeed.every((m) => m.concept === true && m.alt.en.length > 20)).toBe(true);
  });

  it('references only media that exists', () => {
    const ids = new Set(mediaSeed.map((m) => m.id));
    for (const item of contentSeed) expect(ids.has(item.mediaId), item.id).toBe(true);
    for (const item of campaignSeed) expect(ids.has(item.mediaId), item.id).toBe(true);
  });

  it('invents no sponsor: every partner is an unapproved, clearly named slot', () => {
    expect(partnerSeed.every((p) => !p.approved && /slot/i.test(p.name))).toBe(true);
  });

  it('never has two campaigns competing for one placement', () => {
    const now = new Date('2026-11-21T10:00:00Z');
    for (const placement of [
      'home',
      'match_centre',
      'matchday',
      'passport',
      'fan_zone',
      'partner_world',
    ] as const) {
      const running = campaignSeed.filter((c) => c.placement === placement);
      expect(running.length).toBeLessThanOrEqual(1);
      if (running.length)
        expect(campaignFor(placement, campaignSeed, now)?.id).toBe(running[0]?.id);
    }
  });

  it('uses a plainly synthetic opponent for every fixture except the brief’s example', () => {
    for (const seed of fixtureSeeds) {
      const other = seed.home.isScarlets ? seed.away : seed.home;
      if (seed.id === EXAMPLE_FIXTURE_ID) continue;
      expect(other.name, seed.id).toMatch(/demo|sample/i);
    }
  });
});

describe('fixtures', () => {
  it('lists the example fixture as scheduled with no score two weeks out', async () => {
    const { fixtures } = setup('pre_match');
    const { data, meta } = await fixtures.listFixtures({});
    expect(meta).toMatchObject({ status: 'current', demo: true });
    for (const f of data ?? []) expect(fixture.safeParse(f).success).toBe(true);
    const example = data?.find((f) => f.id === EXAMPLE_FIXTURE_ID);
    expect(example).toMatchObject({
      status: 'scheduled',
      score: null,
      kickoffUtc: '2026-12-05T17:00:00Z',
    });
    expect(data?.find((f) => f.id === SIM_FIXTURE_ID)).toMatchObject({
      status: 'full_time',
      score: { home: 25, away: 20 },
    });
  });

  it('filters by squad', async () => {
    const { fixtures } = setup('pre_match');
    const women = await fixtures.listFixtures({ squad: 'women' });
    expect(women.data?.every((f) => f.squad === 'women')).toBe(true);
    expect(women.data?.length).toBeGreaterThan(0);
  });

  it('has no upcoming fixture out of season', async () => {
    const { fixtures } = setup('off_season');
    const { data } = await fixtures.listFixtures({});
    expect(data?.every((f) => f.status === 'full_time')).toBe(true);
  });

  it('refuses to produce a league table without a licensed feed', async () => {
    const { fixtures } = setup('pre_match');
    const table = await fixtures.getTable('first_team');
    expect(table.data).toBeNull();
    expect(table.meta.status).toBe('unavailable');
    expect(table.meta.notice?.en).toMatch(/licensed/);
  });
});

describe('live match', () => {
  it('reveals events as the simulated match runs', async () => {
    expect(simStateAt(new Date('2026-11-14T14:59:00Z'))).toMatchObject({
      status: 'scheduled',
      score: null,
    });
    expect(simStateAt(new Date('2026-11-14T15:27:10Z'))).toMatchObject({
      status: 'live',
      score: { home: 12, away: 3 },
    });
    expect(simStateAt(new Date('2026-11-14T15:46:00Z'))).toMatchObject({
      status: 'half_time',
      score: { home: 15, away: 10 },
    });
    expect(simStateAt(new Date('2026-11-14T16:40:00Z'))).toMatchObject({
      status: 'full_time',
      score: { home: 25, away: 20 },
    });
  });

  it('shows the corrected try scorer once the revision arrives', async () => {
    const before = simStateAt(new Date('2026-11-14T15:23:30Z'));
    const after = simStateAt(new Date('2026-11-14T15:25:30Z'));
    const scorer = (events: typeof before.events) =>
      events
        .filter((e) => e.providerEventId.endsWith(':t2'))
        .sort((a, b) => b.revision - a.revision)[0]?.shirtNumber;
    expect(scorer(before.events)).toBe(7);
    expect(scorer(after.events)).toBe(8);
    // The correction changes who scored, not the score.
    expect(scoreFromEvents(before.events)).toEqual(scoreFromEvents(after.events));
  });

  it('serves the timeline with a current stamp when the feed is healthy', async () => {
    const { liveMatch } = setup('live');
    const { data, meta } = await liveMatch.getTimeline(SIM_FIXTURE_ID);
    expect(meta.status).toBe('current');
    expect(meta.updatedAt).not.toBeNull();
    for (const e of data ?? []) expect(matchEvent.safeParse(e).success).toBe(true);
    expect(scoreFromEvents(data ?? [])).toEqual({ home: 12, away: 3 });
  });

  it('marks the timeline delayed when the feed runs behind', async () => {
    const { liveMatch } = setup('live', { liveFeed: 'delayed' });
    const { data, meta } = await liveMatch.getTimeline(SIM_FIXTURE_ID);
    expect(meta.status).toBe('delayed');
    // Three minutes behind: the 24th-minute miss has been seen, nothing later.
    expect(Math.max(...(data ?? []).map((e) => e.minute))).toBe(24);
  });

  it('keeps the last known timeline, marked stale, when the feed is down', async () => {
    const { liveMatch, fixtures } = setup('live', { liveFeed: 'down' });
    const { data, meta } = await liveMatch.getTimeline(SIM_FIXTURE_ID);
    expect(meta.status).toBe('stale');
    expect(meta.notice?.en).toMatch(/last update/);
    expect(scoreFromEvents(data ?? [])).toEqual({ home: 7, away: 3 });
    // Fixtures and editorial keep working.
    expect((await fixtures.listFixtures({})).meta.status).toBe('current');
  });

  it('gives no timeline, and no made-up one, for a fixture with no feed', async () => {
    const { liveMatch } = setup('pre_match');
    const { data, meta } = await liveMatch.getTimeline(EXAMPLE_FIXTURE_ID);
    expect(data).toBeNull();
    expect(meta.status).toBe('unavailable');
  });

  it('withholds statistics until the provider has supplied them', async () => {
    expect((await setup('live').liveMatch.getStats(SIM_FIXTURE_ID)).data).toBeNull();
    expect(
      (await setup('full_time').liveMatch.getStats(SIM_FIXTURE_ID)).data?.length,
    ).toBeGreaterThan(0);
  });

  it('never attaches a player name in the demo', async () => {
    const { liveMatch } = setup('full_time');
    const lineups = await liveMatch.getLineups(SIM_FIXTURE_ID);
    const names = lineups.data
      ?.flatMap((l) => [...l.starters, ...l.replacements])
      .map((p) => p.name);
    expect(names?.every((n) => n === null)).toBe(true);
    const timeline = await liveMatch.getTimeline(SIM_FIXTURE_ID);
    expect(timeline.data?.every((e) => e.playerName === undefined)).toBe(true);
  });
});

describe('ticketing', () => {
  it('links out to the official ticket page for a home fixture', async () => {
    const { ticketing } = setup('pre_match');
    const link = await ticketing.getTicketLink(EXAMPLE_FIXTURE_ID);
    expect(link.data).toMatchObject({ kind: 'purchase' });
    expect(link.data?.url).toMatch(/^https:\/\/www\.scarlets\.wales\//);
  });

  it('never claims tickets are available when ticketing is down', async () => {
    const { ticketing } = setup('pre_match', { ticketing: 'down' });
    const link = await ticketing.getTicketLink(EXAMPLE_FIXTURE_ID);
    expect(link.data).toBeNull();
    expect(link.meta.status).toBe('unavailable');
    expect(link.meta.notice?.en).toMatch(/ticket office/);
  });

  it('explains why there is no link for away and unreleased fixtures', async () => {
    const { ticketing } = setup('pre_match');
    expect((await ticketing.getTicketLink('fx-demo-athletic-away')).meta.notice?.en).toMatch(
      /home club/,
    );
    expect((await ticketing.getTicketLink('fx-sample-rfc-home')).meta.notice?.en).toMatch(
      /not on sale/,
    );
  });
});

describe('membership and rewards', () => {
  it('gives a guest no Passport', async () => {
    const a = setup('pre_match');
    const m = await a.membership.getMembership(guest);
    expect(m.data?.state).toBe('not_linked');
    expect((await a.rewards.getPassport(guest, m.data!)).data).toBeNull();
  });

  it('shows member benefits only on a linked membership', async () => {
    const a = setup('pre_match');
    const unlinked = await a.rewards.getPassport(
      supporter,
      (await a.membership.getMembership(supporter)).data!,
    );
    expect(unlinked.data?.benefits).toHaveLength(0);
    const linked = await a.rewards.getPassport(
      member,
      (await a.membership.getMembership(member)).data!,
    );
    expect(linked.data?.benefits.length).toBeGreaterThan(0);
    expect(linked.data?.membership.memberRefMasked).toMatch(/•/);
  });

  it('carries no points, tier, amount or open catalogue', async () => {
    const a = setup('pre_match');
    const result = await a.rewards.getPassport(
      member,
      (await a.membership.getMembership(member)).data!,
    );
    expect(passport.safeParse(result.data).success).toBe(true);
    expect(result.data?.programme).toMatchObject({
      balance: null,
      tier: null,
      rulesPublished: false,
    });
    expect(result.data?.history.every((h) => h.amount === null)).toBe(true);
    expect(result.data?.catalogueOpen).toBe(false);
    expect(result.data?.benefits.every((b) => b.redemption === 'not_available_yet')).toBe(true);
  });

  it('falls back to the last synced status when rewards are down', async () => {
    const a = setup('pre_match', { rewards: 'down' });
    const result = await a.rewards.getPassport(
      member,
      (await a.membership.getMembership(member)).data!,
    );
    expect(result.meta.status).toBe('stale');
    expect(result.meta.notice?.en).toMatch(/paused/);
  });
});

describe('Fan Zone', () => {
  const vote = { kind: 'poll', activityId: 'poll-looking-forward', optionId: 'atmosphere' };

  it('takes one vote per device and refuses the second', async () => {
    const { fanZone } = setup('pre_match');
    const first = await fanZone.submit(guest, 'poll-looking-forward', vote);
    expect(first.ok).toBe(true);
    const second = await fanZone.submit(guest, 'poll-looking-forward', {
      ...vote,
      optionId: 'rugby',
    });
    expect(second).toEqual({ ok: false, error: 'duplicate' });
    expect(await fanZone.listReceipts(guest)).toHaveLength(1);
  });

  it('keeps accounts separate', async () => {
    const { fanZone } = setup('pre_match');
    await fanZone.submit(supporter, 'poll-looking-forward', vote);
    expect((await fanZone.submit(member, 'poll-looking-forward', vote)).ok).toBe(true);
  });

  it('locks predictions at kick-off', async () => {
    const prediction = {
      kind: 'prediction',
      activityId: `prediction-${EXAMPLE_FIXTURE_ID}`,
      home: 27,
      away: 17,
    };
    const open = await setup('pre_match').fanZone.submit(guest, prediction.activityId, prediction);
    expect(open.ok && open.receipt.summary).toBe('27-17');
    // Four hours into matchday the fixture has kicked off.
    const late = await setup('matchday', {}, 4 * 3_600_000).fanZone.submit(
      guest,
      prediction.activityId,
      prediction,
    );
    expect(late).toEqual({ ok: false, error: 'closed' });
  });

  it('opens the Player of the Match vote only late in the match', async () => {
    const id = `potm-${SIM_FIXTURE_ID}`;
    const input = { kind: 'poll', activityId: id, optionId: 'n8' };
    expect(await setup('live').fanZone.submit(guest, id, input)).toEqual({
      ok: false,
      error: 'not_open',
    });
    expect((await setup('full_time').fanZone.submit(guest, id, input)).ok).toBe(true);
  });

  it('holds a Fan Cam photo for moderation and needs sign-in and consent', async () => {
    const id = `fancam-${EXAMPLE_FIXTURE_ID}`;
    const consent = { ageOrGuardian: true, peopleInPhoto: true, displayAndModeration: true };
    const input = { kind: 'fan_cam', activityId: id, mediaRef: 'local:photo-1', consent };
    const { fanZone } = setup('matchday');
    expect(await fanZone.submit(guest, id, input)).toEqual({
      ok: false,
      error: 'sign_in_required',
    });
    expect(
      await fanZone.submit(supporter, id, {
        ...input,
        consent: { ...consent, peopleInPhoto: false },
      }),
    ).toEqual({ ok: false, error: 'consent_required' });
    const sent = await fanZone.submit(supporter, id, input);
    expect(sent.ok && sent.receipt.moderation).toBe('pending');
    // The supporter can take it back.
    if (sent.ok) expect(await fanZone.withdraw(supporter, sent.receipt.id)).toBe(true);
    expect((await fanZone.listReceipts(supporter))[0]?.moderation).toBe('withdrawn');
  });

  it('scores the quiz and stops a retake', async () => {
    const { fanZone } = setup('pre_match');
    const answers = { q1: 'b', q2: 'b', q3: 'a', q4: 'a', q5: 'a' };
    const input = { kind: 'quiz', activityId: 'quiz-rugby-basics', answers };
    const done = await fanZone.submit(guest, 'quiz-rugby-basics', input);
    expect(done.ok && done.receipt.summary).toBe('4/5');
    expect(await fanZone.submit(guest, 'quiz-rugby-basics', input)).toEqual({
      ok: false,
      error: 'duplicate',
    });
  });

  it('hides a story from the supporter who reports it', async () => {
    const { fanZone } = setup('pre_match');
    const before = (await fanZone.listStories(guest)).data ?? [];
    expect(before.every((s) => s.moderation === 'approved')).toBe(true);
    await fanZone.reportStory(guest, before[0]!.id, 'inappropriate');
    const after = (await fanZone.listStories(guest)).data ?? [];
    expect(after.map((s) => s.id)).not.toContain(before[0]!.id);
  });

  it('refuses submissions while offline', async () => {
    const { fanZone } = setup('pre_match', { network: 'offline' });
    expect(await fanZone.submit(guest, 'poll-looking-forward', vote)).toEqual({
      ok: false,
      error: 'offline',
    });
  });
});

describe('offline and notifications', () => {
  it('labels cached data as offline and withholds ticket links', async () => {
    const a = setup('pre_match', { network: 'offline' });
    const list = await a.fixtures.listFixtures({});
    expect(list.meta.status).toBe('offline');
    expect(list.data?.length).toBeGreaterThan(0);
    expect((await a.ticketing.getTicketLink(EXAMPLE_FIXTURE_ID)).data).toBeNull();
  });

  it('starts with every notification off, marketing included', async () => {
    const { notifications } = setup('pre_match');
    const prefs = await notifications.getPreferences(guest);
    expect(prefs.data).toEqual({
      matchAlerts: false,
      ticketReminders: false,
      clubNews: false,
      partnerOffers: false,
    });
    await notifications.updatePreferences(guest, { ...prefs.data!, matchAlerts: true });
    const saved = await notifications.getPreferences(guest);
    expect(saved.data).toMatchObject({ matchAlerts: true, partnerOffers: false });
  });

  it('marks the venue map as not approved', async () => {
    const guide = await setup('pre_match').venue.getGuide(EXAMPLE_FIXTURE_ID);
    expect(guide.data?.mapApproved).toBe(false);
    expect(
      guide.data?.sections
        .flatMap((s) => s.blocks)
        .every((b) => b.approval === 'awaiting_approval'),
    ).toBe(true);
  });
});
