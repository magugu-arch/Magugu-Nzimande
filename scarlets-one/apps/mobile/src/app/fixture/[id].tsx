import type { MatchCentrePayload } from '@scarlets/api-client';
import {
  POINTS,
  currentEvents,
  isHomeFixture,
  type Lineup,
  type MatchEvent,
  type MatchStat,
} from '@scarlets/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DataStamp, PlacementTag, Tag } from '@/components/Chips';
import { Icon, type IconName } from '@/components/Icon';
import { Page } from '@/components/Page';
import { Photo } from '@/components/Photo';
import { RowGroup } from '@/components/Rows';
import { Segmented } from '@/components/Segmented';
import { ErrorState, Notice, SkeletonList, SourceNotice } from '@/components/States';
import { Text } from '@/components/Text';
import { useMatchCentre } from '@/data/queries';
import { kickoff } from '@/features/format';
import { useL, useLocale, useT, type MessageKey } from '@/i18n';
import { track } from '@/lib/analytics';
import { openOfficial } from '@/lib/links';
import { radius, space, useTheme } from '@/theme';

type Tab = 'timeline' | 'lineups' | 'stats' | 'report';

const EVENT_ICON: Record<MatchEvent['type'], IconName> = {
  kick_off: 'play',
  try: 'american-football',
  conversion: 'checkmark-circle',
  conversion_missed: 'close-circle-outline',
  penalty_goal: 'checkmark-circle',
  penalty_missed: 'close-circle-outline',
  drop_goal: 'checkmark-circle',
  yellow_card: 'square',
  red_card: 'square',
  substitution: 'swap-horizontal',
  half_time: 'pause',
  second_half: 'play',
  full_time: 'flag',
};

