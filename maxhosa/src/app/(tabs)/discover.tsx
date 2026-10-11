import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AssetImage } from '@/components/AssetImage';
import { BagButton } from '@/components/HeaderActions';
import { Group, GroupTitle, Row } from '@/components/List';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { radius, space } from '@/design/tokens';
import { useStories } from '@/features/catalogue';

export default function Discover() {
  const stories = useStories();
  return (
    <Screen
      title="Discover"
      largeTitle
      subtitle="Stories, lookbooks and private styling"
      inTabs
      right={<BagButton />}
    >
      {stories.status === 'loading' ? <LoadingSkeleton rows={1} /> : null}
      {stories.status === 'error' ? <ErrorState onRetry={stories.retry} /> : null}
      <View style={styles.list}>
        {stories.data?.map((s) => (
          <PressableScale
            key={s.id}
            pressedScale={0.98}
            accessibilityRole="button"
            accessibilityLabel={`${s.kind}: ${s.title}. Placeholder copy.`}
            onPress={() => router.push({ pathname: '/story/[id]', params: { id: s.id } })}
          >
            <AssetImage assetId={s.heroAssetId} decorative style={styles.image} />
            <Text variant="eyebrow" color="ink3" style={{ marginTop: space.m }}>
              {s.kind} · placeholder copy
            </Text>
            <Text variant="title" style={{ marginTop: space.xs }}>
              {s.title}
            </Text>
          </PressableScale>
        ))}
      </View>
      <GroupTitle>Events</GroupTitle>
      <Group>
        <EmptyState
          icon="calendar-outline"
          title="No events in this demo"
          body="Event listings, RSVPs and capacity come from MAXHOSA AFRICA’s event system once it is connected."
        />
      </Group>
      <GroupTitle>Styling</GroupTitle>
      <Group>
        <Row
          first
          icon="sparkles-outline"
          title="Book time with a stylist"
          subtitle="Send an enquiry — client care confirms the time"
          onPress={() => router.push('/appointment')}
        />
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.gutter, gap: space.xxl },
  image: { aspectRatio: 4 / 5, borderRadius: radius.m },
});
