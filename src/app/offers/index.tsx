import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineState,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { isOfflinePending } from '@/features/system/queryPhase';
import { PromotionBanner } from '@/features/home/components/PromotionBanner';
import { usePromotions } from '@/features/rewards/hooks';
import { colors, spacing } from '@/theme';

/** Offers list (brief §4). Entirely data-driven from the promotions service. */
export default function OffersScreen() {
  const router = useRouter();
  const promotions = usePromotions();

  /*
    Derived from the window when it is read, not once at import.

    A number captured at module scope is correct exactly until the window
    changes size, and then it is wrong with no way of finding out: a browser
    drag on the web build, a Split View or Slide Over on a tablet, a foldable
    opening. `useWindowDimensions` re-renders with the new size, which is the
    whole reason it exists.
  */
  const bannerWidth = useWindowDimensions().width - spacing.lg * 2;

  if (promotions.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Offers" />
        <LoadingState />
      </Screen>
    );
  }

  // Offline is not empty and not broken. Without this the screen falls

  // through to a factual claim it cannot back up.

  if (isOfflinePending(promotions)) {
    return <OfflineState onRetry={() => void promotions.refetch()} />;
  }

  if (promotions.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Offers" />
        <ErrorState onRetry={() => void promotions.refetch()} />
      </Screen>
    );
  }

  const list = promotions.data ?? [];

  return (
    <Screen scroll edges={['top', 'bottom']} testID="offers-screen">
      <ScreenHeader title="Offers" subtitle={`${list.length} running now`} />

      {list.length === 0 ? (
        <EmptyState
          icon="pricetags-outline"
          title="No offers right now"
          message="Nothing running at the moment. We'll let you know the second something lands."
          actionLabel="Browse the menu"
          onActionPress={() => router.push('/(tabs)/menu')}
        />
      ) : (
        <View style={styles.list}>
          <Text variant="body" color={colors.textSecondary}>
            Deals, discounts and members-only drops. Tap any offer for the full terms.
          </Text>

          {list.map((promotion) => (
            <PromotionBanner
              key={promotion.id}
              promotion={promotion}
              width={bannerWidth}
              onPress={() => router.push(`/offers/${promotion.id}`)}
              testID={`offer-${promotion.id}`}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
});
