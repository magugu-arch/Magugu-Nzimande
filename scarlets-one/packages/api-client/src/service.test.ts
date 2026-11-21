import { describe, expect, it } from 'vitest';
import {
  EXAMPLE_FIXTURE_ID,
  SIM_FIXTURE_ID,
  createDemoClock,
  createMockAdapters,
  defaultControls,
  memoryStore,
  type Account,
  type DemoControls,
  type ScenarioId,
} from '@scarlets/adapters';
import {
  ApiError,
  createHttpApi,
  createService,
  fanZonePayload,
  fixturesPayload,
  homePayload,
  matchCentrePayload,
  matchdayPayload,
  partnerWorldPayload,
  passportPayload,
  type RequestContext,
} from './index';

const account = (over: Partial<Account> = {}): Account => ({
  state: 'guest',
  userId: null,
  deviceId: 'device-1',
  member: false,
  ...over,
});
const ctx = (over: Partial<Account> = {}): RequestContext => ({
  locale: 'en',
  account: account(over),
});
const member = ctx({ state: 'signed_in', userId: 'u1', member: true });

function api(scenario: ScenarioId, over: Partial<DemoControls> = {}) {
  const controls: DemoControls = { ...defaultControls, scenario, ...over };
  const clock = createDemoClock(scenario, 0, () => 0);
  const adapters = createMockAdapters({
    controls: () => controls,
    clock: () => clock.now(),
    store: memoryStore(),
  });
  return createService({ adapters, clock: () => clock.now() });
}

const scenarios: ScenarioId[] = [
  'pre_match',
  'matchday',
  'live',
  'half_time',
  'full_time',
  'off_season',
];

describe('every payload honours its contract in every scenario', () => {
  it.each(scenarios)('%s', async (scenario) => {
    const service = api(scenario);
    const check = (
      schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } },
      value: unknown,
    ) => {
      const result = schema.safeParse(value);
      expect(result.success, JSON.stringify(result.error)).toBe(true);
    };
    check(homePayload, await service.getHome(ctx()));
    check(fixturesPayload, await service.getFixtures(ctx(), {}));
    check(matchCentrePayload, await service.getMatchCentre(ctx(), SIM_FIXTURE_ID));
    check(matchdayPayload, await service.getMatchday(ctx()));
    check(passportPayload, await service.getPassport(member));
    check(fanZonePayload, await service.getFanZone(ctx()));
    check(partnerWorldPayload, await service.getPartnerWorld(ctx()));
  });
});

