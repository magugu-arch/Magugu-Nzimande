import type { VenuePoint, VenuePointKind } from '@scarlets/domain';
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
} from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/Icon';
import { Press } from '@/components/Press';
import { Text } from '@/components/Text';
import { useL, useT } from '@/i18n';
import { clamp, rubberband, springs, useReducedMotion } from '@/lib/motion';
import { hitTarget, radius, space, useTheme } from '@/theme';

export const KIND_ICON: Record<VenuePointKind, IconName> = {
  entrance: 'enter-outline',
  step_free: 'trending-up',
  toilet: 'water-outline',
  accessible_toilet: 'accessibility',
  food: 'fast-food',
  shop: 'bag-handle',
  support: 'help-buoy',
  hospitality: 'wine',
  meeting: 'people',
};

const MAX_SCALE = 2.6;

/**
 * An illustrative venue schematic you can move with your hands.
 *
 * Pinch zooms about the fingers; a drag pans 1:1 and resists softly at the
 * edges instead of stopping dead; letting go carries the pan on with its own
 * momentum and springs back inside the bounds. Gestures are an extra, never
 * the only way: the zoom buttons do the same job, and every point is listed
 * underneath the map.
 *
 * The layout is a placeholder. The venue's approved map replaces it.
 */
export function VenueMap({
  points,
  selected,
  onSelect,
}: {
  points: VenuePoint[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const theme = useTheme();
  const t = useT();
  const l = useL();
  const reduced = useReducedMotion();
  const [size, setSize] = useState(0);

  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const box = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.set(scale.value);
    })
    .onUpdate((event) => {
      const raw = startScale.value * event.scale;
      // Past either limit the map still answers the fingers, just less and less.
      scale.set(
        raw < 1
          ? 1 - rubberband(1 - raw, 1) * 0.5
          : raw > MAX_SCALE
            ? MAX_SCALE + rubberband(raw - MAX_SCALE, MAX_SCALE) * 0.5
            : raw,
      );
    })
    .onEnd(() => {
      const target = clamp(scale.value, 1, MAX_SCALE);
      scale.set(withSpring(target, springs.settle));
      const limit = (box.value * (target - 1)) / 2;
      x.set(withSpring(clamp(x.value, -limit, limit), springs.settle));
      y.set(withSpring(clamp(y.value, -limit, limit), springs.settle));
    });

  const pan = Gesture.Pan()
    .minDistance(8)
    .onBegin(() => {
      // Catch a map that is still coasting and carry on from where it is.
      cancelAnimation(x);
      cancelAnimation(y);
      startX.set(x.value);
      startY.set(y.value);
    })
    .onUpdate((event) => {
      const limit = (box.value * (scale.value - 1)) / 2;
      const follow = (raw: number) => {
        'worklet';
        if (raw > limit) return limit + rubberband(raw - limit, box.value);
        if (raw < -limit) return -limit + rubberband(raw + limit, box.value);
        return raw;
      };
      x.set(follow(startX.value + event.translationX));
      y.set(follow(startY.value + event.translationY));
    })
    .onEnd((event) => {
      const limit = (box.value * (scale.value - 1)) / 2;
      const release = (value: number, velocity: number) => {
        'worklet';
        // Outside the bounds: spring home. Inside: coast, and bounce softly if it reaches an edge.
        if (value > limit || value < -limit) {
          return withSpring(clamp(value, -limit, limit), { ...springs.settle, velocity });
        }
        return withDecay({
          velocity,
          clamp: [-limit, limit],
          rubberBandEffect: true,
          rubberBandFactor: 0.7,
        });
      };
      x.set(release(x.value, event.velocityX));
      y.set(release(y.value, event.velocityY));
    });

  const gesture = Gesture.Simultaneous(pinch, pan);
  const canvas = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  const zoomBy = (factor: number) => {
    const target = clamp(scale.value * factor, 1, MAX_SCALE);
    const limit = (size * (target - 1)) / 2;
    const settle = (value: number) => (reduced ? value : withSpring(value, springs.settle));
    scale.set(settle(target));
    x.set(settle(clamp(x.value, -limit, limit)));
    y.set(settle(clamp(y.value, -limit, limit)));
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setSize(width);
    box.set(width);
  };

  return (
    <View
      onLayout={onLayout}
      testID="venue-map"
      style={{
        aspectRatio: 1,
        borderRadius: radius.xl,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: theme.surfaceMuted,
      }}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ width: '100%', height: '100%' }, canvas]}>
          {/* Stand ring */}
          <View
            style={{
              position: 'absolute',
              left: '11%',
              top: '11%',
              right: '11%',
              bottom: '11%',
              borderRadius: 44,
              borderCurve: 'continuous',
              backgroundColor: theme.surface,
              borderWidth: 2,
              borderColor: theme.hairline,
            }}
          />
          {/* Pitch */}
          <View
            accessible
            accessibilityLabel={t('matchday.map.pitch')}
            style={{
              position: 'absolute',
              left: '27%',
              top: '25%',
              right: '27%',
              bottom: '25%',
              borderRadius: 8,
              backgroundColor: '#2F6B3A',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '50%',
                height: 1.5,
                backgroundColor: 'rgba(255,255,255,0.7)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '22%',
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.45)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: '22%',
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.45)',
              }}
            />
            <Text
              variant="eyebrow"
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 9,
                position: 'absolute',
                top: '33%',
              }}
            >
              {t('matchday.map.pitch')}
            </Text>
          </View>
          {size > 0
            ? points.map((point) => {
                const active = point.id === selected;
                return (
                  <Press
                    key={point.id}
                    testID={`pin-${point.id}`}
                    onPress={() => onSelect(active ? null : point.id)}
                    accessibilityLabel={l(point.label)}
                    accessibilityState={{ selected: active }}
                    // A small pin with a full-size touch target around it.
                    hitSlop={(hitTarget - 28) / 2}
                    style={{
                      position: 'absolute',
                      left: point.x * size - 14,
                      top: point.y * size - 14,
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: active ? theme.accent : theme.text,
                      borderWidth: 2,
                      borderColor: theme.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: active ? 2 : 1,
                    }}
                  >
                    <Icon
                      name={KIND_ICON[point.kind]}
                      size={14}
                      color={active ? theme.onAccent : theme.bg}
                    />
                  </Press>
                );
              })
            : null}
        </Animated.View>
      </GestureDetector>
      <View style={{ position: 'absolute', right: space.sm, bottom: space.sm, gap: space.xs }}>
        {(
          [
            ['add', 1.5, 'matchday.map.zoomIn'],
            ['remove', 1 / 1.5, 'matchday.map.zoomOut'],
          ] as const
        ).map(([icon, factor, label]) => (
          <Press
            key={icon}
            testID={`map-${icon}`}
            onPress={() => zoomBy(factor)}
            accessibilityLabel={t(label)}
            style={{
              width: hitTarget,
              height: hitTarget,
              borderRadius: hitTarget / 2,
              backgroundColor: theme.surface,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0px 2px 8px rgba(25,22,25,0.18)',
            }}
          >
            <Icon name={icon} size={22} color={theme.text} />
          </Press>
        ))}
      </View>
    </View>
  );
}
