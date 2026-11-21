import type { Adapters } from '@scarlets/adapters';
import {
  activityWindow,
  campaignFor,
  currentEvents,
  homeModuleOrder,
  isHomeFixture,
  matchPhase,
  nextFixture,
  scoreFromEvents,
  stageFor,
  type FanActivity,
  type Fixture,
  type MatchEvent,
  type Receipt,
  type SourceMeta,
  type Sourced,
} from '@scarlets/domain';
import type { RequestContext, ScarletsApi } from './api';
import type { MatchClock, MatchPulse } from './contracts';

const SIX_HOURS = 6 * 3_600_000;

/**
 * The fixture the front door is about: one in progress, else one that
 * finished in the last few hours, else the next one coming.
 */
export function featuredFixture(fixtures: readonly Fixture[], now: Date): Fixture | null {
  const firstTeam = fixtures.filter((f) => f.squad === 'first_team');
  const inPlay = firstTeam.find((f) => f.status === 'live' || f.status === 'half_time');
  if (inPlay) return inPlay;
  const justFinished = firstTeam
    .filter(
      (f) =>
        f.status === 'full_time' && now.getTime() - new Date(f.kickoffUtc).getTime() < SIX_HOURS,
    )
    .sort((a, b) => b.kickoffUtc.localeCompare(a.kickoffUtc))[0];
  if (justFinished) return justFinished;
  return nextFixture(firstTeam, now);
}

/**
 * The match clock as the FEED last knew it. When the feed is behind, the
 * clock stops with it rather than running ahead of the score on screen.
 */
export function clockFor(
  target: Fixture,
  events: readonly MatchEvent[],
  feedTime: Date,
): MatchClock {
  if (
    target.status === 'scheduled' ||
    target.status === 'postponed' ||
    target.status === 'cancelled'
  ) {
    return { period: 'pre', minute: null };
  }
  const current = currentEvents(events);
  const has = (type: MatchEvent['type']) => current.some((e) => e.type === type);
  if (target.status === 'full_time' || has('full_time')) return { period: 'full_time', minute: 80 };
  if (target.status === 'half_time' || (has('half_time') && !has('second_half'))) {
    return { period: 'half_time', minute: 40 };
  }
  const elapsed = Math.floor((feedTime.getTime() - new Date(target.kickoffUtc).getTime()) / 60_000);
  if (has('second_half'))
    return { period: 'second_half', minute: Math.min(80, Math.max(41, elapsed - 15)) };
  return { period: 'first_half', minute: Math.min(40, Math.max(0, elapsed)) };
}

const unavailable = <T>(source: string): Sourced<T> => ({
  data: null,
  meta: { status: 'unavailable', updatedAt: null, source, demo: true },
});

/** Which Fan Zone activity to offer on Home: something open that they have not done. */
export function pickFanPrompt(
  activities: readonly FanActivity[],
  receipts: readonly Receipt[],
  target: Fixture | null,
  now: Date,
): FanActivity | null {
  const done = new Set(
    receipts.filter((r) => r.moderation !== 'withdrawn').map((r) => r.activityId),
  );
  const open = activities.filter((a) => activityWindow(a, now) === 'open');
  const forFixture = (a: FanActivity) => (target ? a.fixtureId === target.id : false);
  const ranked = [
    ...open.filter((a) => a.kind === 'poll' && forFixture(a)),
    ...open.filter((a) => a.kind === 'prediction' && forFixture(a)),
    ...open.filter((a) => a.kind === 'quiz'),
    ...open.filter((a) => a.kind === 'challenge'),
  ];
  return ranked.find((a) => !done.has(a.id)) ?? ranked[0] ?? null;
}

export interface ServiceOptions {
  adapters: Adapters;
  clock: () => Date;
}

/**
 * Composes provider data into the shapes screens need. This is the server:
 * in production it runs behind HTTPS with vendor credentials beside it.
 */
