import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, MIN_TOUCH_TARGET } from '@/theme';
import { useFavouritesStore, useIsFavourite } from '@/store/favouritesStore';

export interface FavouriteButtonProps {
  productId: string;
  /** The product's name, so the control says what it acts on. */
  productName: string;
  size?: 'sm' | 'md';
  /** Sits over food photography, where a plain outline would disappear. */
  onImage?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const ICON = { sm: 18, md: 22 } as const;

/**
 * Heart toggle (§23.6 names the icon; the app owes it to the onboarding copy).
 *
 * State is carried by the icon's shape, filled against outline, not only by
 * its colour — §32.4 asks that colour never be the sole signal, and a red
 * outline against a red fill is a poor distinction at 18pt anyway. The
 * accessible name says which product, because a screen-reader user meeting
 * "Favourite" sixteen times down a menu learns nothing.
 */
export const FavouriteButton = memo(function FavouriteButton({
  productId,
  productName,
  size = 'md',
  onImage = false,
  style,
  testID,
}: FavouriteButtonProps) {
  const favourite = useIsFavourite(productId);
  const toggle = useFavouritesStore((state) => state.toggle);

  const onPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle(productId);
  }, [toggle, productId]);

  const tint = favourite ? colors.primary : onImage ? colors.textOnDark : colors.textMuted;
  const box = size === 'md' ? 40 : 32;
  const slop = Math.max(0, MIN_TOUCH_TARGET - box) / 2;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
      accessibilityRole="button"
      accessibilityState={{ selected: favourite }}
      accessibilityLabel={
        favourite ? `Remove ${productName} from favourites` : `Add ${productName} to favourites`
      }
      style={({ pressed }) => [
        styles.base,
        { width: box, height: box },
        onImage ? styles.onImage : null,
        pressed ? styles.pressed : null,
        style,
      ]}
      testID={testID ?? `favourite-${productId}`}
    >
      <Ionicons name={favourite ? 'heart' : 'heart-outline'} size={ICON[size]} color={tint} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  // A scrim, so an outline heart stays visible over a bright crop of chicken.
  onImage: { backgroundColor: colors.scrim },
  pressed: { opacity: 0.7, transform: [{ scale: 0.92 }] },
});
