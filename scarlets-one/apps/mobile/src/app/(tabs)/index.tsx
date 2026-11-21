import type { HomePayload } from '@scarlets/api-client';
import { isHomeFixture, type HomeModule } from '@scarlets/domain';
import { useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DataStamp, DemoChip, PlacementTag, Tag } from '@/components/Chips';
import { Countdown } from '@/components/Countdown';
import { Icon, type IconName } from '@/components/Icon';
import { BarButton, Page } from '@/components/Page';
import { Photo } from '@/components/Photo';
import { Press } from '@/components/Press';
import { SectionHeader, TeamMark } from '@/components/Rows';
import { ErrorState, Notice, Skeleton, SkeletonList } from '@/components/States';
import { StoryCard } from '@/components/StoryCard';
import { Text } from '@/components/Text';
import { useHome, useMatchday } from '@/data/queries';
import { fixtureTitle, kickoff } from '@/features/format';
import { useL, useLocale, useT, type MessageKey, type Translate } from '@/i18n';
import { track } from '@/lib/analytics';
import { openOfficial } from '@/lib/links';
import { mediaSource } from '@/media';
import { useMatchdayPlan } from '@/state/matchday';
import { usePrefs } from '@/state/prefs';
import { useSession } from '@/state/session';
import { MAX_CONTENT_WIDTH, radius, space, useTheme } from '@/theme';

/** A stable empty list: a selector must hand back the same reference when nothing changed. */
const NONE: string[] = [];

const HERO_MEDIA: Record<HomePayload['phase'], string> = {
  no_fixture: 'west-wales',
  pre_match: 'red-wall-hero',
  matchday: 'red-wall-hero',
  live: 'stadium-bowl',
  half_time: 'stadium-bowl',
  full_time: 'scarves-raised-wide',
};

const eventLine = (t: Translate, home: HomePayload) => {
  const event = home.pulse?.lastEvent;
  const fixture = home.pulse?.fixture;
  if (!event || !fixture) return null;
  const team =
    event.side === 'home' ? fixture.home.name : event.side === 'away' ? fixture.away.name : null;
  return `${t('centre.minute', { n: event.minute })} ${t(`event.${event.type}` as MessageKey)}${team ? ` · ${team}` : ''}`;
};

