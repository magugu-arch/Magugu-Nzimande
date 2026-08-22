import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FOOD_ASSET_LABELS,
  resolveFoodAsset,
  type FoodAssetKey,
  type ImageVariant,
} from '@/constants/foodAssets';
import { aspect, colors, radius } from '@/theme';
import { FoodImagePlaceholder } from './FoodImagePlaceholder';

export interface FoodImageProps {
  assetKey: FoodAssetKey;
  /**
   * Which derivative to load. Pick the smallest that covers the surface —
   * never `detail` or `banner` inside a list (brief §15).
   */
  variant: ImageVariant;
  /** Defaults to the variant's native ratio so nothing is ever stretched. */
  aspectRatio?: number;
  rounded?: keyof typeof radius;
  /** Dark gradient at the base of the image, so overlaid text stays legible. */
  withScrim?: boolean;
  scrimIntensity?: 'soft' | 'strong';
  contentFit?: ImageContentFit;
  style?: StyleProp<ViewStyle>;
  /** Renders the compact placeholder variant when artwork is missing. */
  compactPlaceholder?: boolean;
  testID?: string;
}

const VARIANT_ASPECT: Record<ImageVariant, number> = {
  thumb: aspect.thumb,
  card: aspect.card,
  detail: aspect.detail,
  banner: aspect.banner,
};

/**
 * The single way food photography enters the UI.
 *
 * Enforces the brief's imagery rules in one place: correct derivative per
 * surface, `cover` fit at a fixed ratio so nothing distorts, and a branded
 * fallback when a supplied master is still outstanding.
 */
export const FoodImage = memo(function FoodImage({
  assetKey,
  variant,
  aspectRatio,
  rounded = 'lg',
  withScrim = false,
  scrimIntensity = 'soft',
  contentFit = 'cover',
  style,
  compactPlaceholder = false,
  testID,
}: FoodImageProps) {
  const source = resolveFoodAsset(assetKey, variant);
  const label = FOOD_ASSET_LABELS[assetKey];
  const ratio = aspectRatio ?? VARIANT_ASPECT[variant];

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        { aspectRatio: ratio, borderRadius: radius[rounded] },
        style,
      ]}
    >
      {source ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={220}
          cachePolicy="memory-disk"
          accessible
          accessibilityLabel={label}
          recyclingKey={`${assetKey}-${variant}`}
        />
      ) : (
        <FoodImagePlaceholder
          label={label}
          compact={compactPlaceholder}
          style={StyleSheet.absoluteFill}
        />
      )}

      {withScrim ? (
        <LinearGradient
          colors={scrimIntensity === 'strong' ? colors.heroScrim : colors.imageScrim}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.imagePlaceholder,
  },
});
