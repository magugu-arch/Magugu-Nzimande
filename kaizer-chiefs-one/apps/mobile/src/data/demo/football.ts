import {
  fixtureSchema,
  matchSchema,
  ok,
  squadSchema,
  unavailable,
  type Fixture,
  type MatchDataProvider,
  type Player,
  type Squad,
  type TeamId,
} from '@kc-one/contracts';
import { demoProvenance, latency } from './common';

/**
 * Demo fixtures exist to exercise layout and state, not to look real:
 * opponents are lettered placeholders, dates and venues are unconfirmed, and
 * no fixture carries a score. The contract rejects a demo score outright.
 */
const club = { teamId: 'kc-first', name: 'Kaizer Chiefs', isClub: true, badgePath: null };
const opponent = (letter: string) => ({
  teamId: `demo-opp-${letter.toLowerCase()}`,
  name: `Opponent ${letter}`,
  isClub: false,
  badgePath: null,
});
const competition = { id: 'demo-comp', name: 'Competition name (demo)' };

function fixture(
  id: string,
  letter: string,
  home: boolean,
  status: Fixture['status'],
  ticketingAvailable = false,
): Fixture {
  return fixtureSchema.parse({
    id,
    competition,
    home: home ? club : opponent(letter),
    away: home ? opponent(letter) : club,
    venue: null,
    kickoff: null,
    kickoffConfirmed: false,
    status,
    score: null,
    ticketingAvailable,
    provenance: demoProvenance(id),
  });
}

const fixtures: Fixture[] = [
  fixture('demo-fx-1', 'A', true, 'scheduled', true),
  fixture('demo-fx-2', 'B', false, 'scheduled'),
  fixture('demo-fx-3', 'C', true, 'tbc'),
  fixture('demo-fx-4', 'D', false, 'postponed'),
];

const results: Fixture[] = [
  fixture('demo-rs-1', 'E', true, 'completed'),
  fixture('demo-rs-2', 'F', false, 'completed'),
];

const TEAMS: Record<TeamId, string> = {
  'first-team': 'First team',
  women: 'Women',
  academy: 'Academy',
};

const POSITION_COUNTS: [Player['position'], number][] = [
  ['goalkeeper', 2],
  ['defender', 4],
  ['midfielder', 4],
  ['forward', 3],
];

function squad(teamId: TeamId): Squad {
  const players: Player[] = [];
  for (const [position, n] of POSITION_COUNTS) {
    for (let i = 1; i <= n; i++) {
      players.push({
        id: `demo-${teamId}-${position}-${i}`,
        teamId,
        displayName: 'Player name',
        shirtNumber: null,
        position,
        imagePath: null,
        bio: null,
        provenance: demoProvenance(),
      });
    }
  }
  return squadSchema.parse({
    teamId,
    teamName: TEAMS[teamId],
    players,
    provenance: demoProvenance(),
  });
}

export const demoMatchData: MatchDataProvider = {
  async getFixtures() {
    return latency(ok([...fixtures, ...results], demoProvenance()));
  },
  async getMatch(matchId) {
    const f = [...fixtures, ...results].find((x) => x.id === matchId);
    if (!f) return latency(unavailable('error', 'That match is not available.'));
    const match = matchSchema.parse({
      fixture: f,
      lineups: null,
      events: [],
      stats: null,
      minute: null,
      provenance: demoProvenance(matchId),
    });
    return latency(ok(match, match.provenance));
  },
  async getSquad(teamId) {
    const s = squad(teamId);
    return latency(ok(s, s.provenance));
  },
};

export function findDemoPlayer(id: string): Player | null {
  for (const t of Object.keys(TEAMS) as TeamId[]) {
    const p = squad(t).players.find((x) => x.id === id);
    if (p) return p;
  }
  return null;
}
