import type { ReactNode, RefObject } from 'react';
import { StyleSheet, View, type ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useScrollToTop } from 'expo-router';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { MIN_TOUCH, space } from '@/design/tokens';
import { Material } from './Material';
import { PressableScale } from './PressableScale';
import { TAB_BAR_HEIGHT } from './TabBar';
import { Text } from './Text';

export const HEADER_HEIGHT = 48;

type Props = {
  /** The inline title in the bar. */
  title: string;
  /** A large title at the top of the content that hands over to the inline one. */
  largeTitle?: boolean;
  subtitle?: string;
  /** Full-bleed media under a transparent bar; the bar materialises once it scrolls past. */
  hero?: ReactNode;
  heroHeight?: number;
  /** Replaces the inline title. */
  center?: ReactNode;
  /** A typeset wordmark in the bar: white over hero media, ink once the bar materialises. */
  wordmark?: string;
  left?: ReactNode;
  right?: ReactNode;
  /** Pushed screens get a back button by default; tab roots do not. */
  back?: boolean;
  /** A floating bar at the bottom for the screen's main action. */
  actionBar?: ReactNode;
  inTabs?: boolean;
  children: ReactNode;
};

/**
 * A scrolling page with Apple-style chrome, all driven on the UI thread by
 * one scroll value: the large title collapses into the bar, the bar's
 * material appears only once content passes beneath it (a scroll-edge effect
 * rather than a permanent divider), and hero media parallaxes and stretches
 * on overscroll. Reduce Motion keeps the material change and drops the rest.
 */
export function Screen({
  title,
  largeTitle,
  subtitle,
  hero,
  heroHeight = 520,
  center,
  wordmark,
  left,
  right,
  back,
  actionBar,
  inTabs,
  children,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  const ref = useAnimatedRef<Animated.ScrollView>();
  useScrollToTop(ref as unknown as RefObject<ScrollView>);

  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });

  const edgeStart = hero ? heroHeight - HEADER_HEIGHT - 30 : 0;
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [edgeStart, edgeStart + 24], [0, 1], Extrapolation.CLAMP),
  }));
  const titleStyle = useAnimatedStyle(() => {
    if (!largeTitle && !hero) return { opacity: 1 };
    const start = hero ? edgeStart : 22;
    return { opacity: interpolate(y.value, [start, start + 24], [0, 1], Extrapolation.CLAMP) };
  });
  const overMediaStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [edgeStart, edgeStart + 24], [1, 0], Extrapolation.CLAMP),
  }));
  const largeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduced || y.value >= 0 ? 1 : 1 + Math.min(-y.value, 80) / 700 }],
    transformOrigin: 'left bottom',
  }));
  const heroStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    return y.value < 0
      ? { transform: [{ translateY: y.value / 2 }, { scale: 1 + -y.value / heroHeight }] }
      : { transform: [{ translateY: Math.min(y.value, heroHeight) * 0.28 }] };
  });

  const bottomPad = (inTabs ? TAB_BAR_HEIGHT : 0) + (actionBar ? 88 : 0) + insets.bottom + space.xl;
  const showBack = back ?? !inTabs;

  return (
    <View style={[styles.fill, { backgroundColor: colors.paper }]}>
      <Animated.ScrollView
        ref={ref}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: hero ? 0 : HEADER_HEIGHT, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {hero ? (
          <View style={{ height: heroHeight, overflow: 'hidden' }}>
            <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>{hero}</Animated.View>
          </View>
        ) : null}
        {largeTitle ? (
          <Animated.View style={[styles.large, largeStyle]}>
            <Text variant="display" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="subhead" color="ink3" style={{ marginTop: space.xs }}>
                {subtitle}
              </Text>
            ) : null}
          </Animated.View>
        ) : null}
        {children}
      </Animated.ScrollView>

      <View style={styles.header} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, barStyle]} pointerEvents="none">
          <Material />
          <View style={[styles.hairline, { backgroundColor: colors.hairline }]} />
        </Animated.View>
        <View style={styles.side}>
          {showBack ? (
            <HeaderButton
              icon="chevron-back"
              label="Back"
              onMedia={!!hero}
              onPress={() => router.back()}
            />
          ) : null}
          {left}
        </View>
        <View style={styles.center} pointerEvents="none">
          {wordmark ? (
            <View accessible accessibilityLabel={`${wordmark} (wordmark placeholder)`}>
              <Animated.View style={barStyle}>
                <Text variant="eyebrow" style={styles.wordmark} maxFontSizeMultiplier={1.2}>
                  {wordmark}
                </Text>
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, overMediaStyle]}>
                <Text
                  variant="eyebrow"
                  color="white"
                  style={[styles.wordmark, styles.wordmarkShadow]}
                  maxFontSizeMultiplier={1.2}
                >
                  {wordmark}
                </Text>
              </Animated.View>
            </View>
          ) : null}
          {wordmark
            ? null
            : (center ?? (
                <Animated.View style={titleStyle}>
                  <Text
                    variant="headline"
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.3}
                    accessibilityRole={largeTitle || hero ? undefined : 'header'}
                    importantForAccessibility={largeTitle || hero ? 'no-hide-descendants' : 'yes'}
                  >
                    {title}
                  </Text>
                </Animated.View>
              ))}
        </View>
        <View style={[styles.side, styles.end]}>{right}</View>
      </View>

      {actionBar ? (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + space.m }]}>
          <Material />
          <View
            style={[
              styles.hairline,
              { top: 0, bottom: undefined, backgroundColor: colors.hairline },
            ]}
          />
          {actionBar}
        </View>
      ) : null}
    </View>
  );
}

export function HeaderButton({
  icon,
  label,
  onPress,
  onMedia,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  onMedia?: boolean;
  badge?: number;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        badge !== undefined ? `${label}, ${badge} ${badge === 1 ? 'item' : 'items'}` : label
      }
      hitSlop={4}
      style={[styles.iconButton, onMedia && styles.onMedia]}
    >
      {onMedia ? <Material style={{ borderRadius: 19 }} /> : null}
      <Ionicons name={icon} size={22} color={colors.ink} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.ochre }]}>
          <Text
            variant="caption"
            weight="700"
            style={{ color: colors.onInk, fontSize: 11 }}
            maxFontSizeMultiplier={1}
          >
            {badge}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs,
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  end: { justifyContent: 'flex-end' },
  center: { flex: 2.4, alignItems: 'center' },
  wordmark: { fontSize: 13, letterSpacing: 4 },
  wordmarkShadow: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8 },
  large: { paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.m },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MIN_TOUCH / 2,
  },
  onMedia: { width: 38, height: 38, margin: 3, overflow: 'hidden', borderRadius: 19 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: space.m,
    paddingHorizontal: space.gutter,
    overflow: 'hidden',
  },
});
