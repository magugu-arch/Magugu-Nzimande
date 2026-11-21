import {
  tx,
  type Fixture,
  type Lineup,
  type LineupPlayer,
  type LocalizedText,
  type MatchEvent,
  type MatchEventType,
  type MatchStat,
  type TeamRef,
} from '@scarlets/domain';
import { EXAMPLE_KICKOFF, SIM_KICKOFF, elapsedForMinute } from '../demo';

/**
 * DEMO FIXTURES.
 *
 * One fixture here is real-world: Scarlets v Connacht on 5 December 2026,
 * 17:00, which the product brief quotes from the club's official listing as
 * an illustrative example. It carries no score and is flagged as an example.
 *
 * Every other fixture is synthetic, against opponents with plainly invented
 * names, so that no demo score can be mistaken for a real result. In
 * production the list comes from the club's approved fixtures feed.
 */

const scarlets: TeamRef = { id: 'scarlets', name: 'Scarlets', shortName: 'SCA', isScarlets: true };
const opponent = (id: string, name: string, shortName: string): TeamRef => ({
  id,
  name,
  shortName,
  isScarlets: false,
});

const parc = { name: 'Parc y Scarlets', city: 'Llanelli', timeZone: 'Europe/London' };
const awayGround = { name: 'Away ground (demo)', city: 'Demo', timeZone: 'Europe/London' };

const URC = tx('United Rugby Championship', 'Pencampwriaeth Rygbi Unedig');
const DEMO_COMP = tx('Demo fixture', 'Gêm ddemo');
const SEEDED_AT = '2026-11-21T09:58:00Z';

export const SIM_FIXTURE_ID = 'fx-sim-demo-xv';
export const EXAMPLE_FIXTURE_ID = 'fx-example-connacht';

type Seed = Omit<Fixture, 'status' | 'score' | 'updatedAt' | 'demo' | 'providerId'>;

export const fixtureSeeds: Seed[] = [
  {
    id: 'fx-demo-rovers-away',
    squad: 'first_team',
    competition: DEMO_COMP,
    home: opponent('demo-rovers', 'Demo Rovers', 'DRV'),
    away: scarlets,
    venue: awayGround,
    kickoffUtc: '2026-10-31T14:00:00Z',
    kickoffProvisional: false,
    ticketing: 'away',
    note: tx('Synthetic result for demonstration.'),
  },
  {
    id: SIM_FIXTURE_ID,
    squad: 'first_team',
    competition: DEMO_COMP,
    home: scarlets,
    away: opponent('demo-xv', 'Demo XV', 'DXV'),
    venue: parc,
    kickoffUtc: SIM_KICKOFF,
    kickoffProvisional: false,
    ticketing: 'link_out',
    note: tx('Simulated match against a synthetic opponent. Not a real fixture or score.'),
  },
  {
    id: EXAMPLE_FIXTURE_ID,
    squad: 'first_team',
    competition: URC,
    home: scarlets,
    away: opponent('connacht', 'Connacht', 'CON'),
    venue: parc,
    kickoffUtc: EXAMPLE_KICKOFF,
    kickoffProvisional: false,
    ticketing: 'link_out',
    note: tx(
      'Example fixture from the club listing as at 21 November 2026. Confirm date, time and tickets with the official site.',
    ),
  },
  {
    id: 'fx-demo-athletic-away',
    squad: 'first_team',
    competition: DEMO_COMP,
    home: opponent('demo-athletic', 'Demo Athletic', 'DAT'),
    away: scarlets,
    venue: awayGround,
    kickoffUtc: '2026-12-12T15:00:00Z',
    kickoffProvisional: true,
    ticketing: 'away',
  },
  {
    id: 'fx-sample-rfc-home',
    squad: 'first_team',
    competition: DEMO_COMP,
    home: scarlets,
    away: opponent('sample-rfc', 'Sample RFC', 'SRF'),
    venue: parc,
    kickoffUtc: '2026-12-19T17:30:00Z',
    kickoffProvisional: true,
    ticketing: 'not_on_sale',
  },
  {
    id: 'fx-women-u18-demo',
    squad: 'women',
    competition: DEMO_COMP,
    home: { ...scarlets, name: "Scarlets Women's U18", shortName: 'SCA' },
    away: opponent('demo-u18-w', 'Demo U18 XV', 'DXV'),
    venue: { name: 'Venue to be confirmed', city: '', timeZone: 'Europe/London' },
    kickoffUtc: '2026-12-06T14:00:00Z',
    kickoffProvisional: true,
    ticketing: 'not_on_sale',
  },
  {
    id: 'fx-u18-demo',
    squad: 'academy',
    competition: DEMO_COMP,
    home: { ...scarlets, name: 'Scarlets U18', shortName: 'SCA' },
    away: opponent('demo-u18', 'Demo U18 XV', 'DXV'),
    venue: { name: 'Venue to be confirmed', city: '', timeZone: 'Europe/London' },
    kickoffUtc: '2026-12-09T19:00:00Z',
    kickoffProvisional: true,
    ticketing: 'not_on_sale',
  },
];