function Hero({ home }: { home: HomePayload }) {
  const t = useT();
  const l = useL();
  const locale = useLocale();
  const router = useRouter();
  const theme = useTheme();
  const fixture = home.fixture.data;

  if (!fixture) {
    return (
      <View style={{ gap: space.md }}>
        <Text variant="eyebrow" color="goldOnInverse">
          {t('app.tagline')}
        </Text>
        <Text variant="display" color="onInverse" accessibilityRole="header">
          {t('home.noFixture.title')}
        </Text>
        <Text variant="callout" color="onInverseMuted">
          {t('home.noFixture.body')}
        </Text>
        <Button label={t('more.club')} variant="onDark" onPress={() => router.push('/club')} />
      </View>
    );
  }

  const when = kickoff(fixture, locale);
  const inPlay = home.phase === 'live' || home.phase === 'half_time' || home.phase === 'full_time';
  const centre = () => {
    track('match_centre_open', { fixture_id: fixture.id, placement: 'home_hero' });
    router.push({ pathname: '/fixture/[id]', params: { id: fixture.id } });
  };

  if (inPlay && home.pulse) {
    const score = home.pulse.score;
    const label =
      home.phase === 'live'
        ? t('home.live')
        : home.phase === 'half_time'
          ? t('home.halfTime')
          : t('home.fullTime');
    return (
      <View style={{ gap: space.md }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: space.md,
              paddingVertical: 4,
              borderRadius: radius.pill,
              backgroundColor: home.phase === 'full_time' ? 'rgba(246,242,236,0.18)' : theme.accent,
            }}
          >
            {home.phase === 'live' ? (
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' }} />
            ) : null}
            <Text variant="eyebrow" color="onInverse">
              {label}
              {home.phase === 'live' && home.pulse.clock.minute !== null
                ? ` · ${t('centre.minute', { n: home.pulse.clock.minute })}`
                : ''}
            </Text>
          </View>
          <Text variant="eyebrow" color="onInverseMuted">
            {l(fixture.competition)}
          </Text>
        </View>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${label}. ${fixture.home.name} ${score?.home ?? 0}, ${fixture.away.name} ${score?.away ?? 0}. ${t('demo.simulation')}`}
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
              <Text variant="score" color="onInverse" numeric>
                {index === 0 ? (score?.home ?? 0) : (score?.away ?? 0)}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="footnote" color="goldOnInverse" style={{ fontWeight: '600' }}>
          {t('demo.simulation')}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button
            testID="hero-centre"
            label={t('home.cta.centre')}
            variant="onDark"
            icon="pulse"
            onPress={centre}
          />
          {home.phase === 'full_time' && home.nextHome ? (
            <Button
              label={t('home.cta.nextVisit')}
              variant="outlineOnDark"
              onPress={() => router.push('/matchday')}
            />
          ) : (
            <Button
              label={t('tab.fanzone')}
              variant="outlineOnDark"
              onPress={() => router.push('/fan-zone')}
            />
          )}
        </View>
        <DataStamp meta={home.pulse.meta} onDark showNotice />
      </View>
    );
  }

  const ticket = home.ticket;
  return (
    <View style={{ gap: space.md }}>
      <Text variant="eyebrow" color="goldOnInverse">
        {home.phase === 'matchday' ? t('home.matchday') : t('home.nextMatch')} ·{' '}
        {l(fixture.competition)}
      </Text>
      <View accessible accessibilityRole="header" accessibilityLabel={fixtureTitle(fixture)}>
        <Text variant="display" color="onInverse">
          {fixture.home.name}
        </Text>
        <Text variant="display" color="onInverse">
          <Text variant="title2" color="onInverseMuted">
            {t('match.v')}{' '}
          </Text>
          {fixture.away.name}
        </Text>
      </View>
      <Text variant="callout" color="onInverse" style={{ fontWeight: '500' }}>
        {when.date} · {when.time} {when.zone} · {fixture.venue.name}
      </Text>
      <Countdown to={fixture.kickoffUtc} />
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.xs }}>
        {isHomeFixture(fixture) ? (
          <Button
            testID="hero-tickets"
            label={t('home.cta.tickets')}
            icon="ticket"
            disabled={!ticket?.data}
            accessibilityHint={t('common.official')}
            onPress={() => {
              if (!ticket?.data) return;
              track('ticket_cta_tap', { fixture_id: fixture.id, placement: 'home_hero' });
              void openOfficial(ticket.data.url);
            }}
          />
        ) : null}
        <Button
          testID="hero-matchday"
          label={t('home.cta.matchday')}
          variant="outlineOnDark"
          onPress={() => router.push('/matchday')}
        />
      </View>
      {ticket && !ticket.data && ticket.meta.notice ? (
        <Text variant="footnote" color="onInverseMuted">
          {l(ticket.meta.notice)}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <DataStamp meta={home.fixture.meta} onDark />
        {fixture.note ? <Tag label={t('demo.example')} tone="onDark" /> : null}
      </View>
    </View>
  );
}

function QuickLinks({ home }: { home: HomePayload }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const fixture = home.fixture.data;
  const links: { key: MessageKey; icon: IconName; href: Href }[] = [
    {
      key: 'quick.tickets',
      icon: 'ticket-outline',
      href: { pathname: '/matchday/[section]', params: { section: 'tickets' } },
    },
    ...(fixture
      ? [
          {
            key: 'quick.centre' as const,
            icon: 'pulse-outline' as const,
            href: { pathname: '/fixture/[id]', params: { id: fixture.id } } as Href,
          },
        ]
      : []),
    { key: 'quick.passport', icon: 'card-outline', href: '/passport' },
    {
      key: 'quick.venue',
      icon: 'location-outline',
      href: { pathname: '/matchday/[section]', params: { section: 'map' } },
    },
    { key: 'quick.fixtures', icon: 'calendar-outline', href: '/match' },
    { key: 'quick.club', icon: 'shield-outline', href: '/club' },
  ];
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader title={t('home.quick.title')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -space.xl }}
        contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md }}
      >
        {links.map((link) => (
          <Press
            key={link.key}
            testID={`quick-${link.key}`}
            onPress={() => router.push(link.href)}
            accessibilityLabel={t(link.key)}
            style={{ width: 82, alignItems: 'center', gap: space.sm }}
          >
            <View
              style={{
                width: 62,
                height: 62,
                borderRadius: 22,
                borderCurve: 'continuous',
                backgroundColor: theme.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={link.icon} size={26} color={theme.accentText} />
            </View>
            <Text variant="caption" align="center" numberOfLines={2}>
              {t(link.key)}
            </Text>
          </Press>
        ))}
      </ScrollView>
    </View>
  );
}

function MatchPulse({ home }: { home: HomePayload }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const pulse = home.pulse;
  if (!pulse) return null;
  const { fixture, score } = pulse;
  const when = kickoff(fixture, locale);
  const last = eventLine(t, home);
  const started = pulse.clock.period !== 'pre';
  return (
    <Card
      tone="inverse"
      testID="match-pulse"
      onPress={() => router.push({ pathname: '/fixture/[id]', params: { id: fixture.id } })}
      accessibilityLabel={`${t('home.pulse.title')}. ${fixtureTitle(fixture)}. ${
        started && score
          ? `${score.home} ${score.away}`
          : t('home.pulse.pre', { date: when.date, time: when.time })
      }`}
      accessibilityHint={t('home.pulse.open')}
      style={{ gap: space.md }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="eyebrow" color="goldOnInverse">
          {t('home.pulse.title')}
        </Text>
        <Icon name="chevron-forward" size={16} color="#D9C9CC" />
      </View>
      {([fixture.home, fixture.away] as const).map((team, index) => (
        <View key={team.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <TeamMark shortName={team.shortName} isScarlets={team.isScarlets} size={38} onDark />
          <Text variant="headline" color="onInverse" style={{ flex: 1 }} numberOfLines={1}>
            {team.name}
          </Text>
          {started && score ? (
            <Text variant="title1" color="onInverse" numeric>
              {index === 0 ? score.home : score.away}
            </Text>
          ) : null}
        </View>
      ))}
      <Text variant="footnote" color="onInverseMuted">
        {started
          ? (last ?? '')
          : t('home.pulse.pre', { date: when.date, time: `${when.time} ${when.zone}` })}
      </Text>
      {started ? (
        <Text variant="caption" color="goldOnInverse" style={{ fontWeight: '600' }}>
          {t('demo.simulation')}
        </Text>
      ) : null}
      <DataStamp
        meta={pulse.meta.status === 'unavailable' ? home.fixture.meta : pulse.meta}
        onDark
      />
    </Card>
  );
}

function Stories({ home }: { home: HomePayload }) {
  const t = useT();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const following = usePrefs((s) => s.following);
  const items = home.stories.data ?? [];
  if (items.length === 0) return null;
  // The editor's pinned story leads. Then what the supporter chose to follow,
  // then everything else, each group in the editor's own order.
  const followed = (item: (typeof items)[number]) => following.includes(item.category);
  const ranked = [
    ...items.filter((i) => i.pinned),
    ...items.filter((i) => !i.pinned && followed(i)),
    ...items.filter((i) => !i.pinned && !followed(i)),
  ].slice(0, 6);
  const cardWidth = Math.min(Math.min(width, MAX_CONTENT_WIDTH) * 0.76, 340);
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader
        title={t('home.stories.title')}
        action={{ label: t('common.seeAll'), onPress: () => router.push('/club') }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Native deceleration projects the flick and lands on a card edge.
        snapToInterval={cardWidth + space.md}
        decelerationRate="fast"
        style={{ marginHorizontal: -space.xl }}
        contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md }}
      >
        {ranked.map((item) => (
          <StoryCard
            key={item.id}
            item={item}
            style={{ width: cardWidth, height: cardWidth * 1.16 }}
          />
        ))}
      </ScrollView>
      <DataStamp meta={home.stories.meta} />
    </View>
  );
}

function Planner({ home }: { home: HomePayload }) {
  const t = useT();
  const l = useL();
  const theme = useTheme();
  const router = useRouter();
  const matchday = useMatchday();
  const fixtureId = matchday.data?.fixture.data?.id;
  const done = useMatchdayPlan((s) => (fixtureId ? (s.done[fixtureId] ?? NONE) : NONE));
  const guide = matchday.data?.guide.data;
  if (!home.fixture.data) return null;
  const total = guide?.checklist.length ?? 0;
  const completed = guide ? guide.checklist.filter((item) => done.includes(item.id)).length : 0;
  const shortcuts = (guide?.sections ?? []).filter((s) =>
    ['tickets', 'travel', 'access'].includes(s.id),
  );
  return (
    <Card testID="planner" style={{ gap: space.md }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: space.md,
        }}
      >
        <Text variant="title3" accessibilityRole="header" style={{ flex: 1 }}>
          {t('home.planner.title')}
        </Text>
        {total > 0 ? (
          <Text variant="footnote" color="textSecondary" numeric>
            {t('home.planner.progress', { done: completed, total })}
          </Text>
        ) : null}
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('home.planner.progress', { done: completed, total })}
        accessibilityValue={{ min: 0, max: total, now: completed }}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: theme.surfaceMuted,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${total ? (completed / total) * 100 : 0}%`,
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.accent,
          }}
        />
      </View>
      {matchday.isPending ? <SkeletonList rows={2} /> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {shortcuts.map((section) => (
          <Press
            key={section.id}
            onPress={() =>
              router.push({ pathname: '/matchday/[section]', params: { section: section.id } })
            }
            accessibilityLabel={l(section.title)}
            style={{
              flex: 1,
              paddingVertical: space.md,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: theme.surfaceMuted,
              alignItems: 'center',
              gap: space.xs,
            }}
          >
            <Icon name={section.icon} size={22} color={theme.accentText} />
            <Text variant="caption" style={{ fontWeight: '600' }} numberOfLines={1}>
              {l(section.title)}
            </Text>
          </Press>
        ))}
      </View>
      <Button
        label={t('home.planner.open')}
        variant="secondary"
        size="sm"
        iconAfter="arrow-forward"
        onPress={() => router.push('/matchday')}
      />
    </Card>
  );
}

