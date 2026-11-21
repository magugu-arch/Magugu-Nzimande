import { z } from 'zod';
import { localizedText } from './i18n';
import { venueDayKey } from './time';

export const squad = z.enum(['first_team', 'women', 'academy']);
export type Squad = z.infer<typeof squad>;

export const teamRef = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  isScarlets: z.boolean(),
});
export type TeamRef = z.infer<typeof teamRef>;

export const fixtureStatus = z.enum([
  'scheduled',
  'live',
  'half_time',
  'full_time',
  'postponed',
  'cancelled',
]);
export type FixtureStatus = z.infer<typeof fixtureStatus>;

/**
 * How a supporter can get a ticket. The app never sells one itself: the
 * ticketing provider stays the system of record.
 */
export const ticketingState = z.enum(['link_out', 'not_on_sale', 'away', 'unavailable']);
export type TicketingState = z.infer<typeof ticketingState>;

export const score = z.object({ home: z.number().int().min(0), away: z.number().int().min(0) });
export type Score = z.infer<typeof score>;

export const fixture = z.object({
  id: z.string(),
  providerId: z.string(),
  squad,
  competition: localizedText,
  round: z.string().optional(),
  home: teamRef,
  away: teamRef,
  venue: z.object({ name: z.string(), city: z.string(), timeZone: z.string() }),
  /** ISO 8601 UTC. Display converts to venue-local time. */
  kickoffUtc: z.string(),
  kickoffProvisional: z.boolean(),
  status: fixtureStatus,
  score: score.nullable(),
  ticketing: ticketingState,
  note: localizedText.optional(),
  updatedAt: z.string(),
  demo: z.boolean(),
});
export type Fixture = z.infer<typeof fixture>;

export const matchEventType = z.enum([
  'kick_off',
  'try',
  'conversion',
  'conversion_missed',
  'penalty_goal',
  'penalty_missed',
  'drop_goal',
  'yellow_card',
  'red_card',
  'substitution',
  'half_time',
  'second_half',
  'full_time',
]);
export type MatchEventType = z.infer<typeof matchEventType>;

export const matchEvent = z.object({
  id: z.string(),
  fixtureId: z.string(),
  /** Stable id from the provider: revisions of one event share it. */
  providerEventId: z.string(),
  type: matchEventType,
  minute: z.number().int().min(0),
  side: z.enum(['home', 'away']).nullable(),
  shirtNumber: z.number().int().min(1).max(23).optional(),
  replacedShirtNumber: z.number().int().min(1).max(23).optional(),
  /** Only ever set from the official team sheet. Never invented. */
  playerName: z.string().optional(),
  revision: z.number().int().min(1),
  /** A later revision can withdraw an event the provider published in error. */
  voided: z.boolean(),
  sourceTimestamp: z.string(),
});
export type MatchEvent = z.infer<typeof matchEvent>;

export const POINTS: Partial<Record<MatchEventType, number>> = {
  try: 5,
  conversion: 2,
  penalty_goal: 3,
  drop_goal: 3,
};

/**
 * Collapse provider revisions: the highest revision of each event wins, and a
 * voided event disappears. This is how a corrected try replaces a wrong one
 * without the timeline ever showing both.
 */
export function currentEvents(events: readonly MatchEvent[]): MatchEvent[] {
  const latest = new Map<string, MatchEvent>();
  for (const event of events) {
    const existing = latest.get(event.providerEventId);
    if (!existing || event.revision > existing.revision) latest.set(event.providerEventId, event);
  }
  return [...latest.values()]
    .filter((event) => !event.voided)
    .sort(
      (a, b) =>
        a.minute - b.minute ||
        a.sourceTimestamp.localeCompare(b.sourceTimestamp) ||
        a.providerEventId.localeCompare(b.providerEventId),
    );
}

export function scoreFromEvents(events: readonly MatchEvent[]): Score {
  const total: Score = { home: 0, away: 0 };
  for (const event of currentEvents(events)) {
    const points = POINTS[event.type];
    if (points && event.side) total[event.side] += points;
  }
  return total;
}

export const lineupPlayer = z.object({
  shirtNumber: z.number().int().min(1).max(23),
  position: localizedText,
  /** Null until the official team sheet is published. */
  name: z.string().nullable(),
});
export type LineupPlayer = z.infer<typeof lineupPlayer>;

export const lineup = z.object({
  side: z.enum(['home', 'away']),
  announced: z.boolean(),
  starters: z.array(lineupPlayer),
  replacements: z.array(lineupPlayer),
});
export type Lineup = z.infer<typeof lineup>;

export const matchStat = z.object({
  id: z.string(),
  label: localizedText,
  home: z.number(),
  away: z.number(),
  unit: z.enum(['count', 'percent', 'metres']),
});
export type MatchStat = z.infer<typeof matchStat>;

/**
 * Where the season is relative to a fixture. Home reorders its modules on
 * this, and Matchday picks its stage from it.
 */
export type MatchPhase =
  'no_fixture' | 'pre_match' | 'matchday' | 'live' | 'half_time' | 'full_time';

export function matchPhase(target: Fixture | null, now: Date): MatchPhase {
  if (!target) return 'no_fixture';
  if (target.status === 'live') return 'live';
  if (target.status === 'half_time') return 'half_time';
  if (target.status === 'full_time') return 'full_time';
  if (target.status !== 'scheduled') return 'pre_match';
  const sameDay =
    venueDayKey(now, target.venue.timeZone) ===
    venueDayKey(new Date(target.kickoffUtc), target.venue.timeZone);
  return sameDay ? 'matchday' : 'pre_match';
}

/** The next fixture that has not finished, soonest first. */
export function nextFixture(fixtures: readonly Fixture[], now: Date): Fixture | null {
  const upcoming = fixtures
    .filter(
      (f) =>
        f.status === 'live' ||
        f.status === 'half_time' ||
        (f.status === 'scheduled' &&
          new Date(f.kickoffUtc).getTime() > now.getTime() - 3 * 3_600_000),
    )
    .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  return upcoming[0] ?? null;
}

export function isResult(f: Fixture): boolean {
  return f.status === 'full_time';
}

export function opponentOf(f: Fixture): TeamRef {
  return f.home.isScarlets ? f.away : f.home;
}

export function isHomeFixture(f: Fixture): boolean {
  return f.home.isScarlets;
}

export const HOME_MODULES = [
  'match_pulse',
  'quick_links',
  'stories',
  'planner',
  'passport',
  'fan_prompt',
  'partner',
] as const;
export type HomeModule = (typeof HOME_MODULES)[number];

/**
 * Home is a front door that changes with the day: planning before a match,
 * the score during it, the story after it. Two rules hold in every phase:
 * there is at most one partner module, and it is never the first thing shown.
 */
export function homeModuleOrder(phase: MatchPhase): HomeModule[] {
  switch (phase) {
    case 'no_fixture':
      return ['stories', 'quick_links', 'passport', 'partner'];
    case 'pre_match':
      return [
        'quick_links',
        'match_pulse',
        'stories',
        'planner',
        'passport',
        'fan_prompt',
        'partner',
      ];
    case 'matchday':
      return [
        'planner',
        'quick_links',
        'match_pulse',
        'fan_prompt',
        'stories',
        'passport',
        'partner',
      ];
    case 'live':
    case 'half_time':
      return ['match_pulse', 'fan_prompt', 'quick_links', 'stories', 'partner', 'passport'];
    case 'full_time':
      return ['match_pulse', 'stories', 'fan_prompt', 'passport', 'quick_links', 'partner'];
  }
}
