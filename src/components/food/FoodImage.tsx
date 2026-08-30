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
  /**
   * Whether this photograph is on screen the moment the screen opens.
   *
   * Omit it and the variant decides, which is right nearly everywhere. Pass it
   * when the variant cannot know — and it decides in **both** directions:
   *
   *   `true`   load first, do not defer. A `card` at the top of a screen.
   *   `false`  demote. A hero-sized image that is *not* on screen yet — the
   *            second and third slides of a carousel, which are `detail`
   *            surfaces by shape and off-screen by position.
   */
  aboveTheFold?: boolean;
  testID?: string;
}

const VARIANT_ASPECT: Record<ImageVariant, number> = {
  thumb: aspect.thumb,
  card: aspect.card,
  detail: aspect.detail,
  banner: aspect.banner,
};

/**
 * §13: "Lazy-load below-the-fold imagery while prioritising hero and first-view
 * menu assets."
 *
 * Both halves, and the second is the one that needed doing. `expo-image`
 * already defers on web — `loading` defaults to `'lazy'` — so below-the-fold
 * was handled and the *hero* was being deferred with everything else, which is
 * the wrong image to make wait. Meanwhile every load queued at the same
 * priority, so on a slow connection a category tile scrolled past could be
 * fetched ahead of the thing filling the screen.
 *
 * Derived from the variant rather than asked of every caller, for the reason
 * the variant itself is: a rule each screen has to remember is a rule some
 * screen forgets. The surface a photograph is drawn on already says how urgent
 * it is —
 *
 *   `banner`, `detail`  a hero. On screen at open, and the largest file. First.
 *   `card`              a catalogue tile. Some are visible, most are not.
 *   `thumb`             a menu row, cart line or reorder chip. Almost always
 *                       below the fold, and small enough that arriving late
 *                       costs nothing.
 *
 * `aboveTheFold` overrides it for the exception the variant cannot know about.
 */
const LOAD_BEHAVIOUR: Record<
  ImageVariant,
  { priority: 'low' | 'normal' | 'high'; eager: boolean }
> = {
  banner: { priority: 'high', eager: true },
  detail: { priority: 'high', eager: true },
  card: { priority: 'normal', eager: false },
  thumb: { priority: 'low', eager: false },
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
  aboveTheFold,
  testID,
}: FoodImageProps) {
  const source = resolveFoodAsset(assetKey, variant);
  const label = FOOD_ASSET_LABELS[assetKey];
  const ratio = aspectRatio ?? VARIANT_ASPECT[variant];
  const behaviour = LOAD_BEHAVIOUR[variant];
  // Explicit wins over the variant's guess, whichever way it points; omitted
  // falls back to the variant, which is the common case.
  const eager = aboveTheFold ?? behaviour.eager;
  const priority = aboveTheFold === undefined ? behaviour.priority : aboveTheFold ? 'high' : 'low';

  return (
    <View
      testID={testID}
      style={[styles.container, { aspectRatio: ratio, borderRadius: radius[rounded] }, style]}
    >
      {source ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={220}
          cachePolicy="memory-disk"
          priority={priority}
          // Web only, and it needs setting in both directions: the default is
          // already 'lazy', which is right for a menu row and wrong for the
          // hero the screen opened on.
          loading={eager ? 'eager' : 'lazy'}
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
          // `props.pointerEvents` is deprecated in React Native 0.86; it lives
          // in the style now. The scrim is paint, and must never eat a tap
          // meant for what it sits over.
          style={[StyleSheet.absoluteFill, styles.scrim]}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  scrim: { pointerEvents: 'none' },
  container: {
    overflow: 'hidden',
    backgroundColor: colors.imagePlaceholder,
  },
});
