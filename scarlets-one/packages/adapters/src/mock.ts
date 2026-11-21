import {
  currentEvents,
  initialModeration,
  isLiveContent,
  quizScore,
  scoreFromEvents,
  sortContent,
  tally,
  tx,
  validateSubmission,
  type Fixture,
  type FixtureStatus,
  type Freshness,
  type LocalizedText,
  type MatchEvent,
  type Membership,
  type Passport,
  type Receipt,
  type Score,
  type SourceMeta,
  type Sourced,
  type Submission,
} from '@scarlets/domain';
import { officialLinks } from './config';
import { SIM_KICKOFF, type DemoControls } from './demo';
import {
  memoryStore,
  type Account,
  type Adapters,
  type KeyValueStore,
  type NotificationPreferences,
  type TicketLink,
} from './providers';
import { clubSections, contentSeed, faqSeed } from './seed/content';
import { activitySeed, pollBaseline, storySeed } from './seed/fanzone';
import {
  SIM_FIXTURE_ID,
  demoLineups,
  fixtureSeeds,
  simStats,
  simTimeline,
  staticResults,
} from './seed/fixtures';
import { checklistSeed, guideSections, hospitalitySeed, venuePoints } from './seed/matchday';
import { mediaSeed } from './seed/media';
import { campaignSeed, partnerSeed } from './seed/partners';
import { benefitSeed, historySeed, missionSeed, programmeSeed } from './seed/passport';

export interface MockOptions {
  /** Read on every call, so a control flipped in the app takes effect at once. */
  controls: () => DemoControls;
  /** The demo clock. */
  clock: () => Date;
  store?: KeyValueStore;
}

const OFFLINE_NOTICE = tx(
  'You’re offline. This is the last copy saved on your device.',
  'Rydych all-lein. Dyma’r copi olaf a gadwyd ar eich dyfais.',
);

const SOURCES = {
  fixtures: 'Demo fixtures feed',
  live: 'Demo live match feed',
  cms: 'Demo content system',
  ticketing: 'Demo ticketing link',
  membership: 'Demo membership system',
  rewards: 'Demo rewards programme',
  venue: 'Demo venue guide',
  partners: 'Demo partner directory',
  fanZone: 'Demo Fan Zone',
  commerce: 'Demo commerce link',
  hospitality: 'Demo hospitality listing',
  notifications: 'Demo notification service',
} as const;

const floorTo = (date: Date, seconds: number) =>
  new Date(Math.floor(date.getTime() / (seconds * 1000)) * seconds * 1000).toISOString();

interface SimState {
  status: FixtureStatus;
  score: Score | null;
  events: MatchEvent[];
}

/** The simulated match as the feed would have reported it at a given instant. */
export function simStateAt(at: Date): SimState {
  if (at.getTime() < new Date(SIM_KICKOFF).getTime()) {
    return { status: 'scheduled', score: null, events: [] };
  }
  const published = simTimeline.filter(
    (e) => new Date(e.sourceTimestamp).getTime() <= at.getTime(),
  );
  const events = currentEvents(published);
  const has = (type: MatchEvent['type']) => events.some((e) => e.type === type);
  const status: FixtureStatus = has('full_time')
    ? 'full_time'
    : has('half_time') && !has('second_half')
      ? 'half_time'
      : 'live';
  return { status, score: scoreFromEvents(published), events: published };
}

/**
 * Mock implementations of every provider, backed by the seed data.
 *
 * These stand in until the club supplies credentials and contracts (see
 * integrationGates). They behave like the real thing in the ways a screen
 * cares about: they report when data was last confirmed, they can run
 * behind, go down or lose the network, and they never fill a gap with a
 * guess.
 */
