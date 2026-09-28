import { View } from 'react-native';
import { router } from 'expo-router';
import { MenuItemCard, WineCard } from '@/components/mabu/Menu';
import { EmptyState, Header, LoadingBlock, Screen, Text } from '@/components/ui';
import { useRpc } from '@/services/queries';
import { spacing } from '@/theme';

/** §16 Favourites — saved dishes and wines. */
export default function Favourites() {
  const favs = useRpc('favourites.list');
  const menu = useRpc('content.menu');
  if (favs.isPending || menu.isPending)
    return (
      <Screen header={<Header title="Favourites" />}>
        <LoadingBlock />
      </Screen>
    );
  const dishes =
    menu.data?.dishes.filter((d) =>
      favs.data?.some((f) => f.kind === 'dish' && f.itemId === d.id),
    ) ?? [];
  const wines =
    menu.data?.wines.filter((w) =>
      favs.data?.some((f) => f.kind === 'wine' && f.itemId === w.id),
    ) ?? [];

  return (
    <Screen header={<Header title="Favourites" />}>
      {!dishes.length && !wines.length ? (
        <EmptyState
          icon="heart"
          title="Nothing saved yet"
          body="Tap the heart on any dish or wine to keep it here."
          action="Explore the menu"
          onAction={() => router.push('/menu')}
        />
      ) : null}
      {dishes.length ? (
        <View style={{ marginTop: spacing.lg }}>
          <Text variant="eyebrow" color="accent">
            Dishes
          </Text>
          {dishes.map((d) => (
            <MenuItemCard key={d.id} dish={d} />
          ))}
        </View>
      ) : null}
      {wines.length ? (
        <View style={{ marginTop: spacing.xl }}>
          <Text variant="eyebrow" color="accent">
            Wines
          </Text>
          {wines.map((w) => (
            <WineCard key={w.id} wine={w} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
