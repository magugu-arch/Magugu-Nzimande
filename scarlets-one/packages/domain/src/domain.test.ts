import { describe, expect, it } from 'vitest';
import {
  HOME_MODULES,
  buildEvent,
  campaignFor,
  canTransact,
  countdownTo,
  createTranslator,
  currentEvents,
  formatVenueTime,
  freshnessByAge,
  homeModuleOrder,
  isForbiddenProperty,
  isLiveContent,
  LIVE_THRESHOLDS,
  matchPhase,
  nextFixture,
  passport,
  resolveText,
  rolePermissions,
  can,
  scoreFromEvents,
  stageFor,
  tally,
  translationCoverage,
  validateSubmission,
  venueDayKey,
  type Campaign,
  type ContentItem,
  type FanActivity,
  type Fixture,
  type MatchEvent,
  type MatchPhase,
  type Receipt,
} from './index';

const fixture = (over: Partial<Fixture> = {}): Fixture => ({
  id: 'f1',
  providerId: 'p1',
  squad: 'first_team',
  competition: { en: 'United Rugby Championship' },
  home: { id: 'sca', name: 'Scarlets', shortName: 'SCA', isScarlets: true },
  away: { id: 'opp', name: 'Demo XV', shortName: 'DEM', isScarlets: false },
  venue: { name: 'Parc y Scarlets', city: 'Llanelli', timeZone: 'Europe/London' },
  kickoffUtc: '2026-12-05T17:00:00Z',
  kickoffProvisional: false,
  status: 'scheduled',
  score: null,
  ticketing: 'link_out',
  updatedAt: '2026-11-21T10:00:00Z',
  demo: true,
  ...over,
});

const event = (over: Partial<MatchEvent>): MatchEvent => ({
  id: over.providerEventId ?? 'e',
  fixtureId: 'f1',
  providerEventId: 'e',
  type: 'try',
  minute: 10,
  side: 'home',
  revision: 1,
  voided: false,
  sourceTimestamp: '2026-12-05T17:10:00Z',
  ...over,
});

describe('venue time', () => {
  it('shows a winter kick-off in GMT', () => {
    const t = formatVenueTime('2026-12-05T17:00:00Z', 'Europe/London', 'en');
    expect(t.time).toBe('17:00');
    expect(t.zone).toBe('GMT');
    expect(t.longDate).toBe('Saturday 5 December 2026');
  });

  it('shows a summer kick-off in BST, one hour ahead of UTC', () => {
    const t = formatVenueTime('2027-04-10T14:00:00Z', 'Europe/London', 'en');
    expect(t.time).toBe('15:00');
    expect(t.zone).toBe('BST');
  });

  it('uses the venue zone, not the reader zone, for an away fixture', () => {
    const t = formatVenueTime('2027-03-06T15:00:00Z', 'Africa/Johannesburg', 'en');
    expect(t.time).toBe('17:00');
  });

  it('rolls the venue day over at local midnight, not UTC midnight', () => {
    // 23:30 UTC on 30 June is already 1 July in the UK (BST).
    expect(venueDayKey(new Date('2027-06-30T23:30:00Z'), 'Europe/London')).toBe('2027-07-01');
    expect(venueDayKey(new Date('2026-12-05T23:30:00Z'), 'Europe/London')).toBe('2026-12-05');
  });

  it('counts down in whole units and stops at zero', () => {
    const c = countdownTo('2026-12-05T17:00:00Z', new Date('2026-11-21T10:00:00Z'));
    expect([c.days, c.hours, c.minutes, c.past]).toEqual([14, 7, 0, false]);
    const done = countdownTo('2026-12-05T17:00:00Z', new Date('2026-12-05T18:00:00Z'));
    expect([done.days, done.hours, done.minutes, done.past]).toEqual([0, 0, 0, true]);
  });
});