export function createService({ adapters, clock }: ServiceOptions): ScarletsApi {
  const pulseFor = async (target: Fixture): Promise<MatchPulse> => {
    const timeline = await adapters.liveMatch.getTimeline(target.id);
    const events = timeline.data ?? [];
    const meta: SourceMeta = timeline.meta;
    const feedTime = meta.updatedAt ? new Date(meta.updatedAt) : clock();
    const current = currentEvents(events);
    return {
      fixture: target,
      score: events.length ? scoreFromEvents(events) : target.score,
      clock: clockFor(target, events, feedTime),
      lastEvent: current[current.length - 1] ?? null,
      meta,
    };
  };

  const resolveFixture = async (fixtureId?: string): Promise<Sourced<Fixture>> => {
    if (fixtureId) return adapters.fixtures.getFixture(fixtureId);
    const list = await adapters.fixtures.listFixtures({});
    const target = featuredFixture(list.data ?? [], clock());
    return { data: target, meta: list.meta };
  };

  return {
    async getHome(ctx: RequestContext) {
      const now = clock();
      const [list, campaigns, activities, receipts] = await Promise.all([
        adapters.fixtures.listFixtures({}),
        adapters.partners.listCampaigns(),
        adapters.fanZone.listActivities(),
        adapters.fanZone.listReceipts(ctx.account),
      ]);
      const fixtures = list.data ?? [];
      const target = featuredFixture(fixtures, now);
      const phase = matchPhase(target, now);
      const [pulse, ticket, stories] = await Promise.all([
        target ? pulseFor(target) : Promise.resolve(null),
        target && isHomeFixture(target)
          ? adapters.ticketing.getTicketLink(target.id)
          : Promise.resolve(null),
        adapters.cms.listContent({}),
      ]);
      const nextHome =
        fixtures
          .filter(
            (f) =>
              f.squad === 'first_team' &&
              isHomeFixture(f) &&
              f.status === 'scheduled' &&
              f.id !== target?.id &&
              new Date(f.kickoffUtc).getTime() > now.getTime(),
          )
          .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))[0] ?? null;
      const editorial = (stories.data ?? []).filter(
        (item) => item.kind !== 'video' && item.kind !== 'audio',
      );
      return {
        now: now.toISOString(),
        phase,
        modules: homeModuleOrder(phase),
        fixture: { data: target, meta: list.meta },
        pulse,
        ticket,
        stories: { data: editorial, meta: stories.meta },
        partner: campaignFor('home', campaigns.data ?? [], now),
        fanPrompt: pickFanPrompt(activities.data ?? [], receipts, target, now),
        nextHome,
      };
    },

    async getFixtures(_ctx, { squad }) {
      const [fixtures, table] = await Promise.all([
        adapters.fixtures.listFixtures({ squad }),
        adapters.fixtures.getTable(squad ?? 'first_team'),
      ]);
      return { now: clock().toISOString(), fixtures, table };
    },

    async getMatchCentre(_ctx, fixtureId) {
      const now = clock();
      const fixture = await adapters.fixtures.getFixture(fixtureId);
      const [timeline, lineups, stats, reports, activities, ticket] = await Promise.all([
        adapters.liveMatch.getTimeline(fixtureId),
        adapters.liveMatch.getLineups(fixtureId),
        adapters.liveMatch.getStats(fixtureId),
        adapters.cms.listContent({ kind: 'report', fixtureId }),
        adapters.fanZone.listActivities(),
        adapters.ticketing.getTicketLink(fixtureId),
      ]);
      const events = timeline.data ?? [];
      const feedTime = timeline.meta.updatedAt ? new Date(timeline.meta.updatedAt) : now;
      const poll =
        (activities.data ?? []).find(
          (a) =>
            a.kind === 'poll' && a.fixtureId === fixtureId && activityWindow(a, now) !== 'upcoming',
        ) ?? null;
      return {
        now: now.toISOString(),
        fixture,
        score: fixture.data ? (events.length ? scoreFromEvents(events) : fixture.data.score) : null,
        clock: fixture.data
          ? clockFor(fixture.data, events, feedTime)
          : { period: 'pre', minute: null },
        timeline,
        lineups,
        stats,
        report: reports.data?.[0] ?? null,
        poll,
        ticket,
      };
    },

    async getMatchday(_ctx, fixtureId) {
      const now = clock();
      let fixture = await resolveFixture(fixtureId);
      // Matchday is about going to the ground: prefer the next HOME fixture.
      if (!fixtureId && fixture.data && !isHomeFixture(fixture.data)) {
        const list = await adapters.fixtures.listFixtures({ squad: 'first_team' });
        const home = (list.data ?? [])
          .filter((f) => isHomeFixture(f) && f.status !== 'full_time')
          .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))[0];
        if (home) fixture = { data: home, meta: list.meta };
      }
      const id = fixture.data?.id;
      const [guide, ticket, ticketAccount, hospitality, campaigns] = await Promise.all([
        id ? adapters.venue.getGuide(id) : adapters.venue.getGuide('none'),
        id ? adapters.ticketing.getTicketLink(id) : Promise.resolve(null),
        adapters.ticketing.getAccountLink(),
        adapters.hospitality.listPackages(),
        adapters.partners.listCampaigns(),
      ]);
      return {
        now: now.toISOString(),
        fixture,
        stage: stageFor(fixture.data, now),
        guide,
        ticket,
        ticketAccount,
        hospitality,
        partner: campaignFor('matchday', campaigns.data ?? [], now),
      };
    },

    async getPassport(ctx) {
      const membership = await adapters.membership.getMembership(ctx.account);
      const [passport, campaigns] = await Promise.all([
        membership.data
          ? adapters.rewards.getPassport(ctx.account, membership.data)
          : Promise.resolve(unavailable<never>('Membership')),
        adapters.partners.listCampaigns(),
      ]);
      return {
        account: ctx.account.state,
        passport,
        offer: campaignFor('passport', campaigns.data ?? [], clock()),
      };
    },

    async getFanZone(ctx) {
      const now = clock();
      const [activities, receipts, stories, campaigns, list] = await Promise.all([
        adapters.fanZone.listActivities(),
        adapters.fanZone.listReceipts(ctx.account),
        adapters.fanZone.listStories(ctx.account),
        adapters.partners.listCampaigns(),
        adapters.fixtures.listFixtures({}),
      ]);
      const target = featuredFixture(list.data ?? [], now);
      // Show what belongs to the featured fixture, plus anything not tied to a fixture.
      const relevant = (activities.data ?? []).filter(
        (a) => !a.fixtureId || a.fixtureId === target?.id,
      );
      const results: Record<string, { optionId: string; votes: number; percent: number }[]> = {};
      await Promise.all(
        relevant
          .filter((a) => a.kind === 'poll')
          .map(async (a) => {
            const tallyResult = await adapters.fanZone.pollResults(a.id);
            if (tallyResult.data) results[a.id] = tallyResult.data;
          }),
      );
      return {
        now: now.toISOString(),
        activities: { data: relevant, meta: activities.meta },
        receipts,
        results,
        stories,
        sponsor: campaignFor('fan_zone', campaigns.data ?? [], now),
      };
    },

    submitFanActivity: (ctx, activityId, input) =>
      adapters.fanZone.submit(ctx.account, activityId, input),
    withdrawSubmission: (ctx, receiptId) => adapters.fanZone.withdraw(ctx.account, receiptId),
    reportStory: (ctx, storyId, reason) =>
      adapters.fanZone.reportStory(ctx.account, storyId, reason),

    listContent: (_ctx, query) => adapters.cms.listContent(query),
    getContent: (_ctx, id) => adapters.cms.getContent(id),
    getClub: () => adapters.cms.listClubSections(),

    async getClubSection(_ctx, id) {
      const section = await adapters.cms.getClubSection(id);
      const stories = section.data
        ? await adapters.cms.listContent({ category: section.data.category })
        : unavailable<never>('Content');
      return { section, stories };
    },

    async getPartnerWorld() {
      const [partners, campaigns, hospitality, shop] = await Promise.all([
        adapters.partners.listPartners(),
        adapters.partners.listCampaigns(),
        adapters.hospitality.listPackages(),
        adapters.commerce.getShopLink(),
      ]);
      return { partners, campaigns: campaigns.data ?? [], hospitality, shop };
    },

    getHelp: () => adapters.cms.listFaqs(),
    getMedia: () => adapters.cms.listMedia(),
    getNotificationPreferences: (ctx) => adapters.notifications.getPreferences(ctx.account),
    updateNotificationPreferences: (ctx, preferences) =>
      adapters.notifications.updatePreferences(ctx.account, preferences),
  };
}
