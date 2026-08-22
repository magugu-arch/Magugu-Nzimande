import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Promotion } from '@/types';
import { FoodImage } from '@/components/food/FoodImage';
import { Badge, Text } from '@/components/ui';
import { absoluteFill, colors, radius, spacing } from '@/theme';

export interface PromotionBannerProps {
  promotion: Promotion;
  onPress: () => void;
  width?: number;
  /** 16:9 hero on Home, taller card in the Offers list. */
  size?: 'hero' | 'compact';
  testID?: string;
}

/**
 * Home promotion (brief §9): promotional compositions are allowed here, so
 * campaign typography sits over the food behind a legibility scrim.
 */
export const PromotionBanner = memo(function PromotionBanner({
  promotion,
  onPress,
  width,
  size = 'hero',
  testID,
}: PromotionBannerProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${promotion.headline}. ${promotion.description}`}
      accessibilityHint="Opens the offer"
      style={({ pressed }) => [
        styles.container,
        width !== undefined ? { width } : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <FoodImage
        assetKey={promotion.assetKey}
        variant="banner"
        aspectRatio={size === 'hero' ? 16 / 9 : 3 / 2}
        rounded="none"
        withScrim
        scrimIntensity="strong"
      />

      <View style={styles.overlay}>
        {promotion.promoCode ? (
          <Badge label={`Code ${promotion.promoCode}`} tone="primary" />
        ) : (
          <Badge label="Offer" tone="onImage" />
        )}

        <Text variant={size === 'hero' ? 'h1' : 'h2'} color={colors.textOnDark} numberOfLines={2}>
          {promotion.headline}
        </Text>
        <Text variant="caption" color={colors.textOnDarkMuted} numberOfLines={2}>
          {promotion.description}
        </Text>

        <View style={styles.cta}>
          <Text variant="captionMedium" color={colors.onPrimary}>
            {promotion.ctaLabel}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={colors.onPrimary} />
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.brand.black,
  },
  overlay: {
    ...absoluteFill,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  pressed: { opacity: 0.94 },
});