/** A finished synthetic match with a final score and no event feed. */
export const staticResults: Record<string, { home: number; away: number }> = {
  'fx-demo-rovers-away': { home: 18, away: 24 },
};

export const seededAt = SEEDED_AT;

interface EventSeed {
  key: string;
  minute: number;
  type: MatchEventType;
  side: 'home' | 'away' | null;
  shirt?: number;
  replaced?: number;
  revision?: number;
  voided?: boolean;
  /** Real minutes after the event when this revision was published. */
  publishedAfter?: number;
}

/**
 * The simulated match: Scarlets 25, Demo XV 20. Players are identified by
 * shirt number only. No name is attached to any event, because none of this
 * happened.
 *
 * The 23rd-minute try is first credited to number 7 and then corrected to
 * number 8 two minutes later, to exercise the revision handling.
 */
const simEvents: EventSeed[] = [
  { key: 'ko', minute: 0, type: 'kick_off', side: null },
  { key: 'p1', minute: 4, type: 'penalty_goal', side: 'away', shirt: 10 },
  { key: 't1', minute: 11, type: 'try', side: 'home', shirt: 14 },
  { key: 'c1', minute: 12, type: 'conversion', side: 'home', shirt: 10 },
  { key: 'y1', minute: 19, type: 'yellow_card', side: 'away', shirt: 6 },
  { key: 't2', minute: 23, type: 'try', side: 'home', shirt: 7 },
  { key: 't2', minute: 23, type: 'try', side: 'home', shirt: 8, revision: 2, publishedAfter: 2 },
  { key: 'c2', minute: 24, type: 'conversion_missed', side: 'home', shirt: 10 },
  { key: 'p2', minute: 31, type: 'penalty_goal', side: 'home', shirt: 10 },
  { key: 't3', minute: 38, type: 'try', side: 'away', shirt: 11 },
  { key: 'c3', minute: 39, type: 'conversion', side: 'away', shirt: 10 },
  { key: 'ht', minute: 40, type: 'half_time', side: null },
  { key: 'sh', minute: 41, type: 'second_half', side: null },
  { key: 's1', minute: 48, type: 'substitution', side: 'home', shirt: 16, replaced: 2 },
  { key: 't4', minute: 52, type: 'try', side: 'away', shirt: 13 },
  { key: 'c4', minute: 53, type: 'conversion', side: 'away', shirt: 10 },
  { key: 'p3', minute: 58, type: 'penalty_goal', side: 'home', shirt: 10 },
  { key: 's2', minute: 62, type: 'substitution', side: 'home', shirt: 20, replaced: 6 },
  { key: 'p4', minute: 66, type: 'penalty_goal', side: 'away', shirt: 10 },
  { key: 's3', minute: 68, type: 'substitution', side: 'home', shirt: 22, replaced: 10 },
  { key: 't5', minute: 74, type: 'try', side: 'home', shirt: 20 },
  { key: 'c5', minute: 75, type: 'conversion', side: 'home', shirt: 22 },
  { key: 'ft', minute: 80, type: 'full_time', side: null },
];

