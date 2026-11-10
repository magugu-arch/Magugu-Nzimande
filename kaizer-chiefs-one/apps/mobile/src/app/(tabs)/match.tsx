import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  groupFixturesByMonth,
  MAX_AGE_MS,
  POSITIONS,
  type Fixture,
  type Player,
  type TeamId,
} from '@kc-one/contracts';
import {
  AppHeader,
  Chips,
  DemoTag,
  EmptyState,
  Eyebrow,
  Headline,
  LoadingBlock,
  PressableScale,
  ProvenanceLine,
  QueryState,
  Screen,
  SegmentedControl,
  Text,
} from '@/components';
import { useFixtures, useSquad } from '@/data/queries';
import { FixtureCard } from '@/features/football/FixtureCard';
import { color, radius, space } from '@/theme';

type View_ = 'fixtures' | 'results' | 'squad';
const VIEWS = [
  { value: 'fixtures', label: 'Fixtures' },
  { value: 'results', label: 'Results' },
  { value: 'squad', label: 'Squad' },
] as const;

export default function Match() {
  // The section lives in the URL, so a deep link or quick link can open it.
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const view: View_ =
    params.view === 'squad' || params.view === 'results' ? params.view : 'fixtures';
  const setView = (v: View_) => router.setParams({ view: v });

  return (
    <Screen inTabs topInset={false} header={<AppHeader subline="Fixtures · Results · Squad" />}>
      <View style={{ gap: space.xl }}>
        <Eyebrow>Matchday</Eyebrow>
        <Headline lead="Follow" accent="the team." size="display" />
        <SegmentedControl
          options={VIEWS}
          value={view}
          onChange={setView}
          accessibilityLabel="Match sections"
        />
        {view === 'squad' ? <SquadView /> : <FixturesView results={view === 'results'} />}
      </View>
    </Screen>
  );
}

function FixturesView({ results }: { results: boolean }) {
  const q = useFixtures();
  const [venue, setVenue] = useState<'all' | 'home' | 'away'>('all');
  return (
    <View style={{ gap: space.lg }}>
      <Chips
        options={[
          { value: 'all', label: 'All' },
          { value: 'home', label: 'Home' },
          { value: 'away', label: 'Away' },
        ]}
        value={venue}
        onChange={setVenue}
        accessibilityLabel="Filter by venue"
      />
      <QueryState query={q} loading={<LoadingBlock lines={2} />}>
        {(all, provenance) => (
          <FixtureList
            fixtures={all.filter((f) => {
              const done = f.status === 'completed' || f.status === 'cancelled';
              if (results !== done) return false;
              if (venue === 'home') return f.home.isClub;
              if (venue === 'away') return f.away.isClub;
              return true;
            })}
            results={results}
            footer={
              <ProvenanceLine
                provenance={provenance}
                maxAgeMs={MAX_AGE_MS.fixtures}
                sourceLabel="Match feed"
              />
            }
          />
        )}
      </QueryState>
    </View>
  );
}

function FixtureList({
  fixtures,
  results,
  footer,
}: {
  fixtures: Fixture[];
  results: boolean;
  footer: React.ReactNode;
}) {
  const groups = useMemo(() => groupFixturesByMonth(fixtures), [fixtures]);
  if (fixtures.length === 0) {
    return (
      <EmptyState
        icon="calendar-outline"
        title={results ? 'No results yet' : 'No fixtures to show'}
        body="Only fixtures published by the club's match data provider appear here."
      />
    );
  }
  return (
    <View style={{ gap: space.xl }}>
      {groups.map((g) => (
        <View key={g.label} style={{ gap: space.md }}>
          <Text variant="eyebrow" color="textTertiary">
            {g.label}
          </Text>
          {g.fixtures.map((f) => (
            <FixtureCard key={f.id} fixture={f} />
          ))}
        </View>
      ))}
      {footer}
    </View>
  );
}

const TEAMS = [
  { value: 'first-team', label: 'First team' },
  { value: 'women', label: 'Women' },
  { value: 'academy', label: 'Academy' },
] as const;

const POSITION_LABEL: Record<Player['position'], string> = {
  goalkeeper: 'Goalkeepers',
  defender: 'Defenders',
  midfielder: 'Midfielders',
  forward: 'Forwards',
  staff: 'Staff',
};

function SquadView() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamId>('first-team');
  const q = useSquad(team);
  return (
    <View style={{ gap: space.lg }}>
      <Chips options={TEAMS} value={team} onChange={setTeam} accessibilityLabel="Team" />
      <QueryState query={q} loading={<LoadingBlock lines={2} />}>
        {(squad, provenance) => (
          <View style={{ gap: space.xl }}>
            {provenance.state === 'demo' ? (
              <View style={styles.squadNote}>
                <DemoTag kind="SAMPLE" />
                <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
                  Placeholder profiles. Names, photos, numbers and biographies come only from the
                  club’s approved roster.
                </Text>
              </View>
            ) : null}
            {POSITIONS.filter((p) => squad.players.some((x) => x.position === p)).map((pos) => (
              <View key={pos} style={{ gap: space.md }}>
                <Text variant="eyebrow" color="textTertiary">
                  {POSITION_LABEL[pos]}
                </Text>
                <View style={styles.grid}>
                  {squad.players
                    .filter((p) => p.position === pos)
                    .map((p) => (
                      <PressableScale
                        key={p.id}
                        onPress={() => router.push(`/squad/${p.id}`)}
                        accessibilityLabel={`${p.displayName}${p.provenance.state === 'demo' ? ', placeholder profile' : ''}`}
                        style={styles.player}
                        pressedScale={0.96}
                      >
                        <View style={styles.silhouette}>
                          <Ionicons name="person" size={40} color={color.surfaceHigh} />
                        </View>
                        <View style={{ padding: space.sm, gap: 2 }}>
                          <Text variant="data" color="accent" style={{ fontSize: 16 }}>
                            {p.shirtNumber ?? '—'}
                          </Text>
                          <Text variant="footnote" numberOfLines={1}>
                            {p.displayName}
                          </Text>
                        </View>
                      </PressableScale>
                    ))}
                </View>
              </View>
            ))}
            <ProvenanceLine
              provenance={provenance}
              maxAgeMs={MAX_AGE_MS.squad}
              sourceLabel="Club roster"
            />
          </View>
        )}
      </QueryState>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  player: {
    width: '31.8%',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  silhouette: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: color.bgRaised,
  },
  squadNote: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    padding: space.md,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineStrong,
  },
});
