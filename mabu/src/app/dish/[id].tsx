import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  dishBadges,
  ExperienceBadge,
  FavouriteButton,
  SampleContentNote,
  WineCard,
} from '@/components/mabu/Menu';
import {
  BrassRule,
  ErrorState,
  Header,
  IconButton,
  LoadingBlock,
  Photo,
  PremiumButton,
  Screen,
  SectionTitle,
  Text,
} from '@/components/ui';
import { formatRand } from '@/domain/shared/format';
import { breadcrumbSchema, dishSchema } from '@/seo/structured';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { snapshotIds } from '@/seo/staticParams';
import { useFavourite } from '@/features/useFavourite';
import { colors, radius, spacing } from '@/theme';
import { track } from '@/utils/analytics';
import { shareText } from '@/utils/linking';

const SPICE = ['', 'Mild heat', 'Medium heat', 'Hot'];

/** §25 MenuItemDetailSheet — presented as a modal over the menu. */
/** One page per item in the web export (see src/seo/staticParams.ts). */
export function generateStaticParams(): { id: string }[] {
  return snapshotIds('content.dish');
}

export default function DishDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const q = useRpc('content.dish', { id });
  const fav = useFavourite('dish', id);

  useEffect(() => track('menu_item_viewed', { id }), [id]);

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

  const { dish, pairings } = q.data;
  const badges = dishBadges(dish);

  return (
    <Screen
      meta={{
        title: dish.name,
        description: `${dish.description} On the menu at Mábu, Waterfall City, Midrand.`,
        path: `/dish/${dish.id}`,
        type: 'article',
        schema: [
          dishSchema(dish),
          breadcrumbSchema([
            { name: 'Menu', path: '/menu' },
            { name: dish.name, path: `/dish/${dish.id}` },
          ]),
        ],
      }}
      padded={false}
      topInset={false}
      header={
        <Header
          transparent
          right={
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <IconButton
                icon="share"
                label="Share this dish"
                onPhoto
                onPress={() =>
                  void shareText(dish.name, `${dish.name} at Mábu — ${dish.description}`)
                }
              />
              <FavouriteButton saved={fav.saved} onToggle={fav.toggle} label={dish.name} onPhoto />
            </View>
          }
        />
      }
      footer={<PremiumButton label="Book your table" onPress={() => router.navigate('/book')} />}
    >
      <Photo
        photo={dish.photo ?? 'texture-marble'}
        label={dish.photo ? dish.name : ''}
        style={{ width, height: width * 1.05 }}
        scrim="bottom"
      />
      <View style={styles.body}>
        {badges.length ? (
          <View style={styles.badges}>
            {badges.map((b) => (
              <ExperienceBadge key={b.label} label={b.label} tone={b.tone} />
            ))}
          </View>
        ) : null}
        <Text variant="h1" accessibilityRole="header">
          {dish.name}
        </Text>
        <Text variant="h3" color="accent">
          {formatRand(dish.priceCents)}
        </Text>
        <BrassRule />
        <Text variant="body" color="textMuted">
          {dish.description}
        </Text>
        {!dish.available ? (
          <Text variant="bodySmall" color="copper">
            Sold out today — please ask your server about tonight&apos;s alternatives.
          </Text>
        ) : null}

        {dish.provenance || dish.preparation ? (
          <View style={styles.story}>
            {dish.provenance ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="eyebrow" color="accent">
                  Provenance
                </Text>
                <Text variant="body">{dish.provenance}</Text>
              </View>
            ) : null}
            {dish.preparation ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="eyebrow" color="accent">
                  Preparation
                </Text>
                <Text variant="body">{dish.preparation}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {dish.modifiers?.length ? (
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            {dish.modifiers.map((m) => (
              <View key={m.id} style={{ gap: spacing.xs }}>
                <Text variant="eyebrow" color="textMuted">
                  {m.name}
                  {m.required ? '' : ' · optional'}
                </Text>
                <Text variant="bodySmall">
                  {m.options
                    .map(
                      (o) =>
                        `${o.name}${o.priceDeltaCents ? ` (+${formatRand(o.priceDeltaCents)})` : ''}`,
                    )
                    .join(' · ')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.facts}>
          <Text variant="eyebrow" color="textMuted">
            Allergens
          </Text>
          <Text variant="bodySmall">
            {dish.allergens.length
              ? `Contains ${dish.allergens.join(', ')}.`
              : 'No major allergens listed.'}{' '}
            Please tell us about any allergy — our kitchen will guide you.
          </Text>
          {dish.spiceLevel ? (
            <Text variant="bodySmall" color="copper">
              {SPICE[dish.spiceLevel]}
            </Text>
          ) : null}
        </View>

        {pairings.length ? (
          <>
            <SectionTitle eyebrow="Sommelier's pairing" title="Pairs beautifully with" />
            {pairings.map((w) => (
              <WineCard key={w.id} wine={w} />
            ))}
          </>
        ) : null}

        {dish.isSample ? (
          <View style={{ marginTop: spacing.xl }}>
            <SampleContentNote what="dish" />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.gutter, gap: spacing.md, marginTop: -spacing.xxl },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  story: {
    gap: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  facts: {
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
