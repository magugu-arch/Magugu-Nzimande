import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageStyle } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { photoRegistry, type PhotoKey } from '@/content/photoRegistry';
import { colors } from '@/theme';
import { useReduceMotion } from '@/utils/useReduceMotion';

export function isPhotoKey(key: string | undefined): key is PhotoKey {
  return !!key && key in photoRegistry;
}

/**
 * Every photograph goes through here, by registry key, so a CMS-supplied key
 * that does not exist yet degrades to the brand texture rather than a blank.
 * Pass an empty `label` for purely decorative texture so screen readers skip it.
 */
export function Photo({
  photo,
  style,
  label,
  scrim,
  contentPosition = 'center',
  priority,
}: {
  photo?: string;
  style?: StyleProp<ImageStyle>;
  label: string;
  scrim?: 'bottom' | 'hero' | 'full' | 'top';
  contentPosition?: 'center' | 'top' | 'bottom';
  priority?: 'high' | 'normal' | 'low';
}) {
  const reduce = useReduceMotion();
  const key: PhotoKey = isPhotoKey(photo) ? photo : 'texture-pattern';
  /**
   * The frame carries the picture's name, and the image inside it is hidden
   * from assistive technology: one announcement per photograph, and a
   * decorative texture is announced not at all. On the web that also gives
   * every <img> the empty alt a decorative image is supposed to have.
   */
  const described = label
    ? ({
        accessible: true,
        accessibilityRole: 'image',
        accessibilityLabel: label,
        'aria-label': label,
      } as const)
    : ({ accessible: false, 'aria-hidden': true } as const);
  return (
    <View style={[styles.frame, style as StyleProp<ViewStyle>]} {...described}>
      <Image
        source={photoRegistry[key].source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={contentPosition}
        transition={reduce ? 0 : 400}
        accessibilityLabel=""
        accessible={false}
        aria-hidden
        priority={priority}
      />
      {scrim === 'bottom' ? (
        <LinearGradient
          colors={['transparent', 'rgba(11,11,11,0.35)', colors.background]}
          locations={[0.35, 0.65, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : scrim === 'hero' ? (
        <LinearGradient
          colors={['rgba(11,11,11,0.45)', 'transparent', 'rgba(11,11,11,0.55)', colors.background]}
          locations={[0, 0.22, 0.6, 0.97]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : scrim === 'top' ? (
        <LinearGradient
          colors={['rgba(11,11,11,0.7)', 'transparent']}
          locations={[0, 0.35]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : scrim === 'full' ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.surface },
});
