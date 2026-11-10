import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { BackHeader, EmptyState, Group, ListRow, QueryState, Screen } from '@/components';
import { useHomeFeed } from '@/data/queries';
import { usePreferences } from '@/state/preferences';
import { space } from '@/theme';

export default function Saved() {
  const router = useRouter();
  const saved = usePreferences((s) => s.savedIds);
  const feed = useHomeFeed();
  return (
    <Screen topInset={false} header={<BackHeader title="Saved stories" />}>
      <View style={{ gap: space.lg }}>
        <QueryState query={feed}>
          {(data) => {
            const items = saved
              .map((id) => data.items.find((i) => i.id === id))
              .filter((x): x is NonNullable<typeof x> => !!x);
            return items.length === 0 ? (
              <EmptyState
                icon="bookmark-outline"
                title="Nothing saved yet"
                body="Tap the bookmark on a story to keep it here."
              />
            ) : (
              <Group>
                {items.map((i) => (
                  <ListRow
                    key={i.id}
                    title={i.title}
                    subtitle={i.eyebrow ?? undefined}
                    onPress={() => router.push(`/news/${i.id}`)}
                  />
                ))}
              </Group>
            );
          }}
        </QueryState>
      </View>
    </Screen>
  );
}