function PassportTile() {
  const t = useT();
  const router = useRouter();
  const account = useSession((s) => s.account);
  return (
    <Card
      tone="inverse"
      testID="passport-tile"
      onPress={() => {
        track('passport_open', { placement: 'home' });
        router.push('/passport');
      }}
      accessibilityLabel={`${t('home.passport.title')}. ${account === 'member' ? t('home.passport.member') : t('home.passport.guest')}`}
      accessibilityHint={t('home.passport.cta')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: 'rgba(185,151,91,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="card" size={24} color="#B9975B" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" color="onInverse">
          {t('home.passport.title')}
        </Text>
        <Text variant="footnote" color="onInverseMuted">
          {account === 'member' ? t('home.passport.member') : t('home.passport.guest')}
        </Text>
      </View>
      <Icon name="chevron-forward" size={17} color="#D9C9CC" />
    </Card>
  );
}

function FanPrompt({ home }: { home: HomePayload }) {
  const t = useT();
  const l = useL();
  const theme = useTheme();
  const router = useRouter();
  const activity = home.fanPrompt;
  if (!activity) return null;
  const icon: IconName =
    activity.kind === 'prediction'
      ? 'stats-chart'
      : activity.kind === 'quiz'
        ? 'help-circle'
        : 'megaphone';
  return (
    <Card testID="fan-prompt" style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: theme.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={22} color={theme.accentText} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="eyebrow" color="accentText">
            {t('home.fan.title')}
          </Text>
          <Text variant="title3" accessibilityRole="header">
            {l(activity.title)}
          </Text>
          <Text variant="callout" color="textSecondary">
            {l(activity.prompt)}
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.md,
        }}
      >
        <Button
          testID="fan-prompt-cta"
          label={t('home.fan.cta')}
          size="sm"
          onPress={() => router.push('/fan-zone')}
        />
        <DemoChip />
      </View>
    </Card>
  );
}

