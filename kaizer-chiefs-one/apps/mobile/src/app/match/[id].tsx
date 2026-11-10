import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { MATCH_STAT_KEYS, MAX_AGE_MS, type Match, type MatchStatKey } from '@kc-one/contracts';
import {
  BackHeader,
  BadgeSlot,
  Button,
  Card,
  CrestSlot,
  DemoTag,
  Notice,
  Pill,
  ProvenanceLine,
  QueryState,
  Screen,
  SegmentedControl,
  Text,
} from '@/components';
import { useMatch } from '@/data/queries';
import { kickoffParts, scoreText } from '@/features/football/FixtureCard';
import { color, radius, space } from '@/theme';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'lineups', label: 'Line-ups' },
  { value: 'stats', label: 'Stats' },
] as const;
type Tab = (typeof TABS)[number]['value'];

const STAT_LABEL: Record<MatchStatKey, string> = {
  possession: 'Possession',
  shots: 'Shots',
  shots_on_target: 'Shots on target',
  corners: 'Corners',
  fouls: 'Fouls',
  offsides: 'Offsides',
};

/**
 * Match Centre. Every number on this screen comes from the authorised feed.
 * Without one, the layout holds its shape with dashes and says why, exactly
 * as the concept screen does, rather than showing anything invented.
 */