describe('Home', () => {
  it('two weeks out: features the next fixture with a ticket link and no score', async () => {
    const home = await api('pre_match').getHome(ctx());
    expect(home.phase).toBe('pre_match');
    expect(home.fixture.data?.id).toBe(EXAMPLE_FIXTURE_ID);
    expect(home.pulse?.score).toBeNull();
    expect(home.pulse?.clock).toEqual({ period: 'pre', minute: null });
    expect(home.ticket?.data?.kind).toBe('purchase');
    expect(home.modules[0]).toBe('quick_links');
    expect(home.fanPrompt?.id).toBe('poll-looking-forward');
  });

  it('matchday: leads with planning', async () => {
    const home = await api('matchday').getHome(ctx());
    expect(home.phase).toBe('matchday');
    expect(home.modules[0]).toBe('planner');
  });

  it('live: leads with the score and the feed’s own clock', async () => {
    const home = await api('live').getHome(ctx());
    expect(home.phase).toBe('live');
    expect(home.fixture.data?.id).toBe(SIM_FIXTURE_ID);
    expect(home.pulse?.score).toEqual({ home: 12, away: 3 });
    expect(home.pulse?.clock).toEqual({ period: 'first_half', minute: 27 });
    expect(home.pulse?.meta.demo).toBe(true);
    expect(home.modules[0]).toBe('match_pulse');
  });

  it('half-time and full time', async () => {
    const ht = await api('half_time').getHome(ctx());
    expect(ht.pulse?.clock.period).toBe('half_time');
    expect(ht.pulse?.score).toEqual({ home: 15, away: 10 });
    const ft = await api('full_time').getHome(ctx());
    expect(ft.phase).toBe('full_time');
    expect(ft.pulse?.score).toEqual({ home: 25, away: 20 });
    expect(ft.nextHome?.id).toBe(EXAMPLE_FIXTURE_ID);
  });

  it('out of season: no fixture, no pulse, stories first', async () => {
    const home = await api('off_season').getHome(ctx());
    expect(home.phase).toBe('no_fixture');
    expect(home.fixture.data).toBeNull();
    expect(home.pulse).toBeNull();
    expect(home.modules[0]).toBe('stories');
    expect(home.stories.data?.length).toBeGreaterThan(0);
  });

  it('never shows a placeholder score when the live feed is down: it shows the stale one, labelled', async () => {
    const home = await api('live', { liveFeed: 'down' }).getHome(ctx());
    expect(home.pulse?.meta.status).toBe('stale');
    expect(home.pulse?.score).toEqual({ home: 7, away: 3 });
    // The clock stops with the feed instead of running ahead of the score.
    expect(home.pulse?.clock.minute).toBe(18);
  });

  it('carries at most one partner module', async () => {
    for (const scenario of scenarios) {
      const home = await api(scenario).getHome(ctx());
      expect(home.modules.filter((m) => m === 'partner').length).toBeLessThanOrEqual(1);
    }
  });
});

describe('Match Centre', () => {
  it('has no timeline or statistics for a fixture without a feed, and says why', async () => {
    const centre = await api('pre_match').getMatchCentre(ctx(), EXAMPLE_FIXTURE_ID);
    expect(centre.timeline.data).toBeNull();
    expect(centre.timeline.meta.status).toBe('unavailable');
    expect(centre.stats.data).toBeNull();
    expect(centre.score).toBeNull();
    expect(centre.report).toBeNull();
  });

  it('publishes the report and the fan vote after full time', async () => {
    const centre = await api('full_time').getMatchCentre(ctx(), SIM_FIXTURE_ID);
    expect(centre.report?.id).toBe('report-sim');
    expect(centre.poll?.id).toBe(`potm-${SIM_FIXTURE_ID}`);
    expect(centre.stats.data?.length).toBeGreaterThan(0);
    expect(centre.clock.period).toBe('full_time');
  });
});

describe('Matchday', () => {
  it('guides the next home fixture and picks the stage from the clock', async () => {
    expect((await api('pre_match').getMatchday(ctx())).stage).toBe('before');
    const day = await api('matchday').getMatchday(ctx());
    expect(day.fixture.data?.id).toBe(EXAMPLE_FIXTURE_ID);
    // 13:30 is three and a half hours before kick-off, so still "before".
    expect(day.stage).toBe('before');
    expect(day.guide.data?.mapApproved).toBe(false);
    expect((await api('live').getMatchday(ctx())).stage).toBe('inside');
    expect((await api('full_time').getMatchday(ctx())).stage).toBe('after');
  });

  it('withholds the ticket link when ticketing is down', async () => {
    const day = await api('matchday', { ticketing: 'down' }).getMatchday(ctx());
    expect(day.ticket?.data).toBeNull();
    expect(day.ticketAccount.data).toBeNull();
  });
});

describe('Passport', () => {
  it('is empty for a guest and populated for a member, with no reward economics', async () => {
    const guest = await api('pre_match').getPassport(ctx());
    expect(guest.account).toBe('guest');
    expect(guest.passport.data).toBeNull();
    const linked = await api('pre_match').getPassport(member);
    expect(linked.passport.data?.membership.state).toBe('linked');
    expect(linked.passport.data?.programme.balance).toBeNull();
    expect(linked.offer?.label).toBe('partner_offer');
  });
});

