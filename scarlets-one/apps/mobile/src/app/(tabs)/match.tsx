import { officialLinks } from '@scarlets/adapters';
import {
  formatVenueTime,
  isHomeFixture,
  isResult,
  type Fixture,
  type Squad,
} from '@scarlets/domain';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DataStamp, DemoChip, Tag } from '@/components/Chips';
import { ChipRow } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { BarButton, Page } from '@/components/Page';
import { Segmented } from '@/components/Segmented';
import { ErrorState, Notice, SkeletonList, SourceNotice } from '@/components/States';
import { Text } from '@/components/Text';
import { useFixtures } from '@/data/queries';
import { useL, useLocale, useT } from '@/i18n';
import { track } from '@/lib/analytics';
import { openOfficial } from '@/lib/links';
import { radius, space, useTheme } from '@/theme';

type View_ = 'fixtures' | 'results' | 'table';

function FixtureCard({ fixture }: { fixture: Fixture }) {
  const t = useT();
  const l = useL();
  const locale = useLocale();
  const theme = useTheme();
  const router = useRouter();
  const when = formatVenueTime(fixture.kickoffUtc, fixture.venue.timeZone, locale);
  const home = isHomeFixture(fixture);
  const result = isResult(fixture);
  const inPlay = fixture.status === 'live' || fixture.status === 'half_time';
  const label =
    result && fixture.score
      ? t('match.resultLabel', {
          home: fixture.home.name,
          homeScore: fixture.score.home,
          away: fixture.away.name,
          awayScore: fixture.score.away,
          date: when.longDate,
        })
      : t('match.fixtureLabel', {
          home: fixture.home.name,
          away: fixture.away.name,
          date: when.longDate,
          time: `${when.time} ${when.zone}`,
          venue: fixture.venue.name,
        });
  return (
    <Card
      testID={`fixture-${fixture.id}`}
      onPress={() => {
        track('fixture_view', { fixture_id: fixture.id, squad: fixture.squad });
        router.push({ pathname: '/fixture/[id]', params: { id: fixture.id } });
      }}
      accessibilityLabel={label}
      style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}
    >
      <View
        style={{
          width: 58,
          paddingVertical: space.sm,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: theme.surfaceMuted,
          alignItems: 'center',
        }}
      >
        <Text variant="eyebrow" color="accentText" style={{ fontSize: 10 }}>
          {when.weekday}
        </Text>
        <Text variant="title1" numeric>
          {when.day}
        </Text>
        <Text variant="eyebrow" color="textSecondary" style={{ fontSize: 10 }}>
          {when.month}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="eyebrow" color="textSecondary" numberOfLines={1}>
          {l(fixture.competition)}
        </Text>
        <Text variant="headline" numberOfLines={2}>
          {fixture.home.name} {t('match.v')} {fixture.away.name}
        </Text>
        <Text variant="footnote" color="textSecondary" numberOfLines={1}>
          {result ? when.date : `${when.time} ${when.zone}`}
          {fixture.venue.name ? ` · ${fixture.venue.name}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap', marginTop: 3 }}>
          {inPlay ? (
            <Tag
              label={fixture.status === 'live' ? t('home.live') : t('home.halfTime')}
              tone="accent"
            />
          ) : null}
          <Tag label={home ? t('match.home') : t('match.away')} />
          {fixture.kickoffProvisional && !result ? (
            <Tag label={t('match.provisional')} icon="time-outline" tone="warning" />
          ) : null}
          {fixture.ticketing === 'link_out' && !result ? (
            <Tag label={t('match.tickets')} icon="ticket-outline" tone="gold" />
          ) : null}
          <DemoChip
            label={
              fixture.note && !result && !inPlay && fixture.competition.en !== 'Demo fixture'
                ? t('demo.example').toUpperCase()
                : undefined
            }
          />
        </View>
      </View>
      {(result || inPlay) && fixture.score ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="title2" numeric>
            {fixture.score.home}–{fixture.score.away}
          </Text>
        </View>
      ) : (
        <Icon name="chevron-forward" size={17} color={theme.textSecondary} />
      )}
    </Card>
  );
}

export default function MatchScreen() {
  const t = useT();
  const router = useRouter();
  const [view, setView] = useState<View_>('fixtures');
  const [squad, setSquad] = useState<Squad>('first_team');
  const query = useFixtures(squad);
  const data = query.data;
  const all = data?.fixtures.data ?? [];
  const upcoming = all.filter((f) => !isResult(f));
  const results = all.filter(isResult).reverse();
  const list = view === 'fixtures' ? upcoming : results;

  return (
    <Page
      testID="screen-match"
      title={t('match.title')}
      inTabs
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching && !query.isPending}
      actions={
        <BarButton icon="menu" label={t('common.more')} onPress={() => router.push('/more')} />
      }
    >
      <View style={{ gap: space.lg }}>
        <Segmented
          testID="match-view"
          accessibilityLabel={t('match.title')}
          value={view}
          onChange={setView}
          options={[
            { id: 'fixtures', label: t('match.fixtures') },
            { id: 'results', label: t('match.results') },
            { id: 'table', label: t('match.table') },
          ]}
        />
        <ChipRow
          testID="squad"
          accessibilityLabel={t('settings.following')}
          value={squad}
          onChange={setSquad}
          options={[
            { id: 'first_team', label: t('squad.first_team') },
            { id: 'women', label: t('squad.women') },
            { id: 'academy', label: t('squad.academy') },
          ]}
        />
        {query.isPending ? <SkeletonList rows={4} /> : null}
        {query.isError && !data ? <ErrorState onRetry={() => void query.refetch()} /> : null}
        {data && view === 'table' ? (
          <SourceNotice meta={data.table.meta} fallback={t('status.unavailable')} />
        ) : null}
        {data && view !== 'table' ? (
          <View style={{ gap: space.md }}>
            <DataStamp meta={data.fixtures.meta} showNotice />
            {list.length === 0 ? (
              <Notice
                icon="calendar-outline"
                body={view === 'fixtures' ? t('match.empty.fixtures') : t('match.empty.results')}
              />
            ) : (
              list.map((fixture) => <FixtureCard key={fixture.id} fixture={fixture} />)
            )}
            <Button
              label={t('match.official')}
              variant="ghost"
              size="sm"
              iconAfter="open-outline"
              accessibilityHint={t('common.official')}
              onPress={() => void openOfficial(officialLinks.fixtures.url)}
            />
          </View>
        ) : null}
      </View>
    </Page>
  );
}