describe('match events', () => {
  it('scores tries, conversions, penalties and drop goals', () => {
    const events = [
      event({ providerEventId: 'a', type: 'try', side: 'home', minute: 5 }),
      event({ providerEventId: 'b', type: 'conversion', side: 'home', minute: 6 }),
      event({ providerEventId: 'c', type: 'penalty_goal', side: 'away', minute: 20 }),
      event({ providerEventId: 'd', type: 'drop_goal', side: 'away', minute: 30 }),
      event({ providerEventId: 'e', type: 'conversion_missed', side: 'away', minute: 31 }),
      event({ providerEventId: 'f', type: 'yellow_card', side: 'home', minute: 40 }),
    ];
    expect(scoreFromEvents(events)).toEqual({ home: 7, away: 6 });
  });

  it('lets a corrected event replace the one published in error', () => {
    const events = [
      event({ providerEventId: 'a', type: 'try', side: 'home', revision: 1 }),
      // The provider corrects the scoring side.
      event({ providerEventId: 'a', type: 'try', side: 'away', revision: 2 }),
    ];
    expect(currentEvents(events)).toHaveLength(1);
    expect(scoreFromEvents(events)).toEqual({ home: 0, away: 5 });
  });

  it('removes an event the provider withdraws', () => {
    const events = [
      event({ providerEventId: 'a', type: 'try', side: 'home', revision: 1 }),
      event({ providerEventId: 'a', type: 'try', side: 'home', revision: 2, voided: true }),
    ];
    expect(currentEvents(events)).toHaveLength(0);
    expect(scoreFromEvents(events)).toEqual({ home: 0, away: 0 });
  });

  it('ignores a stale revision that arrives late', () => {
    const events = [
      event({ providerEventId: 'a', side: 'away', revision: 3 }),
      event({ providerEventId: 'a', side: 'home', revision: 2 }),
    ];
    expect(currentEvents(events)[0]?.side).toBe('away');
  });

  it('orders the timeline by minute', () => {
    const events = [
      event({ providerEventId: 'late', minute: 70 }),
      event({ providerEventId: 'early', minute: 3 }),
    ];
    expect(currentEvents(events).map((e) => e.providerEventId)).toEqual(['early', 'late']);
  });
});

describe('match phase and home order', () => {
  it('is pre-match days out and matchday on the venue-local day', () => {
    expect(matchPhase(fixture(), new Date('2026-11-21T10:00:00Z'))).toBe('pre_match');
    expect(matchPhase(fixture(), new Date('2026-12-05T09:00:00Z'))).toBe('matchday');
    expect(matchPhase(null, new Date())).toBe('no_fixture');
    expect(matchPhase(fixture({ status: 'live' }), new Date())).toBe('live');
  });

  it('picks the soonest unfinished fixture', () => {
    const list = [
      fixture({ id: 'later', kickoffUtc: '2026-12-19T15:00:00Z' }),
      fixture({ id: 'done', kickoffUtc: '2026-11-14T15:00:00Z', status: 'full_time' }),
      fixture({ id: 'next', kickoffUtc: '2026-12-05T17:00:00Z' }),
    ];
    expect(nextFixture(list, new Date('2026-11-21T10:00:00Z'))?.id).toBe('next');
    expect(nextFixture([list[1] as Fixture], new Date('2026-11-21T10:00:00Z'))).toBeNull();
  });

  const phases: MatchPhase[] = [
    'no_fixture',
    'pre_match',
    'matchday',
    'live',
    'half_time',
    'full_time',
  ];

  it.each(phases)('%s: one partner module at most, and never first', (phase) => {
    const order = homeModuleOrder(phase);
    expect(order.filter((m) => m === 'partner').length).toBeLessThanOrEqual(1);
    expect(order[0]).not.toBe('partner');
    expect(new Set(order).size).toBe(order.length);
    for (const m of order) expect(HOME_MODULES).toContain(m);
  });

  it('leads with the score while a match is on and with planning on matchday', () => {
    expect(homeModuleOrder('live')[0]).toBe('match_pulse');
    expect(homeModuleOrder('matchday')[0]).toBe('planner');
    expect(homeModuleOrder('no_fixture')).not.toContain('match_pulse');
  });

  it('moves the matchday stage with the clock', () => {
    expect(stageFor(fixture(), new Date('2026-11-21T10:00:00Z'))).toBe('before');
    expect(stageFor(fixture(), new Date('2026-12-05T15:00:00Z'))).toBe('arrival');
    expect(stageFor(fixture({ status: 'live' }), new Date('2026-12-05T17:20:00Z'))).toBe('inside');
    expect(stageFor(fixture({ status: 'full_time' }), new Date('2026-12-05T19:00:00Z'))).toBe(
      'after',
    );
  });
});