export default function MatchCentre() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useMatch(id);
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <Screen topInset={false} header={<BackHeader title="Match Centre" />}>
      <QueryState query={q}>
        {(match) => (
          <View style={{ gap: space.xl }}>
            <Scoreboard match={match} />
            <SegmentedControl
              options={TABS}
              value={tab}
              onChange={setTab}
              accessibilityLabel="Match Centre sections"
            />
            {tab === 'overview' ? <Overview match={match} /> : null}
            {tab === 'timeline' ? <Timeline match={match} /> : null}
            {tab === 'lineups' ? <Lineups match={match} /> : null}
            {tab === 'stats' ? <Stats match={match} /> : null}
            <ProvenanceLine
              provenance={match.provenance}
              maxAgeMs={MAX_AGE_MS.liveMatch}
              sourceLabel="Match feed"
            />
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

function Scoreboard({ match }: { match: Match }) {
  const router = useRouter();
  const f = match.fixture;
  const k = kickoffParts(f);
  const score = scoreText(f);
  const live = f.status === 'live' && match.provenance.state === 'live';
  return (
    <View style={styles.board}>
      <View style={styles.boardTop}>
        <Text variant="micro" color="accent" style={{ flex: 1 }}>
          {f.competition.name}
        </Text>
        {live ? <Pill label="● Live" tone="live" /> : null}
        {match.provenance.state === 'demo' ? <DemoTag /> : null}
      </View>
      <View style={styles.teams}>
        <View style={styles.team}>
          {f.home.isClub ? <CrestSlot size={64} /> : <BadgeSlot size={52} />}
          <Text variant="headline" align="center" numberOfLines={2} style={styles.teamName}>
            {f.home.name.toUpperCase()}
          </Text>
        </View>
        <View
          style={styles.scoreCol}
          accessible
          accessibilityLabel={score ? `Score ${score}` : 'Score not available'}
        >
          <Text variant="score" color={score ? 'text' : 'textTertiary'}>
            {score ?? '–  –'}
          </Text>
          {score ? (
            <Text variant="micro" color="textTertiary">
              {live && match.minute !== null ? `${match.minute}′` : 'Full time'}
            </Text>
          ) : null}
        </View>
        <View style={styles.team}>
          {f.away.isClub ? <CrestSlot size={64} /> : <BadgeSlot size={52} />}
          <Text variant="headline" align="center" numberOfLines={2} style={styles.teamName}>
            {f.away.name.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.meta}>
        {!score ? (
          <Text variant="micro" color="textTertiary">
            Score from the official match feed
          </Text>
        ) : null}
        <Text variant="footnote" color="textSecondary">
          {f.kickoff
            ? `${k.day} ${k.date} ${k.month} · ${k.time}`
            : 'Date and time to be confirmed'}
        </Text>
        <Text variant="footnote" color="textTertiary">
          {f.venue ?? 'Venue to be confirmed'}
        </Text>
      </View>
      {f.ticketingAvailable && f.status === 'scheduled' ? (
        <Button label="Get tickets" icon="ticket-outline" onPress={() => router.push('/tickets')} />
      ) : null}
    </View>
  );
}

function Overview({ match }: { match: Match }) {
  return (
    <View style={{ gap: space.lg }}>
      <Card style={styles.ivory}>
        <View style={styles.ivoryHead}>
          <Text variant="labelSmall" style={{ color: color.textInverse }}>
            Formation
          </Text>
          <Text variant="data" style={{ color: color.textInverse }}>
            {match.lineups?.home.formation ?? '–'}
          </Text>
        </View>
        <Pitch />
        {!match.lineups ? (
          <Text
            variant="footnote"
            align="center"
            style={{ color: color.textInverseSecondary, marginTop: space.md }}
          >
            Line-ups appear about an hour before kick-off, from the official feed.
          </Text>
        ) : null}
      </Card>
      <Timeline match={match} compact />
    </View>
  );
}

function Pitch() {
  const line = 'rgba(16,16,16,0.22)';
  return (
    <View
      style={{ aspectRatio: 1.6, marginTop: space.md }}
      accessibilityLabel="Pitch diagram"
      accessible
    >
      <Svg width="100%" height="100%" viewBox="0 0 160 100">
        <Rect x="1" y="1" width="158" height="98" stroke={line} strokeWidth="0.8" fill="none" />
        <Line x1="80" y1="1" x2="80" y2="99" stroke={line} strokeWidth="0.8" />
        <Circle cx="80" cy="50" r="12" stroke={line} strokeWidth="0.8" fill="none" />
        <Rect x="1" y="26" width="22" height="48" stroke={line} strokeWidth="0.8" fill="none" />
        <Rect x="137" y="26" width="22" height="48" stroke={line} strokeWidth="0.8" fill="none" />
        <Rect x="1" y="39" width="8" height="22" stroke={line} strokeWidth="0.8" fill="none" />
        <Rect x="151" y="39" width="8" height="22" stroke={line} strokeWidth="0.8" fill="none" />
      </Svg>
    </View>
  );
}

function Timeline({ match, compact }: { match: Match; compact?: boolean }) {
  return (
    <Card style={styles.ivory}>
      <Text variant="labelSmall" style={{ color: color.textInverse }}>
        Match timeline
      </Text>
      <View style={styles.trackLabels}>
        {['KO', 'HT', 'FT'].map((l) => (
          <Text key={l} variant="data" style={{ color: color.textInverse, fontSize: 15 }}>
            {l}
          </Text>
        ))}
      </View>
      <View style={styles.track}>
        <View style={styles.trackLine} />
        {[0, 50, 100].map((p) => (
          <View key={p} style={[styles.node, { left: `${p}%` }]} />
        ))}
        {match.events.map((e) => (
          <View
            key={e.id}
            style={[styles.event, { left: `${Math.min(100, (e.minute / 90) * 100)}%` }]}
          />
        ))}
      </View>
      {match.events.length === 0 && !compact ? (
        <Text variant="footnote" style={{ color: color.textInverseSecondary }}>
          Goals, cards and substitutions appear here live from the match feed.
        </Text>
      ) : null}
      {match.events.map((e) => (
        <Text key={e.id} variant="footnote" style={{ color: color.textInverse }}>
          {e.minute}′ · {e.type.replace(/_/g, ' ')} {e.description ? `· ${e.description}` : ''}
        </Text>
      ))}
    </Card>
  );
}

function Lineups({ match }: { match: Match }) {
  if (!match.lineups) {
    return (
      <Notice
        reason="integration_pending"
        title="Line-ups not published"
        body="Starting XIs and benches come from the official feed when the club releases them."
      />
    );
  }
  const side = (label: string, l: NonNullable<Match['lineups']>['home']) => (
    <Card style={{ gap: space.sm, flex: 1 }}>
      <Text variant="labelSmall" color="accent">
        {label}
      </Text>
      {l.starting.map((p) => (
        <Text key={p.playerId} variant="footnote">
          {p.shirt} {p.name}
        </Text>
      ))}
    </Card>
  );
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      {side(match.fixture.home.name, match.lineups.home)}
      {side(match.fixture.away.name, match.lineups.away)}
    </View>
  );
}

function Stats({ match }: { match: Match }) {
  const byKey = new Map((match.stats ?? []).map((s) => [s.key, s]));
  const possession = byKey.get('possession');
  return (
    <Card style={[styles.ivory, { gap: space.md }]}>
      <Text variant="labelSmall" style={{ color: color.textInverse }}>
        Possession
      </Text>
      <View style={styles.possRow}>
        <Text variant="data" style={{ color: color.textInverse, width: 48 }}>
          {possession ? `${possession.home}%` : '--%'}
        </Text>
        <View style={styles.possBar}>
          {possession ? (
            <>
              <View style={{ flex: possession.home, backgroundColor: color.bg }} />
              <View style={{ flex: possession.away, backgroundColor: color.accent }} />
            </>
          ) : (
            <View style={{ flex: 1, backgroundColor: 'rgba(16,16,16,0.12)' }} />
          )}
        </View>
        <Text variant="data" style={{ color: color.textInverse, width: 48, textAlign: 'right' }}>
          {possession ? `${possession.away}%` : '--%'}
        </Text>
      </View>
      {MATCH_STAT_KEYS.filter((k) => k !== 'possession').map((k) => {
        const s = byKey.get(k);
        return (
          <View
            key={k}
            style={styles.statRow}
            accessible
            accessibilityLabel={`${STAT_LABEL[k]}: ${s ? `${s.home} to ${s.away}` : 'not available'}`}
          >
            <Text variant="data" style={{ color: color.textInverse, width: 40 }}>
              {s?.home ?? '--'}
            </Text>
            <Text
              variant="labelSmall"
              style={{ color: color.textInverseSecondary, flex: 1, textAlign: 'center' }}
            >
              {STAT_LABEL[k]}
            </Text>
            <Text
              variant="data"
              style={{ color: color.textInverse, width: 40, textAlign: 'right' }}
            >
              {s?.away ?? '--'}
            </Text>
          </View>
        );
      })}
      {!match.stats ? (
        <Text variant="footnote" style={{ color: color.textInverseSecondary }}>
          Statistics come only from the licensed match data provider.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  board: {
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.bgRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.lineAccent,
  },
  boardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  teams: { flexDirection: 'row', alignItems: 'center' },
  team: { flex: 1, alignItems: 'center', gap: space.sm },
  teamName: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 19,
    lineHeight: 21,
    letterSpacing: 0.6,
  },
  scoreCol: { width: 100, alignItems: 'center', gap: space.xs },
  meta: { alignItems: 'center', gap: 2 },
  ivory: { backgroundColor: color.surfaceInverse, borderColor: color.accentMuted, gap: space.sm },
  ivoryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  track: { height: 24, justifyContent: 'center', marginHorizontal: 6 },
  trackLine: { height: 2, backgroundColor: color.textInverse },
  node: {
    position: 'absolute',
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: color.textInverseSecondary,
    backgroundColor: color.surfaceInverse,
  },
  event: {
    position: 'absolute',
    width: 10,
    height: 10,
    marginLeft: -5,
    borderRadius: 5,
    backgroundColor: color.accent,
  },
  possRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  possBar: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row' },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(16,16,16,0.14)',
  },
});
