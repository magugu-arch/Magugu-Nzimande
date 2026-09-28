import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  DishFeatureCard,
  FavouriteButton,
  SampleContentNote,
  wineStyleLabel,
} from '@/components/mabu/Menu';
import {
  BrassRule,
  Card,
  ErrorState,
  Header,
  LoadingBlock,
  Photo,
  Screen,
  SectionTitle,
  Text,
} from '@/components/ui';
import { formatRand } from '@/domain/shared/format';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { useFavourite } from '@/features/useFavourite';
import { radius, spacing } from '@/theme';
import { track } from '@/utils/analytics';

export default function WineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useRpc('content.wine', { id });
  const fav = useFavourite('wine', id);
  useEffect(() => track('wine_item_viewed', { id }), [id]);

  if (q.isPending)
    return (
      <Screen header={<Header title="Wine" />}>
        <LoadingBlock />
      </Screen>
    );
  if (q.isError)
    return (
      <Screen header={<Header title="Wine" />}>
        <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
      </Screen>
    );
  const { wine, pairings } = q.data;

  return (
    <Screen
      header={
        <Header
          title="Wine"
          right={<FavouriteButton saved={fav.saved} onToggle={fav.toggle} label={wine.name} />}
        />
      }
    >
      <Photo photo="dish-wines" label="Wine being poured" style={styles.photo} />
      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        <Text variant="eyebrow" color="accent">
          {wineStyleLabel(wine.style)}
        </Text>
        <Text variant="eyebrow" color="textMuted">
          {wine.producer}
        </Text>
        <Text variant="h1" accessibilityRole="header">
          {wine.name}
          {wine.vintage ? ` ${wine.vintage}` : ''}
        </Text>
        <Text variant="body" color="textMuted">
          {wine.varietal} · {wine.region}
        </Text>
        <BrassRule />
        <Text variant="quote">{wine.tastingNotes}</Text>
      </View>
      <Card style={{ marginTop: spacing.xl, flexDirection: 'row', justifyContent: 'space-around' }}>
        {wine.glassPriceCents ? (
          <View style={{ alignItems: 'center' }}>
            <Text variant="eyebrow" color="textMuted">
              Glass
            </Text>
            <Text variant="h3" color="accent">
              {formatRand(wine.glassPriceCents)}
            </Text>
          </View>
        ) : null}
        <View style={{ alignItems: 'center' }}>
          <Text variant="eyebrow" color="textMuted">
            Bottle
          </Text>
          <Text variant="h3" color="accent">
            {formatRand(wine.bottlePriceCents)}
          </Text>
        </View>
      </Card>
      {pairings.length ? (
        <>
          <SectionTitle eyebrow="At the table" title="Pairs with" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.lg }}
          >
            {pairings.map((d) => (
              <DishFeatureCard key={d.id} dish={d} width={170} />
            ))}
          </ScrollView>
        </>
      ) : null}
      {wine.isSample ? (
        <View style={{ marginTop: spacing.xl }}>
          <SampleContentNote what="wine list" />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { height: 220, borderRadius: radius.md, marginTop: spacing.md },
});
