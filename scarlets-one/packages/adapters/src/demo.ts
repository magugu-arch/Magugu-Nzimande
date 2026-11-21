import { tx, type LocalizedText } from '@scarlets/domain';

/**
 * Demo scenarios.
 *
 * The demo runs on its own clock so it works on any day of the year: each
 * scenario pins "now" to a moment relative to a seeded fixture, then lets
 * time run forward from there at normal speed. A countdown still ticks, and
 * the simulated match still advances, but the demo never goes out of date.
 */
export const scenarioIds = [
  'pre_match',
  'matchday',
  'live',
  'half_time',
  'full_time',
  'off_season',
] as const;
export type ScenarioId = (typeof scenarioIds)[number];

export interface Scenario {
  id: ScenarioId;
  label: LocalizedText;
  description: LocalizedText;
  /** The instant the demo clock starts from, ISO UTC. */
  startsAt: string;
}

/** Kick-off of the fully simulated demo match (synthetic opponent). */
export const SIM_KICKOFF = '2026-11-14T15:00:00Z';
/** Kick-off of the example fixture named in the brief. */
export const EXAMPLE_KICKOFF = '2026-12-05T17:00:00Z';

export const scenarios: Record<ScenarioId, Scenario> = {
  pre_match: {
    id: 'pre_match',
    label: tx('Two weeks out', 'Pythefnos i fynd'),
    description: tx('A normal week: the next home match is a fortnight away.'),
    startsAt: '2026-11-21T10:00:00Z',
  },
  matchday: {
    id: 'matchday',
    label: tx('Matchday morning', 'Bore diwrnod gêm'),
    description: tx('The day of the match, a few hours before kick-off.'),
    startsAt: '2026-12-05T13:30:00Z',
  },
  live: {
    id: 'live',
    label: tx('Live: first half', 'Yn fyw: hanner cyntaf'),
    description: tx('A simulated match in progress against a synthetic opponent.'),
    startsAt: '2026-11-14T15:27:10Z',
  },
  half_time: {
    id: 'half_time',
    label: tx('Half-time', 'Hanner amser'),
    description: tx('The simulated match at the break.'),
    startsAt: '2026-11-14T15:46:00Z',
  },
  full_time: {
    id: 'full_time',
    label: tx('Full time', 'Amser llawn'),
    description: tx('Just after the final whistle of the simulated match.'),
    startsAt: '2026-11-14T16:40:00Z',
  },
  off_season: {
    id: 'off_season',
    label: tx('No fixture', 'Dim gêm'),
    description: tx('Between seasons: no upcoming fixture has been published.'),
    startsAt: '2027-07-01T10:00:00Z',
  },
};

export interface DemoControls {
  scenario: ScenarioId;
  /** Live scoring feed: healthy, running behind, or down. */
  liveFeed: 'ok' | 'delayed' | 'down';
  ticketing: 'ok' | 'down';
  rewards: 'ok' | 'down';
  network: 'online' | 'offline';
  /** Added to every mock call. Zero by default: latency is not a feature. */
  latencyMs: number;
}

export const defaultControls: DemoControls = {
  scenario: 'pre_match',
  liveFeed: 'ok',
  ticketing: 'ok',
  rewards: 'ok',
  network: 'online',
  latencyMs: 0,
};

export interface DemoClock {
  now(): Date;
}

/**
 * @param scenario   which moment to start from
 * @param startedAt  real wall-clock ms when the scenario was selected
 * @param wallNow    injectable for tests
 */
export function createDemoClock(
  scenario: ScenarioId,
  startedAt: number,
  wallNow: () => number = Date.now,
): DemoClock {
  const base = new Date(scenarios[scenario].startsAt).getTime();
  return { now: () => new Date(base + Math.max(0, wallNow() - startedAt)) };
}

/**
 * Real minutes since kick-off for a match minute: 40-minute halves with a
 * 15-minute break, so the second half starts 55 minutes after kick-off.
 */
export function elapsedForMinute(minute: number): number {
  return minute <= 40 ? minute : minute + 15;
}
