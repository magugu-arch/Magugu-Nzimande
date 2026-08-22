import { Dimensions, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { PromotionBanner } from '@/features/home/components/PromotionBanner';
import { usePromotions } from '@/features/rewards/hooks';
import { colors, spacing } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

/** Offers list (brief §4). Entirely data-driven from the promotions service. */
export default function OffersScreen() {
  const router = useRouter();
  const promotions = usePromotions();

  if (promotions.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Offers" />
        <LoadingState />
      </Screen>
    );
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
              width={BANNER_WIDTH}
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
