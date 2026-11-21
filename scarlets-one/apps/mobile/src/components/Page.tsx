import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useT } from '@/i18n';
import { useReducedMotion } from '@/lib/motion';
import { MAX_CONTENT_WIDTH, TAB_BAR_HEIGHT, hitTarget, radius, space, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Material } from './Material';
import { Photo } from './Photo';
import { Press } from './Press';
import { Text } from './Text';

const BAR_HEIGHT = 48;

/** A round control that floats over photography or page alike. */
export function BarButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Press
      testID={testID}
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        width: hitTarget,
        height: hitTarget,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Material
        intensity={40}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={20} color={theme.text} />
      </Material>
    </Press>
  );
}

export interface PageProps {
  title: string;
  /** Full-bleed photography behind the top of the page, with content laid over it. */
  hero?: { mediaId: string; height: number; content?: ReactNode };
  /** Shown above the large title on pages without a hero. */
  eyebrow?: string;
  back?: boolean;
  leading?: ReactNode;
  actions?: ReactNode;
  /** Leave room for the tab bar. */
  inTabs?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
  testID?: string;
}

/**
 * The page scaffold: content scrolls beneath a floating, translucent bar.
 *
 * The bar is clear at the top of the page and only takes on its material
 * once content is actually passing under it, with a soft fade where they
 * meet in place of a hard divider. A hero photograph moves at a third of the
 * scroll speed and stretches when the page is pulled down, both tied
 * directly to the scroll position so they can never lag the finger.
 */
export function Page({
  title,
  hero,
  eyebrow,
  back,
  leading,
  actions,
  inTabs,
  onRefresh,
  refreshing,
  children,
  testID,
}: PageProps) {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduced = useReducedMotion();
  const scrollY = useSharedValue(0);
  const [overPhoto, setOverPhoto] = useState(Boolean(hero));

  const barTotal = insets.top + BAR_HEIGHT;
  const threshold = hero ? Math.max(40, hero.height - barTotal - 36) : 34;

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  // The status bar flips from light (over the photo) to the theme's own once
  // the bar's material is in place. One state change at the crossing, not per frame.
  useAnimatedReaction(
    () => scrollY.value < threshold,
    (over, previous) => {
      if (hero && over !== previous) scheduleOnRN(setOverPhoto, over);
    },
    [threshold, hero],
  );

  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [threshold, threshold + 28], [0, 1], 'clamp'),
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [threshold + 8, threshold + 36], [0, 1], 'clamp'),
    transform: [
      {
        translateY: reduced
          ? 0
          : interpolate(scrollY.value, [threshold + 8, threshold + 36], [6, 0], 'clamp'),
      },
    ],
  }));
  const heroImageStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    if (!hero) return {};
    if (y < 0) {
      // Pulled down: grow from the top so the photo fills the gap.
      const scale = 1 + -y / hero.height;
      return { transform: [{ translateY: y / 2 }, { scale }] };
    }
    return { transform: [{ translateY: reduced ? 0 : y * 0.33 }, { scale: 1 }] };
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }} testID={testID}>
      <StatusBar style={overPhoto ? 'light' : theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={hero ? '#F6F2EC' : theme.textSecondary}
              progressViewOffset={barTotal}
            />
          ) : undefined
        }
        contentContainerStyle={{
          paddingBottom: (inTabs ? TAB_BAR_HEIGHT : 0) + insets.bottom + space.xxxl,
        }}
      >
        {hero ? (
          <View style={{ height: hero.height, overflow: 'hidden', backgroundColor: '#191619' }}>
            <Animated.View style={[StyleSheet.absoluteFill, heroImageStyle]}>
              <Photo id={hero.mediaId} style={StyleSheet.absoluteFill} priority />
            </Animated.View>
            {/* Top: keeps the status bar and controls readable. Bottom: the text ground. */}
            <LinearGradient
              colors={['rgba(25,22,25,0.55)', 'rgba(25,22,25,0)']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: barTotal + 40 }}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(25,22,25,0)', 'rgba(25,22,25,0.62)', 'rgba(25,22,25,0.94)']}
              locations={[0, 0.5, 1]}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: hero.height * 0.72,
              }}
              pointerEvents="none"
            />
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                paddingBottom: space.xxl + radius.xl,
              }}
            >
              <View
                style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, paddingHorizontal: space.xl }}
              >
                {hero.content}
              </View>
            </View>
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingTop: barTotal + space.sm }}>
            <View
              style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, paddingHorizontal: space.xl }}
            >
              {eyebrow ? (
                <Text variant="eyebrow" color="accentText" style={{ marginBottom: space.xs }}>
                  {eyebrow}
                </Text>
              ) : null}
              <Text variant="display" accessibilityRole="header">
                {title}
              </Text>
            </View>
          </View>
        )}
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.bg,
            // The page rises over the foot of the photograph.
            marginTop: hero ? -radius.xl : 0,
            borderTopLeftRadius: hero ? radius.xl : 0,
            borderTopRightRadius: hero ? radius.xl : 0,
            borderCurve: 'continuous',
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: MAX_CONTENT_WIDTH,
              paddingHorizontal: space.xl,
              paddingTop: hero ? space.xxl : space.lg,
            }}
          >
            {children}
          </View>
        </View>
      </Animated.ScrollView>

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, barStyle]} pointerEvents="none">
          <Material intensity={70} style={{ height: barTotal }} />
          <LinearGradient
            colors={[
              theme.material,
              theme.scheme === 'dark' ? 'rgba(20,17,20,0)' : 'rgba(246,242,236,0)',
            ]}
            style={{ height: 14 }}
          />
        </Animated.View>
        <View
          pointerEvents="box-none"
          style={{
            height: barTotal,
            paddingTop: insets.top,
            paddingHorizontal: space.sm,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View
            style={{ minWidth: hitTarget, flexDirection: 'row', alignItems: 'center' }}
            pointerEvents="box-none"
          >
            {back ? (
              <BarButton
                testID="nav-back"
                icon="chevron-back"
                label={t('common.back')}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              />
            ) : null}
            {leading}
          </View>
          <Animated.View
            style={[{ flex: 1, alignItems: 'center', paddingHorizontal: space.sm }, titleStyle]}
            pointerEvents="none"
          >
            <Text variant="headline" numberOfLines={1}>
              {title}
            </Text>
          </Animated.View>
          <View
            style={{
              minWidth: hitTarget,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
            pointerEvents="box-none"
          >
            {actions}
          </View>
        </View>
      </View>
    </View>
  );
}
