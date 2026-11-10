import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MAX_AGE_MS, visibleModules, type ContentItem, type HomeModule } from '@kc-one/contracts';
import {
  AppHeader,
  Button,
  Card,
  Column,
  ConceptImage,
  DemoTag,
  Eyebrow,
  HeaderPill,
  Headline,
  LoadingBlock,
  Notice,
  PressableScale,
  ProvenanceLine,
  QueryState,
  Screen,
  SectionTitle,
  Text,
} from '@/components';
import { capabilities } from '@/config/env';
import { isImageKey } from '@/config/imagery';
import { useFanFeed, useFixtures, useHomeFeed } from '@/data/queries';
import { demoNotifications } from '@/data/demo/notifications';
import { FixtureCard } from '@/features/football/FixtureCard';
import { usePreferences } from '@/state/preferences';
import { color, gutter, radius, space } from '@/theme';

/** Split "Every Khosi matters." into a lead line and a gold italic accent. */
function splitTitle(title: string) {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return { lead: title, accent: undefined };
  return { lead: words.slice(0, -1).join(' '), accent: words[words.length - 1] };
}

export default function Home() {
  const router = useRouter();
  const feed = useHomeFeed();
  const read = usePreferences((s) => s.readNotificationIds);
  const inbox = capabilities.notifications === 'demo' ? demoNotifications : [];
  const unread = inbox.filter((n) => !read.includes(n.id)).length;

  return (
    <Screen inTabs edgeToEdge refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()}>
      <QueryState
        query={feed}
        loading={
          <Column style={{ paddingTop: 120 }}>
            <LoadingBlock lines={4} />
          </Column>
        }
        unavailable={(reason, message) => (
          <>
            <AppHeader
              action={
                <HeaderPill
                  icon="notifications-outline"
                  accessibilityLabel="Notifications"
                  onPress={() => router.push('/notifications')}
                />
              }
            />
            <Column>
              <Notice reason={reason} body={message} />
            </Column>
          </>
        )}
      >
        {(data, provenance) => {
          const byId = new Map(data.items.map((i) => [i.id, i]));
          const modules = visibleModules(data.modules, new Date());
          return (
            <>
              {modules.map((m) => (
                <Module
                  key={m.id}
                  module={m}
                  items={m.contentIds
                    .map((id) => byId.get(id))
                    .filter((x): x is ContentItem => !!x)}
                  unread={unread}
                />
              ))}
              <Column style={{ marginTop: space.xxxl }}>
                <ProvenanceLine
                  provenance={provenance}
                  maxAgeMs={MAX_AGE_MS.content}
                  sourceLabel="Club content"
                />
              </Column>
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

function Module({
  module,
  items,
  unread,
}: {
  module: HomeModule;
  items: ContentItem[];
  unread: number;
}) {
  switch (module.type) {
    case 'hero':
      return items[0] ? <Hero item={items[0]} unread={unread} /> : null;
    case 'next_fixture':
      return <NextFixture title={module.title ?? 'Next match'} />;
    case 'quick_links':
      return <QuickLinks />;
    case 'news_rail':
      return <NewsRail title={module.title ?? 'Latest'} items={items} />;
    case 'fan_moments':
      return <FanRail title={module.title ?? 'Fan Moments'} />;
    case 'promo':
      return <Promos />;
    default:
      return null;
  }
}

function Hero({ item, unread }: { item: ContentItem; unread: number }) {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const h = Math.min(Math.max(height * 0.56, 400), 600);
  const { lead, accent } = splitTitle(item.title);
  return (
    <View>
      <View style={{ height: h }}>
        {isImageKey(item.heroImageKey) ? (
          <ConceptImage
            imageKey={item.heroImageKey}
            style={StyleSheet.absoluteFill}
            fade="full"
            position="right"
            tag="hero"
          />
        ) : null}
        <AppHeader
          overlay
          action={
            <HeaderPill
              icon="notifications-outline"
              accessibilityLabel="Notifications"
              badge={unread}
              onPress={() => router.push('/notifications')}
            />
          }
        />
      </View>
      <Column style={{ marginTop: -space.huge, gap: space.lg }}>
        {item.eyebrow ? <Eyebrow>{item.eyebrow}</Eyebrow> : null}
        <Headline lead={lead} accent={accent} />
        <Text variant="body" color="textSecondary" style={{ fontSize: 17, lineHeight: 27 }}>
          {item.summary}
        </Text>
        <Button
          label="Go to matchday"
          trailingIcon="arrow-forward"
          onPress={() => router.push('/match')}
        />
      </Column>
    </View>
  );
}

function NextFixture({ title }: { title: string }) {
  const router = useRouter();
  const q = useFixtures();
  return (
    <Column style={styles.section}>
      <SectionTitle
        title={title}
        action={
          <Button
            label="All fixtures"
            variant="ghost"
            compact
            onPress={() => router.push('/match')}
          />
        }
      />
      <QueryState
        query={q}
        loading={<LoadingBlock lines={1} />}
        unavailable={(reason, message) => <Notice compact reason={reason} body={message} />}
      >
        {(fixtures) => {
          const next = fixtures.find(
            (f) => f.status === 'scheduled' || f.status === 'tbc' || f.status === 'live',
          );
          return next ? (
            <FixtureCard fixture={next} />
          ) : (
            <Notice
              compact
              reason="integration_pending"
              title="No upcoming fixture"
              body="The next fixture appears once the club publishes it."
            />
          );
        }}
      </QueryState>
    </Column>
  );
}

const LINKS: { icon: keyof typeof Ionicons.glyphMap; label: string; href: Href }[] = [
  { icon: 'pulse-outline', label: 'Match Centre', href: '/match' },
  { icon: 'shirt-outline', label: 'Squad', href: '/match?view=squad' },
  { icon: 'ticket-outline', label: 'Tickets', href: '/tickets' },
  { icon: 'card-outline', label: 'Membership', href: '/membership' },
  { icon: 'camera-outline', label: 'Fan Moments', href: '/fan' },
  { icon: 'gift-outline', label: 'Rewards', href: '/rewards' },
  { icon: 'bag-handle-outline', label: 'Shop', href: '/shop' },
  { icon: 'notifications-outline', label: 'Alerts', href: '/notifications' },
];

function QuickLinks() {
  const router = useRouter();
  return (
    <Column style={styles.section}>
      <View style={styles.grid} accessibilityLabel="Quick links">
        {LINKS.map((l) => (
          <PressableScale
            key={l.label}
            onPress={() => router.push(l.href)}
            accessibilityLabel={l.label}
            style={styles.tile}
            pressedScale={0.94}
          >
            <Ionicons name={l.icon} size={22} color={color.accent} />
            <Text
              variant="caption"
              color="textSecondary"
              numberOfLines={2}
              align="center"
              style={styles.tileLabel}
            >
              {l.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </Column>
  );
}

function NewsRail({ title, items }: { title: string; items: ContentItem[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardW = Math.min(width * 0.72, 320);
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Column>
        <SectionTitle title={title} />
      </Column>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardW + space.md}
        contentContainerStyle={{ paddingHorizontal: gutter, gap: space.md }}
      >
        {items.map((item) => (
          <PressableScale
            key={item.id}
            onPress={() => router.push(`/news/${item.id}`)}
            accessibilityLabel={`${item.eyebrow ?? 'Story'}. ${item.title}. ${item.provenance.state === 'demo' ? 'Sample story.' : ''}`}
            pressedScale={0.98}
            style={{ width: cardW }}
          >
            <View style={[styles.newsImage, { height: cardW * 1.2 }]}>
              {isImageKey(item.heroImageKey) ? (
                <ConceptImage
                  imageKey={item.heroImageKey}
                  style={StyleSheet.absoluteFill}
                  fade="bottom"
                  decorative
                  tag="top-right"
                />
              ) : null}
              <View style={styles.newsText}>
                {item.provenance.state === 'demo' ? <DemoTag kind="SAMPLE" /> : null}
                {item.eyebrow ? (
                  <Text variant="micro" color="accent">
                    {item.eyebrow}
                  </Text>
                ) : null}
                <Text variant="title2" numberOfLines={3}>
                  {item.title}
                </Text>
              </View>
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

function FanRail({ title }: { title: string }) {
  const router = useRouter();
  const q = useFanFeed();
  return (
    <View style={styles.section}>
      <Column>
        <SectionTitle
          title={title}
          action={
            <Button
              label="Share yours"
              variant="ghost"
              compact
              icon="add"
              onPress={() => router.push('/fan/new')}
            />
          }
        />
      </Column>
      <QueryState
        query={q}
        loading={
          <Column>
            <LoadingBlock lines={0} />
          </Column>
        }
        unavailable={(reason, message) => (
          <Column>
            <Notice compact reason={reason} body={message} />
          </Column>
        )}
      >
        {(posts) => (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: gutter, gap: space.sm }}
          >
            {posts.map((p) => (
              <PressableScale
                key={p.id}
                onPress={() => router.push(`/fan/${p.id}`)}
                accessibilityLabel={`Fan Moment: ${p.caption}`}
                style={styles.fanTile}
                pressedScale={0.96}
              >
                {isImageKey(p.mediaRef) ? (
                  <ConceptImage
                    imageKey={p.mediaRef}
                    style={StyleSheet.absoluteFill}
                    decorative
                    tag="none"
                  />
                ) : null}
                <View style={styles.fanTag}>
                  <DemoTag onImage />
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        )}
      </QueryState>
    </View>
  );
}

function Promos() {
  const router = useRouter();
  return (
    <Column style={[styles.section, { flexDirection: 'row', gap: space.md }]}>
      {(
        [
          ['gift-outline', 'Khosi Rewards', 'Rewards for the family', '/rewards'],
          ['bag-handle-outline', 'Official shop', 'Kit and collections', '/shop'],
        ] as const
      ).map(([icon, title, sub, href]) => (
        <Card
          key={title}
          onPress={() => router.push(href)}
          accessibilityLabel={`${title}. ${sub}`}
          style={{ flex: 1, gap: space.sm }}
        >
          <Ionicons name={icon} size={24} color={color.accent} />
          <Text variant="headline">{title}</Text>
          <Text variant="footnote" color="textSecondary">
            {sub}
          </Text>
        </Card>
      ))}
    </Column>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xxxl, gap: space.lg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space.sm,
    justifyContent: 'space-between',
  },
  tile: {
    width: '23%',
    aspectRatio: 0.92,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: 4,
  },
  tileLabel: { fontSize: 11, lineHeight: 13 },
  newsImage: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surface,
    justifyContent: 'flex-end',
  },
  newsText: { padding: space.lg, gap: space.sm },
  fanTile: {
    width: 132,
    height: 168,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.surface,
  },
  fanTag: { position: 'absolute', left: 8, bottom: 8 },
});
