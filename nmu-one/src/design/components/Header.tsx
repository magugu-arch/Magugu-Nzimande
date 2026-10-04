import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { colors, spacing } from '../tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface HeaderProps {
  title?: string;
  /** Large editorial title below the bar (brief §17 "large editorial headings"). */
  largeTitle?: string;
  eyebrow?: string;
  subtitle?: string;
  /** Where Back goes when there is no history (a deep link opened cold). */
  fallbackHref?: Href;
  back?: boolean;
  right?: ReactNode;
  tone?: 'canvas' | 'navy';
}

export function Header({
  title,
  largeTitle,
  eyebrow,
  subtitle,
  fallbackHref = '/home',
  back = true,
  right,
  tone = 'canvas',
}: HeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const onDark = tone === 'navy';
  const fg = onDark ? colors.white : colors.navy;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(fallbackHref));

  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top, backgroundColor: onDark ? colors.navy : colors.background },
      ]}
    >
      <View style={styles.bar}>
        <View style={styles.side}>
          {back ? (
            <IconButton
              icon="chevron-back"
              label="Back"
              onPress={goBack}
              tone={onDark ? 'onDark' : 'plain'}
              testID="header-back"
            />
          ) : null}
        </View>
        <View style={styles.titleWrap}>
          {title ? (
            <Text variant="label" color={fg} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
        </View>
        <View style={[styles.side, styles.right]}>{right}</View>
      </View>
      {largeTitle ? (
        <View style={styles.large}>
          {eyebrow ? (
            <Text variant="overline" color={onDark ? colors.yellow : colors.textSecondary}>
              {eyebrow}
            </Text>
          ) : null}
          <Text variant="title1" color={fg} accessibilityRole="header">
            {largeTitle}
          </Text>
          {subtitle ? (
            <Text variant="body" color={onDark ? colors.textOnDarkMuted : colors.textSecondary}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.sm },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  side: { minWidth: 48, flexDirection: 'row', alignItems: 'center' },
  right: { justifyContent: 'flex-end' },
  titleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  large: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
});

/** A back button that sits over a hero photograph. */
export function HeroBack({ fallbackHref = '/home' }: { fallbackHref?: Href }) {
  const router = useRouter();
  return (
    <IconButton
      icon="chevron-back"
      label="Back"
      tone="onPhoto"
      testID="header-back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackHref))}
    />
  );
}
