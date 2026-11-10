import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { scoreIsShowable, type Fixture } from '@kc-one/contracts';
import { BadgeSlot, Card, CrestSlot, DemoTag, Pill, Text } from '@/components';
import { color, space } from '@/theme';

const STATUS: Record<
  Fixture['status'],
  { label: string; tone: 'neutral' | 'live' | 'accent' | 'outline' | 'danger' }
> = {
  scheduled: { label: 'Scheduled', tone: 'outline' },
  tbc: { label: 'To be confirmed', tone: 'outline' },
  live: { label: 'Live', tone: 'live' },
  half_time: { label: 'Half time', tone: 'live' },
  completed: { label: 'Full time', tone: 'neutral' },
  postponed: { label: 'Postponed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export function kickoffParts(f: Fixture) {
  if (!f.kickoff) return { day: 'Date', date: 'TBC', month: '', time: 'Time TBC' };
  const d = new Date(f.kickoff);
  const tz = 'Africa/Johannesburg';
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-ZA', { ...o, timeZone: tz }).format(d);
  return {
    day: fmt({ weekday: 'short' }).toUpperCase(),
    date: fmt({ day: '2-digit' }),
    month: fmt({ month: 'short' }).toUpperCase(),
    time: f.kickoffConfirmed ? fmt({ hour: '2-digit', minute: '2-digit' }) : 'Time TBC',
  };
}

export function scoreText(f: Fixture): string | null {
  if (!scoreIsShowable(f) || !f.score) return null;
  return `${f.score.home} – ${f.score.away}`;
}

/** Fixture row after the concept's card: date block, teams, H/A, ticket action. */
export function FixtureCard({ fixture }: { fixture: Fixture }) {
  const router = useRouter();
  const k = kickoffParts(fixture);
  const isHome = fixture.home.isClub;
  const opponent = isHome ? fixture.away : fixture.home;
  const score = scoreText(fixture);
  const status = STATUS[fixture.status];
  const demo = fixture.provenance.state === 'demo';
  const label = `${fixture.home.name} versus ${fixture.away.name}. ${fixture.competition.name}. ${
    fixture.kickoff ? `${k.day} ${k.date} ${k.month}, ${k.time}` : 'Date to be confirmed'
  }. ${status.label}.${score ? ` Score ${score}.` : ''}${demo ? ' Demo fixture.' : ''}`;

  return (
    <Card
      padded={false}
      onPress={() => router.push(`/match/${fixture.id}`)}
      accessibilityLabel={label}
      accessibilityHint="Opens the Match Centre"
    >
      <View style={styles.row}>
        <View style={styles.date}>
          <Text variant="micro" color="textTertiary">
            {k.day}
          </Text>
          <Text variant="data" style={styles.dateNum}>
            {k.date}
          </Text>
          <Text variant="micro" color="textTertiary">
            {k.month}
          </Text>
        </View>
        <View style={styles.mid}>
          <View style={styles.badges}>
            <CrestSlot size={30} />
            <Text variant="micro" color="accent">
              {score ?? 'VS'}
            </Text>
            <BadgeSlot size={26} />
          </View>
          <Text variant="headline" numberOfLines={1} style={styles.opp}>
            {opponent.name.toUpperCase()}
          </Text>
          <Text variant="micro" color="accent" numberOfLines={1}>
            {fixture.competition.name}
          </Text>
        </View>
        <View style={styles.side}>
          <View style={[styles.ha, isHome ? styles.haHome : styles.haAway]}>
            <Text variant="headline" style={{ color: isHome ? color.onAccent : color.text }}>
              {isHome ? 'H' : 'A'}
            </Text>
          </View>
          <Text variant="data" style={{ fontSize: 15 }} numberOfLines={1}>
            {k.time}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Pill label={status.label} tone={status.tone} />
        {fixture.status === 'completed' && !score ? (
          <Text variant="micro" color="textTertiary">
            Result from match feed
          </Text>
        ) : null}
        <View style={{ flex: 1 }} />
        {demo ? <DemoTag /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.lg },
  date: {
    width: 54,
    alignItems: 'center',
    gap: 2,
    paddingRight: space.lg,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: color.line,
  },
  dateNum: { fontSize: 28, lineHeight: 30, fontFamily: 'BarlowCondensed_700Bold' },
  mid: { flex: 1, alignItems: 'center', gap: space.xs },
  badges: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  opp: { letterSpacing: 1.2 },
  side: { alignItems: 'center', gap: space.sm, width: 64 },
  ha: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haHome: { backgroundColor: color.accent },
  haAway: { borderWidth: 1, borderColor: color.accent },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
});