export function createMockAdapters(options: MockOptions): Adapters {
  const { controls, clock } = options;
  const store = options.store ?? memoryStore();

  const wait = async () => {
    const ms = controls().latencyMs;
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
  };
  const offline = () => controls().network === 'offline';

  const meta = (
    source: string,
    updatedAt: string | null,
    status: Freshness = 'current',
    notice?: LocalizedText,
  ): SourceMeta =>
    offline()
      ? { status: 'offline', updatedAt, source, demo: true, notice: OFFLINE_NOTICE }
      : { status, updatedAt, source, demo: true, notice };

  const sourced = <T>(data: T, m: SourceMeta): Sourced<T> => ({ data, meta: m });

  /** What the live feed can currently see, given its health. */
  const liveView = (): { at: Date; status: Freshness; notice?: LocalizedText } => {
    const now = clock();
    switch (controls().liveFeed) {
      case 'delayed':
        return {
          at: new Date(now.getTime() - 3 * 60_000),
          status: 'delayed',
          notice: tx(
            'Live updates are running a few minutes behind.',
            'Mae’r diweddariadau byw ychydig funudau ar ei hôl hi.',
          ),
        };
      case 'down':
        return {
          at: new Date(now.getTime() - 9 * 60_000),
          status: 'stale',
          notice: tx(
            'Live updates are interrupted. This is the last update we received.',
            'Mae’r diweddariadau byw wedi’u torri. Dyma’r diweddariad olaf a dderbyniwyd.',
          ),
        };
      default:
        return { at: now, status: 'current' };
    }
  };

  const fixtureList = (): Fixture[] => {
    const now = clock();
    const view = liveView();
    const updatedAt = floorTo(now, 300);
    const list: Fixture[] = [];
    for (const seed of fixtureSeeds) {
      const kickoff = new Date(seed.kickoffUtc).getTime();
      let status: FixtureStatus = 'scheduled';
      let score: Score | null = null;
      if (seed.id === SIM_FIXTURE_ID) {
        const sim = simStateAt(view.at);
        status = sim.status;
        score = sim.score;
      } else if (staticResults[seed.id]) {
        if (now.getTime() > kickoff + 2 * 3_600_000) {
          status = 'full_time';
          score = staticResults[seed.id] ?? null;
        }
      } else if (now.getTime() > kickoff + 3 * 3_600_000) {
        // The demo feed carries no result for this one, so it drops off the list.
        continue;
      }
      list.push({ ...seed, providerId: `demo:${seed.id}`, status, score, updatedAt, demo: true });
    }
    return list.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  };

  const accountKey = (account: Account) => account.userId ?? `device:${account.deviceId}`;

  const readJson = async <T>(key: string, fallback: T): Promise<T> => {
    const raw = await store.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const receiptsFor = (account: Account) =>
    readJson<Receipt[]>(`fz:receipts:${accountKey(account)}`, []);

  const summarise = (value: Submission): string => {
    const activity = activitySeed.find((a) => a.id === value.activityId);
    switch (value.kind) {
      case 'poll':
        return activity?.kind === 'poll'
          ? (activity.options.find((o) => o.id === value.optionId)?.label.en ?? value.optionId)
          : value.optionId;
      case 'prediction':
        return `${value.home}-${value.away}`;
      case 'quiz': {
        if (activity?.kind !== 'quiz') return '';
        const result = quizScore(activity, value.answers);
        return `${result.correct}/${result.total}`;
      }
      case 'fan_cam':
        return 'Photo sent for moderation';
      case 'challenge':
        return activity?.kind === 'challenge'
          ? (activity.steps.find((s) => s.id === value.stepId)?.label.en ?? value.stepId)
          : value.stepId;
    }
  };

  return {
    fixtures: {
      async listFixtures({ squad }) {
        await wait();
        const list = fixtureList().filter((f) => !squad || f.squad === squad);
        return sourced(list, meta(SOURCES.fixtures, floorTo(clock(), 300)));
      },
      async getFixture(id) {
        await wait();
        const found = fixtureList().find((f) => f.id === id);
        if (!found) {
          return {
            data: null,
            meta: meta(
              SOURCES.fixtures,
              null,
              'unavailable',
              tx('This fixture is no longer listed.'),
            ),
          };
        }
        return sourced(found, meta(SOURCES.fixtures, found.updatedAt));
      },
      async getTable() {
        await wait();
        return {
          data: null,
          meta: meta(
            SOURCES.fixtures,
            null,
            'unavailable',
            tx(
              'The league table appears once a licensed competition feed is connected. The app never works out standings from partial results.',
              'Bydd y tabl yn ymddangos pan fydd ffrwd gystadleuaeth drwyddedig wedi’i chysylltu. Nid yw’r ap byth yn cyfrifo safleoedd o ganlyniadau rhannol.',
            ),
          ),
        };
      },
    },

    liveMatch: {
      async getTimeline(fixtureId) {
        await wait();
        if (fixtureId !== SIM_FIXTURE_ID) {
          return {
            data: null,
            meta: meta(
              SOURCES.live,
              null,
              'unavailable',
              tx(
                'No live feed is connected for this fixture. A timeline appears here only from an approved match data provider.',
                'Nid oes ffrwd fyw wedi’i chysylltu ar gyfer y gêm hon. Bydd llinell amser yn ymddangos yma gan ddarparwr data cymeradwy yn unig.',
              ),
            ),
          };
        }
        const view = liveView();
        const sim = simStateAt(view.at);
        if (sim.events.length === 0) {
          return {
            data: [],
            meta: meta(SOURCES.live, floorTo(view.at, 10), view.status, view.notice),
          };
        }
        const finished = sim.status === 'full_time';
        return sourced(
          sim.events,
          meta(
            SOURCES.live,
            finished
              ? (sim.events[sim.events.length - 1]?.sourceTimestamp ?? null)
              : floorTo(view.at, 10),
            finished ? 'current' : view.status,
            finished ? undefined : view.notice,
          ),
        );
      },
      async getLineups(fixtureId) {
        await wait();
        const kickoff = fixtureSeeds.find((f) => f.id === fixtureId)?.kickoffUtc;
        if (!kickoff) {
          return { data: null, meta: meta(SOURCES.live, null, 'unavailable') };
        }
        // Team sheets are published roughly 48 hours before kick-off.
        const announced = clock().getTime() > new Date(kickoff).getTime() - 48 * 3_600_000;
        return sourced(
          demoLineups(announced),
          meta(
            SOURCES.live,
            floorTo(clock(), 300),
            'current',
            tx(
              'Names come from the official team sheet. The demo feed carries shirt numbers and positions only.',
              'Daw’r enwau o’r daflen tîm swyddogol. Dim ond rhifau crys a safleoedd sydd yn y ffrwd ddemo.',
            ),
          ),
        );
      },
      async getStats(fixtureId) {
        await wait();
        const view = liveView();
        const complete = fixtureId === SIM_FIXTURE_ID && simStateAt(view.at).status === 'full_time';
        if (!complete) {
          return {
            data: null,
            meta: meta(
              SOURCES.live,
              null,
              'unavailable',
              tx(
                'Match statistics appear when a licensed provider supplies them.',
                'Bydd ystadegau’r gêm yn ymddangos pan fydd darparwr trwyddedig yn eu cyflenwi.',
              ),
            ),
          };
        }
        return sourced(simStats, meta(SOURCES.live, floorTo(view.at, 60)));
      },
    },

    ticketing: {
      async getTicketLink(fixtureId) {
        await wait();
        if (controls().ticketing === 'down' || offline()) {
          return {
            data: null,
            meta: meta(
              SOURCES.ticketing,
              null,
              'unavailable',
              tx(
                'Ticketing isn’t responding right now, so we can’t say what is available. Please try again shortly or contact the ticket office.',
                'Nid yw’r system docynnau’n ymateb ar hyn o bryd, felly ni allwn ddweud beth sydd ar gael. Rhowch gynnig arall arni’n fuan neu cysylltwch â’r swyddfa docynnau.',
              ),
            ),
          };
        }
        const found = fixtureList().find((f) => f.id === fixtureId);
        const now = floorTo(clock(), 300);
        if (!found) return { data: null, meta: meta(SOURCES.ticketing, null, 'unavailable') };
        if (found.ticketing === 'away') {
          return {
            data: null,
            meta: meta(
              SOURCES.ticketing,
              now,
              'current',
              tx(
                'Away fixture. Tickets are sold by the home club.',
                'Gêm oddi cartref. Y clwb cartref sy’n gwerthu’r tocynnau.',
              ),
            ),
          };
        }
        if (found.ticketing === 'not_on_sale') {
          return {
            data: null,
            meta: meta(
              SOURCES.ticketing,
              now,
              'current',
              tx(
                'Tickets for this fixture are not on sale yet.',
                'Nid yw tocynnau’r gêm hon ar werth eto.',
              ),
            ),
          };
        }
        const link: TicketLink = {
          url: officialLinks.tickets.url,
          label: tx('Tickets', 'Tocynnau'),
          kind: 'purchase',
        };
        return sourced(link, meta(SOURCES.ticketing, now));
      },
      async getAccountLink() {
        await wait();
        if (controls().ticketing === 'down' || offline()) {
          return { data: null, meta: meta(SOURCES.ticketing, null, 'unavailable') };
        }
        return sourced(
          {
            url: officialLinks.tickets.url,
            label: tx('Open my tickets', 'Agor fy nhocynnau'),
            kind: 'account',
          },
          meta(SOURCES.ticketing, floorTo(clock(), 300)),
        );
      },
    },

    cms: {
      async listContent({ category, kind, fixtureId }) {
        await wait();
        const now = clock();
        const items = sortContent(
          contentSeed.filter(
            (item) =>
              isLiveContent(item, now) &&
              (!category || item.category === category) &&
              (!kind || item.kind === kind) &&
              (!fixtureId || item.fixtureId === fixtureId),
          ),
        );
        return sourced(items, meta(SOURCES.cms, floorTo(now, 900)));
      },
      async getContent(id) {
        await wait();
        const now = clock();
        const found = contentSeed.find((item) => item.id === id && isLiveContent(item, now));
        if (!found) return { data: null, meta: meta(SOURCES.cms, null, 'unavailable') };
        return sourced(found, meta(SOURCES.cms, floorTo(now, 900)));
      },
      async getClubSection(id) {
        await wait();
        const found = clubSections.find((section) => section.id === id);
        if (!found) return { data: null, meta: meta(SOURCES.cms, null, 'unavailable') };
        return sourced(found, meta(SOURCES.cms, floorTo(clock(), 900)));
      },
      async listClubSections() {
        await wait();
        return sourced(clubSections, meta(SOURCES.cms, floorTo(clock(), 900)));
      },
      async listFaqs() {
        await wait();
        return sourced(faqSeed, meta(SOURCES.cms, floorTo(clock(), 900)));
      },
      async listMedia() {
        await wait();
        return sourced(mediaSeed, meta(SOURCES.cms, floorTo(clock(), 900)));
      },
    },

    membership: {
      async getMembership(account) {
        await wait();
        const linked = account.state === 'signed_in' && account.member;
        const membership: Membership = linked
          ? {
              state: 'linked',
              type: tx('Season member', 'Aelod tymor'),
              season: '2026/27',
              memberRefMasked: 'DEMO •••• 0000',
              validTo: '2027-06-30T00:00:00Z',
              sourceSystem: SOURCES.membership,
            }
          : {
              state: 'not_linked',
              type: null,
              season: null,
              memberRefMasked: null,
              validTo: null,
              sourceSystem: SOURCES.membership,
            };
        return sourced(membership, meta(SOURCES.membership, floorTo(clock(), 300)));
      },
    },

    rewards: {
      async getPassport(account, membership) {
        await wait();
        if (account.state !== 'signed_in') {
          return { data: null, meta: meta(SOURCES.rewards, null, 'unavailable') };
        }
        const linked = membership.state === 'linked';
        const value: Passport = {
          displayName: 'Demo Supporter',
          initials: 'DS',
          membership,
          programme: programmeSeed,
          // Member benefits belong to a verified membership, so an unlinked account sees none.
          benefits: linked ? benefitSeed : [],
          missions: missionSeed,
          history: linked ? historySeed : [],
          catalogueOpen: false,
        };
        if (controls().rewards === 'down') {
          return sourced(
            value,
            meta(
              SOURCES.rewards,
              floorTo(new Date(clock().getTime() - 40 * 60_000), 300),
              'stale',
              tx(
                'Rewards aren’t responding. This is your last synced status, and redemption is paused until it is back.',
                'Nid yw’r gwobrau’n ymateb. Dyma eich statws olaf, ac mae defnyddio gwobrau wedi’i oedi nes iddo ddychwelyd.',
              ),
            ),
          );
        }
        return sourced(value, meta(SOURCES.rewards, floorTo(clock(), 300)));
      },
    },

    commerce: {
      async getShopLink() {
        await wait();
        return sourced(
          {
            url: officialLinks.shop.url,
            label: officialLinks.shop.label,
            confirmed: officialLinks.shop.confirmed,
          },
          meta(SOURCES.commerce, floorTo(clock(), 900)),
        );
      },
    },

    hospitality: {
      async listPackages() {
        await wait();
        return sourced(hospitalitySeed, meta(SOURCES.hospitality, floorTo(clock(), 900)));
      },
    },

    notifications: {
      async getPreferences(account) {
        await wait();
        // Everything is off until the supporter turns it on.
        const defaults: NotificationPreferences = {
          matchAlerts: false,
          ticketReminders: false,
          clubNews: false,
          partnerOffers: false,
        };
        const saved = await readJson(`notif:${accountKey(account)}`, defaults);
        return sourced(
          { ...defaults, ...saved },
          meta(SOURCES.notifications, floorTo(clock(), 60)),
        );
      },
      async updatePreferences(account, preferences) {
        await wait();
        await store.set(`notif:${accountKey(account)}`, JSON.stringify(preferences));
        return sourced(preferences, meta(SOURCES.notifications, floorTo(clock(), 1)));
      },
    },

    venue: {
      async getGuide(fixtureId) {
        await wait();
        return sourced(
          {
            fixtureId,
            sections: guideSections,
            points: venuePoints,
            checklist: checklistSeed,
            mapApproved: false,
          },
          meta(
            SOURCES.venue,
            floorTo(clock(), 900),
            'current',
            tx(
              'Venue details are placeholders until stadium operations approves them.',
              'Dalfannau yw manylion y lleoliad nes i dîm gweithrediadau’r stadiwm eu cymeradwyo.',
            ),
          ),
        );
      },
    },

    partners: {
      async listPartners() {
        await wait();
        return sourced(partnerSeed, meta(SOURCES.partners, floorTo(clock(), 900)));
      },
      async listCampaigns() {
        await wait();
        return sourced(campaignSeed, meta(SOURCES.partners, floorTo(clock(), 900)));
      },
    },

    fanZone: {
      async listActivities() {
        await wait();
        return sourced(activitySeed, meta(SOURCES.fanZone, floorTo(clock(), 60)));
      },
      listReceipts: receiptsFor,
      async submit(account, activityId, input) {
        await wait();
        if (offline()) return { ok: false, error: 'offline' };
        const activity = activitySeed.find((a) => a.id === activityId);
        if (!activity) return { ok: false, error: 'invalid' };
        const previous = await receiptsFor(account);
        const now = clock();
        const check = validateSubmission(activity, input, {
          now,
          signedIn: account.state === 'signed_in',
          previous,
        });
        if (!check.ok) return check;
        const receipt: Receipt = {
          id: `rcpt-${now.getTime().toString(36)}-${previous.length + 1}`,
          activityId,
          kind: activity.kind,
          submittedAt: now.toISOString(),
          moderation: initialModeration(activity.kind),
          summary: summarise(check.value),
          submission: check.value,
        };
        await store.set(
          `fz:receipts:${accountKey(account)}`,
          JSON.stringify([...previous, receipt]),
        );
        return { ok: true, receipt };
      },
      async withdraw(account, receiptId) {
        const previous = await receiptsFor(account);
        if (!previous.some((r) => r.id === receiptId)) return false;
        const next = previous.map((r) =>
          r.id === receiptId ? { ...r, moderation: 'withdrawn' as const } : r,
        );
        await store.set(`fz:receipts:${accountKey(account)}`, JSON.stringify(next));
        return true;
      },
      async pollResults(activityId) {
        await wait();
        const activity = activitySeed.find((a) => a.id === activityId);
        if (!activity || activity.kind !== 'poll') {
          return { data: null, meta: meta(SOURCES.fanZone, null, 'unavailable') };
        }
        const counts = pollBaseline[activityId] ?? {};
        return sourced(
          tally(
            activity.options.map((o) => o.id),
            counts,
          ),
          meta(SOURCES.fanZone, floorTo(clock(), 30)),
        );
      },
      async listStories(account) {
        await wait();
        const hidden = await readJson<string[]>(`fz:hidden:${accountKey(account)}`, []);
        // Only moderator-approved stories are ever listed.
        const visible = storySeed.filter(
          (s) => s.moderation === 'approved' && !hidden.includes(s.id),
        );
        return sourced(visible, meta(SOURCES.fanZone, floorTo(clock(), 300)));
      },
      async reportStory(account, storyId) {
        if (!storySeed.some((s) => s.id === storyId)) return false;
        const key = `fz:hidden:${accountKey(account)}`;
        const hidden = await readJson<string[]>(key, []);
        if (!hidden.includes(storyId)) await store.set(key, JSON.stringify([...hidden, storyId]));
        return true;
      },
    },
  };
}
