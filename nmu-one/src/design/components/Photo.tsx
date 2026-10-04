import type { ReactNode } from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { photoLibrary, photoSource, type PhotoKey, type PhotoSize } from '@/content/photos';
import { colors, motion, radius, spacing } from '../tokens';
import { useReduceMotion } from '../useReduceMotion';
import { Text } from './Text';

export interface PhotoProps {
  photo: PhotoKey;
  size?: PhotoSize;
  style?: StyleProp<ImageStyle>;
  rounded?: boolean;
  /** Decorative photos are hidden from screen readers; informative ones read their alt text. */
  decorative?: boolean;
}

/**
 * A photograph from the library (src/content/photos.ts). Screens name a slot,
 * never a file, and the slot's focal point keeps faces in frame however the
 * placement crops it.
 */
export function Photo({ photo, size = 'md', style, rounded = true, decorative = false }: PhotoProps) {
  const slot = photoLibrary[photo];
  const reduceMotion = useReduceMotion();
  return (
    <Image
      source={photoSource(photo, size)}
      contentFit="cover"
      contentPosition={slot.focus}
      transition={reduceMotion ? 0 : motion.base}
      cachePolicy="memory-disk"
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : slot.alt}
      accessibilityIgnoresInvertColors
      style={[styles.fill, rounded ? styles.rounded : null, style]}
    />
  );
}

/**
 * Hero imagery for major entry points (brief §18 "hero imagery for
 * onboarding / launch / major feature worlds"): a photograph with a navy
 * scrim and an editorial statement over it.
 */
export function PhotoHero({
  photo,
  eyebrow,
  title,
  subtitle,
  height = 300,
  children,
  topBar,
}: {
  photo: PhotoKey;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  height?: number;
  children?: ReactNode;
  topBar?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { height: height + insets.top }]}>
      <Photo photo={photo} size="lg" rounded={false} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(20,28,43,0.35)', 'rgba(20,28,43,0.05)', colors.overlayBottom]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      {topBar ? <View style={[styles.topBar, { paddingTop: insets.top }]}>{topBar}</View> : null}
      <View style={styles.heroText}>
        {eyebrow ? (
          <Text variant="overline" color={colors.yellow}>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="display" color={colors.white} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodyLarge" color={colors.textOnDarkMuted}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  rounded: { borderRadius: radius.lg },
  hero: { width: '100%', justifyContent: 'flex-end', backgroundColor: colors.navy },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' },
  heroText: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xl, gap: spacing.xs },
});