describe('data freshness', () => {
  const now = new Date('2026-12-05T17:30:00Z');
  it('ages live data from current to delayed to stale', () => {
    expect(freshnessByAge('2026-12-05T17:29:30Z', now, LIVE_THRESHOLDS)).toBe('current');
    expect(freshnessByAge('2026-12-05T17:27:00Z', now, LIVE_THRESHOLDS)).toBe('delayed');
    expect(freshnessByAge('2026-12-05T17:10:00Z', now, LIVE_THRESHOLDS)).toBe('stale');
    expect(freshnessByAge(null, now, LIVE_THRESHOLDS)).toBe('unavailable');
  });

  it('blocks ticket and reward actions on data it cannot vouch for', () => {
    const meta = (status: 'current' | 'delayed' | 'stale' | 'unavailable' | 'offline') => ({
      status,
      updatedAt: null,
      source: 'x',
      demo: true,
    });
    expect(canTransact(meta('current'))).toBe(true);
    expect(canTransact(meta('stale'))).toBe(false);
    expect(canTransact(meta('offline'))).toBe(false);
    expect(canTransact(meta('unavailable'))).toBe(false);
  });
});

describe('Fan Zone gate', () => {
  const poll: FanActivity = {
    id: 'poll1',
    kind: 'poll',
    title: { en: 'Poll' },
    prompt: { en: 'Pick one' },
    opensAt: '2026-12-05T16:00:00Z',
    closesAt: '2026-12-05T19:00:00Z',
    sponsorship: null,
    requiresSignIn: false,
    demo: true,
    options: [
      { id: 'a', label: { en: 'A' } },
      { id: 'b', label: { en: 'B' } },
    ],
  };
  const now = new Date('2026-12-05T17:30:00Z');
  const vote = { kind: 'poll', activityId: 'poll1', optionId: 'a' };
  const receiptOf = (over: Partial<Receipt> = {}): Receipt => ({
    id: 'r1',
    activityId: 'poll1',
    kind: 'poll',
    submittedAt: '2026-12-05T17:00:00Z',
    moderation: 'not_required',
    summary: 'A',
    submission: { kind: 'poll', activityId: 'poll1', optionId: 'a' },
    ...over,
  });

  it('accepts one vote inside the window', () => {
    expect(validateSubmission(poll, vote, { now, signedIn: false, previous: [] }).ok).toBe(true);
  });

  it('refuses a second vote on the same poll', () => {
    const result = validateSubmission(poll, vote, {
      now,
      signedIn: false,
      previous: [receiptOf()],
    });
    expect(result).toEqual({ ok: false, error: 'duplicate' });
  });

  it('refuses votes before the window opens and after it closes', () => {
    const early = validateSubmission(poll, vote, {
      now: new Date('2026-12-05T15:00:00Z'),
      signedIn: false,
      previous: [],
    });
    const late = validateSubmission(poll, vote, {
      now: new Date('2026-12-05T19:00:00Z'),
      signedIn: false,
      previous: [],
    });
    expect(early).toEqual({ ok: false, error: 'not_open' });
    expect(late).toEqual({ ok: false, error: 'closed' });
  });

  it('refuses an option that is not on the poll', () => {
    const result = validateSubmission(
      poll,
      { ...vote, optionId: 'zzz' },
      { now, signedIn: false, previous: [] },
    );
    expect(result).toEqual({ ok: false, error: 'invalid' });
  });

  it('rate-limits a burst of submissions', () => {
    const burst = Array.from({ length: 6 }, (_, i) =>
      receiptOf({ id: `r${i}`, activityId: `other${i}`, submittedAt: '2026-12-05T17:29:40Z' }),
    );
    const result = validateSubmission(poll, vote, { now, signedIn: false, previous: burst });
    expect(result).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('will not take a Fan Cam photo without all three consents', () => {
    const cam: FanActivity = {
      id: 'cam1',
      kind: 'fan_cam',
      title: { en: 'Fan Cam' },
      prompt: { en: 'Share a photo' },
      opensAt: poll.opensAt,
      closesAt: poll.closesAt,
      sponsorship: null,
      requiresSignIn: true,
      demo: true,
      minimumAge: 18,
    };
    const partial = {
      kind: 'fan_cam',
      activityId: 'cam1',
      mediaRef: 'local:1',
      consent: { ageOrGuardian: true, peopleInPhoto: true, displayAndModeration: false },
    };
    expect(validateSubmission(cam, partial, { now, signedIn: true, previous: [] })).toEqual({
      ok: false,
      error: 'consent_required',
    });
    expect(validateSubmission(cam, partial, { now, signedIn: false, previous: [] })).toEqual({
      ok: false,
      error: 'sign_in_required',
    });
    const full = { ...partial, consent: { ...partial.consent, displayAndModeration: true } };
    expect(validateSubmission(cam, full, { now, signedIn: true, previous: [] }).ok).toBe(true);
  });

  it('reports poll percentages that always total 100', () => {
    const result = tally(['a', 'b', 'c'], { a: 1, b: 1, c: 1 });
    expect(result.reduce((sum, r) => sum + r.percent, 0)).toBe(100);
    expect(tally(['a', 'b'], {}).map((r) => r.percent)).toEqual([0, 0]);
    expect(tally(['a', 'b'], { a: 3, b: 1 }).map((r) => r.percent)).toEqual([75, 25]);
  });
});

describe('Passport', () => {
  const base = {
    displayName: 'Demo Supporter',
    initials: 'DS',
    membership: {
      state: 'linked' as const,
      type: { en: 'Season member' },
      season: '2026/27',
      memberRefMasked: '•••• 0000',
      validTo: null,
      sourceSystem: 'demo',
    },
    programme: {
      name: 'YMLAEN',
      status: 'announced' as const,
      rulesPublished: false,
      balance: null as number | null,
      tier: null as string | null,
      statement: { en: 'Details to follow.' },
    },
    benefits: [],
    missions: [],
    history: [],
    catalogueOpen: false,
  };

  it('accepts a Passport with no balance while rules are unpublished', () => {
    expect(passport.safeParse(base).success).toBe(true);
  });

  it('refuses a points balance, a tier or an amount before rules are published', () => {
    expect(
      passport.safeParse({ ...base, programme: { ...base.programme, balance: 500 } }).success,
    ).toBe(false);
    expect(
      passport.safeParse({ ...base, programme: { ...base.programme, tier: 'Gold' } }).success,
    ).toBe(false);
    const withAmount = {
      ...base,
      history: [
        {
          id: 't1',
          providerTxnId: 'p1',
          type: 'earned',
          title: { en: 'Attendance' },
          amount: 50,
          occurredAt: '2026-11-01T12:00:00Z',
          reference: null,
        },
      ],
    };
    expect(passport.safeParse(withAmount).success).toBe(false);
    expect(passport.safeParse({ ...base, catalogueOpen: true }).success).toBe(false);
  });

  it('allows provider-supplied values once rules are published', () => {
    const live = { ...base, programme: { ...base.programme, rulesPublished: true, balance: 120 } };
    expect(passport.safeParse(live).success).toBe(true);
  });
});

describe('language', () => {
  it('falls back to English when Welsh is missing and says so', () => {
    expect(resolveText({ en: 'Tickets', cy: 'Tocynnau' }, 'cy')).toEqual({
      value: 'Tocynnau',
      locale: 'cy',
      fallback: false,
    });
    expect(resolveText({ en: 'Tickets' }, 'cy')).toEqual({
      value: 'Tickets',
      locale: 'en',
      fallback: true,
    });
    expect(resolveText({ en: 'Tickets', cy: '  ' }, 'cy').fallback).toBe(true);
  });

  it('translates UI strings with parameters and visible gaps', () => {
    const en = { hello: 'Hello {name}', only: 'English only' };
    const cy = { hello: 'Helo {name}' };
    const t = createTranslator('cy', { en, cy });
    expect(t('hello', { name: 'Sam' })).toBe('Helo Sam');
    expect(t('only')).toBe('English only');
    expect(translationCoverage(en, cy)).toMatchObject({
      total: 2,
      translated: 1,
      missing: ['only'],
    });
  });
});

describe('commercial rules', () => {
  const c = (over: Partial<Campaign>): Campaign => ({
    id: 'c1',
    partnerId: 'p',
    label: 'partner_feature',
    placement: 'home',
    title: { en: 't' },
    body: { en: 'b' },
    mediaId: 'm',
    startsAt: '2026-11-01T00:00:00Z',
    endsAt: '2026-12-31T00:00:00Z',
    cta: null,
    terms: null,
    priority: 1,
    demo: true,
    ...over,
  });
  const now = new Date('2026-11-21T10:00:00Z');

  it('returns a single campaign per placement, highest priority first', () => {
    const picked = campaignFor('home', [c({ id: 'low' }), c({ id: 'high', priority: 5 })], now);
    expect(picked?.id).toBe('high');
  });

  it('skips campaigns outside their dates and other placements', () => {
    expect(campaignFor('home', [c({ endsAt: '2026-11-10T00:00:00Z' })], now)).toBeNull();
    expect(campaignFor('home', [c({ placement: 'fan_zone' })], now)).toBeNull();
  });
});

describe('content visibility', () => {
  const item = (over: Partial<ContentItem>): ContentItem => ({
    id: 'n1',
    kind: 'news',
    category: 'club',
    title: { en: 't' },
    summary: { en: 's' },
    body: [],
    mediaId: 'm',
    credit: 'c',
    publishAt: '2026-11-20T09:00:00Z',
    expireAt: null,
    status: 'published',
    translation: 'missing',
    pinned: false,
    demo: true,
    ...over,
  });
  const now = new Date('2026-11-21T10:00:00Z');

  it('hides drafts, scheduled items and expired items', () => {
    expect(isLiveContent(item({}), now)).toBe(true);
    expect(isLiveContent(item({ status: 'draft' }), now)).toBe(false);
    expect(isLiveContent(item({ publishAt: '2026-11-22T09:00:00Z' }), now)).toBe(false);
    expect(isLiveContent(item({ expireAt: '2026-11-21T09:00:00Z' }), now)).toBe(false);
  });
});

describe('roles', () => {
  it('keeps publishing, roles and the audit log with club admins', () => {
    expect(can('editor', 'content.write')).toBe(true);
    expect(can('editor', 'content.publish')).toBe(false);
    expect(can('moderator', 'moderation.review')).toBe(true);
    expect(can('moderator', 'content.write')).toBe(false);
    expect(can('partner_admin', 'campaigns.write')).toBe(true);
    expect(can('partner_admin', 'campaigns.approve')).toBe(false);
    expect(can('club_admin', 'roles.manage')).toBe(true);
    expect(rolePermissions.supporter).toHaveLength(0);
  });

  it('lets no human role adjust rewards', () => {
    for (const role of [
      'supporter',
      'editor',
      'moderator',
      'club_admin',
      'partner_admin',
    ] as const) {
      expect(can(role, 'rewards.adjust')).toBe(false);
    }
    expect(can('service', 'rewards.adjust')).toBe(true);
  });
});

describe('analytics', () => {
  it('drops personal and sensitive properties', () => {
    const { record, dropped } = buildEvent('ticket_cta_tap', {
      fixture_id: 'f1',
      placement: 'home_hero',
      email: 'a@b.c',
      displayName: 'Sam',
      user_location: 'x',
      ticketBarcode: '123',
      nested: { a: 1 },
    });
    expect(record.props).toEqual({ fixture_id: 'f1', placement: 'home_hero' });
    expect(dropped.sort()).toEqual([
      'displayName',
      'email',
      'nested',
      'ticketBarcode',
      'user_location',
    ]);
  });

  it('matches whole words, so ordinary ids are not caught', () => {
    expect(isForbiddenProperty('fixture_id')).toBe(false);
    expect(isForbiddenProperty('placement')).toBe(false);
    expect(isForbiddenProperty('language')).toBe(false);
    expect(isForbiddenProperty('emailAddress')).toBe(true);
    expect(isForbiddenProperty('member_ref')).toBe(true);
  });
});