describe('Fan Zone', () => {
  it('shows only the featured fixture’s activities, and records a vote', async () => {
    const service = api('pre_match');
    const before = await service.getFanZone(ctx());
    expect(
      before.activities.data?.every((a) => !a.fixtureId || a.fixtureId === EXAMPLE_FIXTURE_ID),
    ).toBe(true);
    expect(before.results['poll-looking-forward']?.reduce((sum, r) => sum + r.percent, 0)).toBe(
      100,
    );
    const result = await service.submitFanActivity(ctx(), 'poll-looking-forward', {
      kind: 'poll',
      activityId: 'poll-looking-forward',
      optionId: 'friends',
    });
    expect(result.ok).toBe(true);
    expect((await service.getFanZone(ctx())).receipts).toHaveLength(1);
  });
});

describe('HTTP client', () => {
  const body = async () => api('pre_match').getHome(ctx());

  it('sends language, device id and bearer token, and parses a valid reply', async () => {
    const seen: { url?: string; headers?: Record<string, string> } = {};
    const payload = await body();
    const http = createHttpApi({
      baseUrl: 'https://api.example.test',
      deviceId: 'device-1',
      getAccessToken: async () => 'token-123',
      fetch: (async (url: string, init: { headers: Record<string, string> }) => {
        seen.url = url;
        seen.headers = init.headers;
        return new Response(JSON.stringify(payload), { status: 200 });
      }) as unknown as typeof fetch,
    });
    const home = await http.getHome({ locale: 'cy', account: account() });
    expect(home.fixture.data?.id).toBe(EXAMPLE_FIXTURE_ID);
    expect(seen.url).toBe('https://api.example.test/v1/home');
    expect(seen.headers).toMatchObject({
      'Accept-Language': 'cy',
      'X-Device-Id': 'device-1',
      Authorization: 'Bearer token-123',
    });
  });

  it('rejects a reply that breaks the contract', async () => {
    const payload = { ...(await body()), phase: 'made_up_phase' };
    const http = createHttpApi({
      baseUrl: 'https://api.example.test',
      deviceId: 'd',
      fetch: (async () =>
        new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch,
    });
    await expect(http.getHome(ctx())).rejects.toMatchObject({ kind: 'contract' });
  });

  it('rejects a Passport carrying a points balance before rules are published', async () => {
    const payload = await api('pre_match').getPassport(member);
    const tampered = JSON.parse(JSON.stringify(payload));
    tampered.passport.data.programme.balance = 500;
    const http = createHttpApi({
      baseUrl: 'https://api.example.test',
      deviceId: 'd',
      fetch: (async () =>
        new Response(JSON.stringify(tampered), { status: 200 })) as unknown as typeof fetch,
    });
    await expect(http.getPassport(member)).rejects.toBeInstanceOf(ApiError);
  });

  it('reports HTTP and network failures distinctly', async () => {
    const failing = createHttpApi({
      baseUrl: 'https://api.example.test',
      deviceId: 'd',
      fetch: (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch,
    });
    await expect(failing.getHome(ctx())).rejects.toMatchObject({ kind: 'http', status: 503 });
    const down = createHttpApi({
      baseUrl: 'https://api.example.test',
      deviceId: 'd',
      fetch: (async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch,
    });
    await expect(down.getHome(ctx())).rejects.toMatchObject({ kind: 'network' });
  });

  it('fills path parameters', async () => {
    let url = '';
    const centre = await api('pre_match').getMatchCentre(ctx(), SIM_FIXTURE_ID);
    const http = createHttpApi({
      baseUrl: 'https://api.example.test',
      deviceId: 'd',
      fetch: (async (u: string) => {
        url = u;
        return new Response(JSON.stringify(centre), { status: 200 });
      }) as unknown as typeof fetch,
    });
    await http.getMatchCentre(ctx(), SIM_FIXTURE_ID);
    expect(url).toBe(`https://api.example.test/v1/fixtures/${SIM_FIXTURE_ID}/centre`);
  });
});
