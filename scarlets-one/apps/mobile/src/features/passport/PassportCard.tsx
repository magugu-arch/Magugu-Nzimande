import type { Passport } from '@scarlets/domain';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { DemoChip } from '@/components/Chips';
import { Text } from '@/components/Text';
import { useL, useT } from '@/i18n';
import { clamp, springs, useReducedMotion } from '@/lib/motion';
import { mediaSource } from '@/media';
import { elevation, radius, space, useTheme } from '@/theme';

const TILT = 9;

/**
 * The supporter's card. Press and move a finger across it and it tilts
 * towards the touch like a card held in the hand, with a sheen that tracks
 * the same point. X and Y run on separate springs, so letting go mid-move
 * settles each axis from its own position and speed.
 *
 * It is purely an object to hold: there is no number on it, because the
 * rewards programme has not published any.
 */
export function PassportCard({ passport }: { passport: Passport }) {
  const theme = useTheme();
  const t = useT();
  const l = useL();
  const reduced = useReducedMotion();
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const width = useSharedValue(1);
  const height = useSharedValue(1);
  const linked = passport.membership.state === 'linked';

  const pan = Gesture.Pan()
    .enabled(!reduced)
    .minDistance(0)
    // Leave vertical scrolling to the page.
    .activeOffsetX([-12, 12])
    .onBegin((event) => {
      ry.set(withSpring(clamp((event.x / width.value - 0.5) * 2, -1, 1) * TILT, springs.press));
      rx.set(withSpring(clamp((0.5 - event.y / height.value) * 2, -1, 1) * TILT, springs.press));
    })
    .onUpdate((event) => {
      ry.set(clamp((event.x / width.value - 0.5) * 2, -1, 1) * TILT);
      rx.set(clamp((0.5 - event.y / height.value) * 2, -1, 1) * TILT);
    })
    .onFinalize(() => {
      rx.set(withSpring(0, springs.tilt));
      ry.set(withSpring(0, springs.tilt));
    });

  const card = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }],
  }));
  const sheen = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(rx.value) + Math.abs(ry.value), [0, TILT * 2], [0.06, 0.28]),
    transform: [{ translateX: (ry.value / TILT) * 70 }, { translateY: (-rx.value / TILT) * 40 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        testID="passport-card"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${t('passport.card.label')}. ${passport.displayName}. ${
          linked && passport.membership.type
            ? `${l(passport.membership.type)}, ${t('passport.card.season', { season: passport.membership.season ?? '' })}`
            : t('passport.card.supporter')
        }`}
        onLayout={(e) => {
          width.set(e.nativeEvent.layout.width);
          height.set(e.nativeEvent.layout.height);
        }}
        style={[
          {
            aspectRatio: 1.586,
            borderRadius: radius.xl,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: theme.inverse,
            ...elevation(theme, 3),
          },
          card,
        ]}
      >
        <LinearGradient
          colors={['#571A2A', '#3B101B', '#220910']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[StyleSheet.absoluteFill, sheen]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', left: -80, right: -80, top: -60, bottom: -60 }}
          />
        </Animated.View>
        <View style={{ flex: 1, padding: space.xl, justifyContent: 'space-between' }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <View style={{ gap: 2 }}>
              <Text variant="eyebrow" color="goldOnInverse">
                {t('passport.card.label')}
              </Text>
              <Text variant="footnote" color="onInverseMuted">
                {t('app.tagline')}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 4,
                borderRadius: radius.sm,
                backgroundColor: 'rgba(246,242,236,0.92)',
              }}
            >
              <Image
                source={mediaSource('crest')}
                style={{ width: 48, height: 24 }}
                contentFit="contain"
                accessible={false}
              />
            </View>
          </View>
          <View style={{ gap: space.xs }}>
            <Text variant="title1" color="onInverse" numberOfLines={1}>
              {passport.displayName}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                flexWrap: 'wrap',
              }}
            >
              <Text variant="callout" color="goldOnInverse" style={{ fontWeight: '600' }}>
                {linked && passport.membership.type
                  ? `${l(passport.membership.type)} · ${passport.membership.season ?? ''}`
                  : t('passport.card.supporter')}
              </Text>
              <DemoChip onDark />
            </View>
            {passport.membership.memberRefMasked ? (
              <Text variant="caption" color="onInverseMuted" numeric>
                {passport.membership.memberRefMasked}
              </Text>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