function Timeline({ centre }: { centre: MatchCentrePayload }) {
  const t = useT();
  const theme = useTheme();
  const fixture = centre.fixture.data;
  const published = centre.timeline.data;
  if (!fixture) return null;
  if (published === null) {
    return <SourceNotice meta={centre.timeline.meta} fallback={t('centre.timeline.pre')} />;
  }
  if (published.length === 0) {
    return (
      <Notice icon="time-outline" body={t('centre.timeline.pre')} meta={centre.timeline.meta} />
    );
  }
  const events = currentEvents(published);
  // Running score after each event, so a scoring row can show where it left the match.
  let home = 0;
  let away = 0;
  const rows = events.map((event) => {
    const points = POINTS[event.type] ?? 0;
    if (points && event.side === 'home') home += points;
    if (points && event.side === 'away') away += points;
    return { event, points, score: `${home}–${away}` };
  });
  // Newest first while the match is on; in order once it is over.
  const ordered = fixture.status === 'full_time' ? rows : [...rows].reverse();

  return (
    <View style={{ gap: space.md }}>
      <DataStamp meta={centre.timeline.meta} showNotice />
      <RowGroup>
        {ordered.map(({ event, points, score }) => {
          const team =
            event.side === 'home'
              ? fixture.home.name
              : event.side === 'away'
                ? fixture.away.name
                : null;
          const ours = event.side ? (event.side === 'home') === fixture.home.isScarlets : false;
          const who =
            event.type === 'substitution' && event.shirtNumber && event.replacedShirtNumber
              ? t('centre.sub', { on: event.shirtNumber, off: event.replacedShirtNumber })
              : event.shirtNumber
                ? t('centre.shirt', { n: event.shirtNumber })
                : null;
          const tint =
            event.type === 'yellow_card'
              ? '#D9A400'
              : event.type === 'red_card'
                ? theme.accent
                : ours
                  ? theme.accentText
                  : theme.textSecondary;
          const name = t(`event.${event.type}` as MessageKey);
          return (
            <View
              key={event.id}
              accessible
              accessibilityLabel={`${t('centre.minute', { n: event.minute })} ${name}${team ? `, ${team}` : ''}${who ? `, ${who}` : ''}${points ? `, ${score}` : ''}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                paddingVertical: space.md,
                paddingHorizontal: space.lg,
              }}
            >
              <Text
                variant="footnote"
                color="textSecondary"
                numeric
                style={{ width: 30, fontWeight: '700' }}
              >
                {t('centre.minute', { n: event.minute })}
              </Text>
              <Icon name={EVENT_ICON[event.type]} size={18} color={tint} />
              <View style={{ flex: 1, gap: 1 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                    flexWrap: 'wrap',
                  }}
                >
                  <Text variant="headline">{name}</Text>
                  {event.revision > 1 ? <Tag label={t('centre.corrected')} tone="warning" /> : null}
                </View>
                {team || who ? (
                  <Text variant="footnote" color="textSecondary">
                    {[team, who].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              {points ? (
                <Text variant="headline" numeric>
                  {score}
                </Text>
              ) : null}
            </View>
          );
        })}
      </RowGroup>
    </View>
  );
}

function Lineups({ centre }: { centre: MatchCentrePayload }) {
  const t = useT();
  const l = useL();
  const theme = useTheme();
  const fixture = centre.fixture.data;
  const [side, setSide] = useState<'home' | 'away'>('home');
  const lineups = centre.lineups.data;
  if (!fixture) return null;
  if (!lineups)
    return <SourceNotice meta={centre.lineups.meta} fallback={t('centre.lineups.pending')} />;
  const lineup = lineups.find((entry: Lineup) => entry.side === side);
  if (!lineup?.announced) {
    return (
      <Notice icon="people-outline" body={t('centre.lineups.pending')} meta={centre.lineups.meta} />
    );
  }
  const group = (title: string, players: Lineup['starters']) => (
    <View style={{ gap: space.sm }}>
      <Text variant="eyebrow" color="textSecondary">
        {title}
      </Text>
      <RowGroup>
        {players.map((player) => (
          <View
            key={player.shirtNumber}
            accessible
            accessibilityLabel={`${t('centre.shirt', { n: player.shirtNumber })}, ${l(player.position)}. ${player.name ?? t('centre.lineups.nameless')}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              paddingVertical: space.sm,
              paddingHorizontal: space.lg,
              minHeight: 52,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: theme.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="footnote" numeric style={{ fontWeight: '700' }}>
                {player.shirtNumber}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="headline">{l(player.position)}</Text>
              <Text variant="footnote" color="textSecondary">
                {player.name ?? t('centre.lineups.nameless')}
              </Text>
            </View>
          </View>
        ))}
      </RowGroup>
    </View>
  );
  return (
    <View style={{ gap: space.lg }}>
      <Segmented
        accessibilityLabel={t('centre.lineups')}
        value={side}
        onChange={setSide}
        options={[
          { id: 'home', label: fixture.home.name },
          { id: 'away', label: fixture.away.name },
        ]}
      />
      <DataStamp meta={centre.lineups.meta} showNotice />
      {group(t('centre.starters'), lineup.starters)}
      {group(t('centre.replacements'), lineup.replacements)}
    </View>
  );
}

function Stats({ centre }: { centre: MatchCentrePayload }) {
  const t = useT();
  const l = useL();
  const theme = useTheme();
  const fixture = centre.fixture.data;
  const stats = centre.stats.data;
  if (!fixture) return null;
  if (!stats) return <SourceNotice meta={centre.stats.meta} fallback={t('status.unavailable')} />;
  const unit = (stat: MatchStat, value: number) =>
    stat.unit === 'percent' ? `${value}%` : stat.unit === 'metres' ? `${value}m` : String(value);
  return (
    <View style={{ gap: space.md }}>
      <DataStamp meta={centre.stats.meta} />
      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="eyebrow" color="accentText">
            {fixture.home.name}
          </Text>
          <Text variant="eyebrow" color="textSecondary">
            {fixture.away.name}
          </Text>
        </View>
        {stats.map((stat) => {
          const total = stat.home + stat.away || 1;
          return (
            <View
              key={stat.id}
              accessible
              accessibilityLabel={`${l(stat.label)}: ${fixture.home.name} ${unit(stat, stat.home)}, ${fixture.away.name} ${unit(stat, stat.away)}`}
              style={{ gap: 6 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <Text variant="headline" numeric>
                  {unit(stat, stat.home)}
                </Text>
                <Text variant="footnote" color="textSecondary">
                  {l(stat.label)}
                </Text>
                <Text variant="headline" numeric>
                  {unit(stat, stat.away)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', height: 6, gap: 3 }}>
                <View
                  style={{
                    flex: stat.home / total,
                    backgroundColor: theme.accent,
                    borderRadius: 3,
                  }}
                />
                <View
                  style={{
                    flex: stat.away / total,
                    backgroundColor: theme.textSecondary,
                    borderRadius: 3,
                    opacity: 0.45,
                  }}
                />
              </View>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

function Report({ centre }: { centre: MatchCentrePayload }) {
  const t = useT();
  const l = useL();
  const router = useRouter();
  const report = centre.report;
  if (!report) return <Notice icon="document-text-outline" body={t('centre.report.pending')} />;
  return (
    <Card
      padded={false}
      testID="centre-report"
      onPress={() => router.push({ pathname: '/story/[id]', params: { id: report.id } })}
      accessibilityLabel={`${l(report.title)}. ${l(report.summary)}`}
      accessibilityHint={t('centre.read')}
      style={{ overflow: 'hidden' }}
    >
      <Photo id={report.mediaId} style={{ height: 180 }} decorative />
      <View style={{ padding: space.lg, gap: space.xs }}>
        <Text variant="title3">{l(report.title)}</Text>
        <Text variant="callout" color="textSecondary">
          {l(report.summary)}
        </Text>
      </View>
    </Card>
  );
}

export default function MatchCentreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const l = useL();
  const locale = useLocale();
  const theme = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('timeline');
  const query = useMatchCentre(id);
  const centre = query.data;
  const fixture = centre?.fixture.data ?? null;
  const when = fixture ? kickoff(fixture, locale) : null;
  const started = centre ? centre.clock.period !== 'pre' : false;
  const statusLabel = !centre
    ? ''
    : centre.clock.period === 'full_time'
      ? t('home.fullTime')
      : centre.clock.period === 'half_time'
        ? t('home.halfTime')
        : started
          ? `${t('home.live')} · ${t('centre.minute', { n: centre.clock.minute ?? 0 })}`
          : t('centre.kickoff');

  return (
    <Page
      testID="screen-centre"
      title={
        fixture
          ? `${fixture.home.shortName} ${t('match.v')} ${fixture.away.shortName}`
          : t('home.cta.centre')
      }
      back
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching && !query.isPending}
      hero={{
        mediaId: started ? 'action-attack' : 'stadium-bowl',
        height: 400,
        content:
          fixture && centre && when ? (
            <View style={{ gap: space.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  flexWrap: 'wrap',
                }}
              >
                <View
                  style={{
                    paddingHorizontal: space.md,
                    paddingVertical: 4,
                    borderRadius: radius.pill,
                    backgroundColor:
                      started && centre.clock.period !== 'full_time'
                        ? theme.accent
                        : 'rgba(246,242,236,0.18)',
                  }}
                >
                  <Text variant="eyebrow" color="onInverse">
                    {statusLabel}
                  </Text>
                </View>
                <Text variant="eyebrow" color="onInverseMuted">
                  {l(fixture.competition)}
                </Text>
              </View>
              <View
                accessible
                accessibilityRole="header"
                accessibilityLabel={
                  started && centre.score
                    ? `${fixture.home.name} ${centre.score.home}, ${fixture.away.name} ${centre.score.away}. ${statusLabel}`
                    : `${fixture.home.name} ${t('match.v')} ${fixture.away.name}`
                }
                style={{ gap: 2 }}
              >
                {([fixture.home, fixture.away] as const).map((team, index) => (
                  <View
                    key={team.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
                  >
                    <Text variant="title1" color="onInverse" style={{ flex: 1 }} numberOfLines={1}>
                      {team.name}
                    </Text>
                    {started && centre.score ? (
                      <Text
                        testID={`score-${index === 0 ? 'home' : 'away'}`}
                        variant="score"
                        color="onInverse"
                        numeric
                      >
                        {index === 0 ? centre.score.home : centre.score.away}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
              <Text variant="callout" color="onInverse" style={{ fontWeight: '500' }}>
                {when.date} · {when.time} {when.zone}
                {fixture.venue.name ? ` · ${fixture.venue.name}` : ''}
              </Text>
              {started ? (
                <Text variant="footnote" color="goldOnInverse" style={{ fontWeight: '600' }}>
                  {t('demo.simulation')}
                </Text>
              ) : null}
              <DataStamp meta={centre.fixture.meta} onDark />
            </View>
          ) : null,
      }}
    >
      {query.isPending ? <SkeletonList rows={5} /> : null}
      {query.isError && !centre ? <ErrorState onRetry={() => void query.refetch()} /> : null}
      {centre && !fixture ? (
        <SourceNotice meta={centre.fixture.meta} fallback={t('common.notFound')} />
      ) : null}
      {centre && fixture ? (
        <View style={{ gap: space.lg }}>
          {fixture.note ? (
            <Notice icon="information-circle-outline" body={l(fixture.note)} />
          ) : null}
          {!started && isHomeFixture(fixture) ? (
            centre.ticket.data ? (
              <Button
                testID="centre-tickets"
                label={l(centre.ticket.data.label)}
                icon="ticket"
                fill
                accessibilityHint={t('common.official')}
                onPress={() => {
                  track('ticket_cta_tap', { fixture_id: fixture.id, placement: 'match_centre' });
                  if (centre.ticket.data) void openOfficial(centre.ticket.data.url);
                }}
              />
            ) : (
              <SourceNotice meta={centre.ticket.meta} fallback={t('status.unavailable')} />
            )
          ) : null}
          {centre.poll ? (
            <Card
              testID="centre-poll"
              onPress={() => router.push('/fan-zone')}
              accessibilityLabel={t('centre.vote')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
            >
              <Icon name="trophy-outline" size={24} color={theme.accentText} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text variant="headline">{t('centre.vote')}</Text>
                {centre.poll.sponsorship ? <PlacementTag label="sponsored" /> : null}
              </View>
              <Icon name="chevron-forward" size={17} color={theme.textSecondary} />
            </Card>
          ) : null}
          <Segmented
            testID="centre-tab"
            accessibilityLabel={t('home.cta.centre')}
            value={tab}
            onChange={setTab}
            options={[
              { id: 'timeline', label: t('centre.timeline') },
              { id: 'lineups', label: t('centre.lineups') },
              { id: 'stats', label: t('centre.stats') },
              { id: 'report', label: t('centre.report') },
            ]}
          />
          {tab === 'timeline' ? <Timeline centre={centre} /> : null}
          {tab === 'lineups' ? <Lineups centre={centre} /> : null}
          {tab === 'stats' ? <Stats centre={centre} /> : null}
          {tab === 'report' ? <Report centre={centre} /> : null}
        </View>
      ) : null}
    </Page>
  );
}
