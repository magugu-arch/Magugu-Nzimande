import { useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MenuItemCard } from '@/components/mabu/Menu';
import { ErrorState, Header, IconButton, LoadingBlock, Photo, Screen, Text } from '@/components/ui';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { snapshotIds } from '@/seo/staticParams';
import { breadcrumbSchema } from '@/seo/structured';
import { spacing } from '@/theme';
import { shareText } from '@/utils/linking';

/** §8 Collection — a curated set of dishes, shareable (§10). */
/** One page per item in the web export (see src/seo/staticParams.ts). */
export function generateStaticParams(): { id: string }[] {
  return snapshotIds('content.collection');
}

export default function Collection() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const q = useRpc('content.collection', { id });

  if (q.isPending)
    return (
      <Screen header={<Header title="" />}>
        <LoadingBlock />
      </Screen>
    );
  if (q.isError)
    return (
      <Screen header={<Header title="" />}>
        <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
      </Screen>
    );
  const { collection, dishes } = q.data;

  return (
    <Screen
      meta={{
        title: collection.name,
        description: `${collection.description} At Mábu, Waterfall City, Midrand.`,
        path: `/collection/${collection.id}`,
        schema: [
          breadcrumbSchema([
            { name: 'Discover', path: '/discover' },
            { name: collection.name, path: `/collection/${collection.id}` },
          ]),
        ],
      }}
      padded={false}
      topInset={false}
      header={
        <Header
          transparent
          right={
            <IconButton
              icon="share"
              label="Share this collection"
              onPhoto
              onPress={() =>
                void shareText(
                  collection.name,
                  `${collection.name} at Mábu — ${collection.description}`,
                )
              }
            />
          }
        />
      }
    >
      <Photo
        photo={collection.photo}
        label={collection.name}
        style={{ width, height: width * 0.9 }}
        scrim="bottom"
      />
      <View
        style={{ paddingHorizontal: spacing.gutter, marginTop: -spacing.xxxl, gap: spacing.sm }}
      >
        <Text variant="eyebrow" color="accent">
          Collection
        </Text>
        <Text variant="h1" accessibilityRole="header">
          {collection.name}
        </Text>
        <Text variant="body" color="textMuted">
          {collection.description}
        </Text>
        <View style={{ marginTop: spacing.lg }}>
          {dishes.map((d) => (
            <MenuItemCard key={d.id} dish={d} />
          ))}
        </View>
      </View>
    </Screen>
  );
}