const kickoffMs = new Date(SIM_KICKOFF).getTime();

export const simTimeline: MatchEvent[] = simEvents.map((e) => {
  const revision = e.revision ?? 1;
  const publishedMs = kickoffMs + (elapsedForMinute(e.minute) + (e.publishedAfter ?? 0)) * 60_000;
  return {
    id: `${SIM_FIXTURE_ID}:${e.key}:r${revision}`,
    fixtureId: SIM_FIXTURE_ID,
    providerEventId: `${SIM_FIXTURE_ID}:${e.key}`,
    type: e.type,
    minute: e.minute,
    side: e.side,
    shirtNumber: e.shirt,
    replacedShirtNumber: e.replaced,
    revision,
    voided: e.voided ?? false,
    sourceTimestamp: new Date(publishedMs).toISOString(),
  };
});

/** Real minutes after kick-off at which the simulated match ends. */
export const SIM_FULL_TIME_ELAPSED = elapsedForMinute(80);

const positions: LocalizedText[] = [
  tx('Loosehead prop', 'Prop pen rhydd'),
  tx('Hooker', 'Bachwr'),
  tx('Tighthead prop', 'Prop pen tynn'),
  tx('Lock', 'Clo'),
  tx('Lock', 'Clo'),
  tx('Blindside flanker', 'Blaenasgellwr ochr dywyll'),
  tx('Openside flanker', 'Blaenasgellwr ochr agored'),
  tx('Number 8', 'Wythwr'),
  tx('Scrum-half', 'Mewnwr'),
  tx('Fly-half', 'Maswr'),
  tx('Left wing', 'Asgellwr chwith'),
  tx('Inside centre', 'Canolwr mewnol'),
  tx('Outside centre', 'Canolwr allanol'),
  tx('Right wing', 'Asgellwr de'),
  tx('Full-back', 'Cefnwr'),
];
const replacement = tx('Replacement', 'Eilydd');

const player = (shirtNumber: number): LineupPlayer => ({
  shirtNumber,
  position: positions[shirtNumber - 1] ?? replacement,
  // Names come from the official team sheet only. The demo has none.
  name: null,
});

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

export function demoLineups(announced: boolean): Lineup[] {
  return (['home', 'away'] as const).map((side) => ({
    side,
    announced,
    starters: range(1, 15).map(player),
    replacements: range(16, 23).map(player),
  }));
}

export const simStats: MatchStat[] = [
  { id: 'possession', label: tx('Possession', 'Meddiant'), home: 54, away: 46, unit: 'percent' },
  { id: 'territory', label: tx('Territory', 'Tiriogaeth'), home: 57, away: 43, unit: 'percent' },
  { id: 'carries', label: tx('Carries', 'Cariadau'), home: 121, away: 104, unit: 'count' },
  {
    id: 'metres',
    label: tx('Metres made', 'Metrau a enillwyd'),
    home: 412,
    away: 365,
    unit: 'metres',
  },
  { id: 'tackles', label: tx('Tackles made', 'Taclau'), home: 142, away: 158, unit: 'count' },
  {
    id: 'lineouts',
    label: tx('Lineouts won', 'Leiniau a enillwyd'),
    home: 12,
    away: 10,
    unit: 'count',
  },
  { id: 'scrums', label: tx('Scrums won', 'Sgrymiau a enillwyd'), home: 7, away: 6, unit: 'count' },
  {
    id: 'penalties',
    label: tx('Penalties conceded', 'Ciciau cosb a ildiwyd'),
    home: 9,
    away: 11,
    unit: 'count',
  },
];