function PartnerModule({ home }: { home: HomePayload }) {
  const t = useT();
  const l = useL();
  const campaign = home.partner;
  if (!campaign) return null;
  return (
    <Card padded={false} testID="partner-module" style={{ overflow: 'hidden' }}>
      <Photo id={campaign.mediaId} style={{ height: 168 }} />
      <View style={{ padding: space.lg, gap: space.sm }}>
        <View
          style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <PlacementTag label={campaign.label} />
          <DemoChip />
        </View>
        <Text variant="title3" accessibilityRole="header">
          {l(campaign.title)}
        </Text>
        <Text variant="callout" color="textSecondary">
          {l(campaign.body)}
        </Text>
        <Text variant="caption" color="textSecondary">
          {t('partner.slot')}
        </Text>
      </View>
    </Card>
  );
}

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const query = useHome();
  const home = query.data;
  const crest = mediaSource('crest');

  const modules: Record<HomeModule, (data: HomePayload) => ReactNode> = {
    quick_links: (data) => <QuickLinks home={data} />,
    match_pulse: (data) => <MatchPulse home={data} />,
    stories: (data) => <Stories home={data} />,
    planner: (data) => <Planner home={data} />,
    passport: () => <PassportTile />,
    fan_prompt: (data) => <FanPrompt home={data} />,
    partner: (data) => <PartnerModule home={data} />,
  };

  const heroHeight = Math.round(Math.min(Math.max(height * 0.7, 520), 640));

  return (
    <Page
      testID="screen-home"
      title={t('app.name')}
      inTabs
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching && !query.isPending}
      hero={{
        mediaId: HERO_MEDIA[home?.phase ?? 'pre_match'],
        height: heroHeight,
        content: home ? (
          <Hero home={home} />
        ) : (
          <View style={{ gap: space.md }}>
            <Skeleton height={14} width="40%" style={{ opacity: 0.4 }} />
            <Skeleton height={40} width="70%" style={{ opacity: 0.4 }} />
            <Skeleton height={40} width="55%" style={{ opacity: 0.4 }} />
          </View>
        ),
      }}
      leading={
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Scarlets"
          style={{
            marginLeft: space.sm,
            paddingHorizontal: space.sm,
            paddingVertical: 5,
            borderRadius: radius.md,
            backgroundColor: 'rgba(246,242,236,0.92)',
          }}
        >
          {/* The supplied crest file, shown as it is. */}
          <Image
            source={crest}
            style={{ width: 56, height: 28 }}
            contentFit="contain"
            accessible={false}
          />
        </View>
      }
      actions={
        <BarButton
          testID="open-more"
          icon="menu"
          label={t('common.more')}
          onPress={() => router.push('/more')}
        />
      }
    >
      {query.isError && !home ? <ErrorState onRetry={() => void query.refetch()} /> : null}
      {query.isPending ? <SkeletonList rows={4} /> : null}
      {home ? (
        <View style={{ gap: space.xxl }}>
          {home.modules.map((id) => {
            const node = modules[id](home);
            return node ? <View key={id}>{node}</View> : null;
          })}
          <Notice icon="flask-outline" body={t('concept.banner')} />
          <Text
            variant="caption"
            color="textSecondary"
            align="center"
            style={{ color: theme.textSecondary }}
          >
            {t('app.tagline')} {t('app.tagline2')}
          </Text>
        </View>
      ) : null}
    </Page>
  );
}
