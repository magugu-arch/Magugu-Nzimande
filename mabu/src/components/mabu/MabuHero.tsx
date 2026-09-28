import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { spacing } from '@/theme';
import { Photo, Text } from '../ui';
import { enter } from '@/utils/motion';

/**
 * §25 MabuHero — full-bleed cinematic photograph fading into obsidian, with
 * the editorial copy set low on it. The text rises in once, gently; with
 * Reduce Motion on it simply appears.
 */
export function MabuHero({
  photo,
  label,
  eyebrow,
  title,
  subtitle,
  children,
  heightRatio = 0.72,
  maxHeight = 640,
}: {
  photo: string;
  label: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  heightRatio?: number;
  maxHeight?: number;
}) {
  const { height, width } = useWindowDimensions();
  const h = Math.min(maxHeight, Math.max(420, height * heightRatio));
  return (
    <View style={{ height: h, width }}>
      <Photo
        photo={photo}
        label={label}
        scrim="hero"
        style={StyleSheet.absoluteFill}
        priority="high"
      />
      <Animated.View
        entering={enter(FadeInDown.duration(700).delay(150).reduceMotion(ReduceMotion.System))}
        style={styles.copy}
      >
        {eyebrow ? (
          <Text variant="eyebrow" color="accent">
            {eyebrow}
          </Text>
        ) : null}
        <Text
          variant="hero"
          accessibilityRole="header"
          style={width < 360 ? { fontSize: 33, lineHeight: 43 } : null}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="eyebrow" color="textMuted" style={{ letterSpacing: 1.6 }}>
            {subtitle}
          </Text>
        ) : null}
        {children ? <View style={styles.actions}>{children}</View> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: spacing.xl,
    gap: spacing.md,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
