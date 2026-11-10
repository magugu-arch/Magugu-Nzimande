import { z } from 'zod';
import { isoDateTime, provenanceSchema } from './provenance';

export const FIXTURE_STATUSES = [
  'scheduled',
  'live',
  'half_time',
  'completed',
  'postponed',
  'cancelled',
  'tbc',
] as const;
export const fixtureStatusSchema = z.enum(FIXTURE_STATUSES);
export type FixtureStatus = z.infer<typeof fixtureStatusSchema>;

export const teamRefSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1),
  /** True for a Kaizer Chiefs team (men's, women's, academy...). */
  isClub: z.boolean(),
  /** Path to an approved badge asset. Null until supplied. */
  badgePath: z.string().nullable(),
});
export type TeamRef = z.infer<typeof teamRefSchema>;

export const scoreSchema = z.object({
  home: z.number().int().min(0),
  away: z.number().int().min(0),
});

const NO_DEMO_SCORES =
  'Scores may only come from an authorised feed. Demo data must leave score null.';

export const fixtureSchema = z
  .object({
    id: z.string().min(1),
    competition: z.object({ id: z.string().min(1), name: z.string().min(1) }),
    home: teamRefSchema,
    away: teamRefSchema,
    /** Null when the provider has not confirmed a venue. */
    venue: z.string().nullable(),
    /** Null when the date is not yet confirmed. */
    kickoff: isoDateTime.nullable(),
    kickoffConfirmed: z.boolean(),
    status: fixtureStatusSchema,
    score: scoreSchema.nullable(),
    ticketingAvailable: z.boolean(),
    provenance: provenanceSchema,
  })
  .refine((f) => f.provenance.state !== 'demo' || f.score === null, {
    message: NO_DEMO_SCORES,
    path: ['score'],
  })
  .refine((f) => f.home.isClub || f.away.isClub, {
    message: 'A club fixture must include a Kaizer Chiefs team.',
  });
export type Fixture = z.infer<typeof fixtureSchema>;

export const MATCH_EVENT_TYPES = [
  'kick_off',
  'goal',
  'own_goal',
  'penalty_goal',
  'penalty_miss',
  'yellow_card',
  'red_card',
  'substitution',
  'var',
  'half_time',
  'full_time',
] as const;

export const matchEventSchema = z.object({
  id: z.string().min(1),
  minute: z.number().int().min(0).max(130),
  addedMinute: z.number().int().min(0).max(30).nullable(),
  type: z.enum(MATCH_EVENT_TYPES),
  side: z.enum(['home', 'away']).nullable(),
  playerId: z.string().nullable(),
  description: z.string().nullable(),
});
export type MatchEvent = z.infer<typeof matchEventSchema>;

export const lineupSchema = z.object({
  formation: z.string().nullable(),
  starting: z.array(z.object({ playerId: z.string(), name: z.string(), shirt: z.number().int() })),
  bench: z.array(z.object({ playerId: z.string(), name: z.string(), shirt: z.number().int() })),
});

export const MATCH_STAT_KEYS = [
  'possession',
  'shots',
  'shots_on_target',
  'corners',
  'fouls',
  'offsides',
] as const;
export type MatchStatKey = (typeof MATCH_STAT_KEYS)[number];

export const matchStatSchema = z.object({
  key: z.enum(MATCH_STAT_KEYS),
  home: z.number().min(0),
  away: z.number().min(0),
});

export const matchSchema = z
  .object({
    fixture: fixtureSchema,
    lineups: z.object({ home: lineupSchema, away: lineupSchema }).nullable(),
    events: z.array(matchEventSchema),
    stats: z.array(matchStatSchema).nullable(),
    minute: z.number().int().min(0).nullable(),
    provenance: provenanceSchema,
  })
  .refine(
    (m) =>
      m.provenance.state !== 'demo' ||
      (m.lineups === null && m.stats === null && m.events.length === 0),
    {
      message:
        'Line-ups, events and statistics may only come from an authorised feed, never demo data.',
    },
  );
export type Match = z.infer<typeof matchSchema>;

export const POSITIONS = ['goalkeeper', 'defender', 'midfielder', 'forward', 'staff'] as const;

export const playerSchema = z
  .object({
    id: z.string().min(1),
    teamId: z.string().min(1),
    displayName: z.string().min(1),
    shirtNumber: z.number().int().min(1).max(99).nullable(),
    position: z.enum(POSITIONS),
    /** Approved headshot path. Null until the club supplies one. */
    imagePath: z.string().nullable(),
    /** Approved biography. Null until the club supplies one. */
    bio: z.string().nullable(),
    provenance: provenanceSchema,
  })
  .refine((p) => p.provenance.state !== 'demo' || (p.imagePath === null && p.bio === null), {
    message: 'Demo players are placeholders: no likeness and no biography.',
  });
export type Player = z.infer<typeof playerSchema>;

export const TEAM_IDS = ['first-team', 'women', 'academy'] as const;
export type TeamId = (typeof TEAM_IDS)[number];

export const squadSchema = z.object({
  teamId: z.enum(TEAM_IDS),
  teamName: z.string(),
  players: z.array(playerSchema),
  provenance: provenanceSchema,
});
export type Squad = z.infer<typeof squadSchema>;

export const dateRangeSchema = z
  .object({ from: isoDateTime, to: isoDateTime })
  .refine((r) => new Date(r.from) <= new Date(r.to), { message: 'from must be before to' });
export type DateRange = z.infer<typeof dateRangeSchema>;

/** True when a fixture's state means a score may be on screen at all. */
export function scoreIsShowable(f: Fixture): boolean {
  return (
    f.score !== null &&
    f.provenance.state !== 'demo' &&
    (f.status === 'live' || f.status === 'half_time' || f.status === 'completed')
  );
}

/** Group fixtures by local calendar month label, preserving order. */
export function groupFixturesByMonth(
  fixtures: Fixture[],
  locale = 'en-ZA',
  timeZone = 'Africa/Johannesburg',
): { label: string; fixtures: Fixture[] }[] {
  const groups: { label: string; fixtures: Fixture[] }[] = [];
  for (const f of fixtures) {
    const label = f.kickoff
      ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone }).format(
          new Date(f.kickoff),
        )
      : 'Date to be confirmed';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.fixtures.push(f);
    else groups.push({ label, fixtures: [f] });
  }
  return groups;
}
