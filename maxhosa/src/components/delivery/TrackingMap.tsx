import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { springConfig } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import type { CourierPresence } from '@/domain/types';
import { Tag } from '../Tag';

const FOLLOW = { damping: 1, response: 0.9 };

/**
 * A stylised neighbourhood with the courier's last reported position. Shown
 * only for a same-day courier that supplies positions; always labelled as a
 * demo location in this build. A new position glides in on two independent
 * springs (X and Y), so a diagonal move stays in sync; a stale one greys out
 * and says how old it is instead of pretending to be live.
 */
export function TrackingMap({
  courier,
  stale,
  updatedLabel,
}: {
  courier: CourierPresence;
  stale: boolean;
  updatedLabel: string;
}) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!size.w) return;
    const tx = courier.x * size.w;
    const ty = courier.y * size.h;
    // The first position is placed; later ones glide in from wherever the marker is.
    if (!placed.current) {
      x.set(tx);
      y.set(ty);
      placed.current = true;
    } else {
      x.set(withSpring(tx, springConfig(FOLLOW)));
      y.set(withSpring(ty, springConfig(FOLLOW)));
    }
  }, [courier.x, courier.y, size, x, y]);

  const marker = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - 18 }, { translateY: y.value - 18 }],
  }));

  return (
    <View
      style={[styles.map, { backgroundColor: colors.sunk }]}
      onLayout={(e: LayoutChangeEvent) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Simulated map. Courier approaching the delivery area. Demo location, not GPS. ${updatedLabel}.`}
    >
      <Svg width="100%" height="100%" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
        <G fill={colors.card} opacity={0.9}>
          <Rect x={14} y={14} width={70} height={48} rx={6} />
          <Rect x={100} y={12} width={90} height={40} rx={6} />
          <Rect x={206} y={14} width={96} height={52} rx={6} />
          <Rect x={16} y={120} width={60} height={64} rx={6} />
          <Rect x={94} y={140} width={84} height={46} rx={6} />
          <Rect x={196} y={122} width={54} height={62} rx={6} />
          <Rect x={262} y={96} width={44} height={88} rx={6} />
        </G>
        <G stroke={colors.hairlineStrong} strokeWidth={10} fill="none" strokeLinecap="round">
          <Path d="M0 92 H320" />
          <Path d="M90 0 V200" />
          <Path d="M190 0 V200" />
        </G>
        <Path
          d="M38 160 L70 132 L96 104 L134 100 L166 84 L198 72 L224 60"
          stroke={colors.ochre}
          strokeWidth={3}
          strokeDasharray="2 6"
          strokeLinecap="round"
          fill="none"
        />
        <G transform="translate(232 50)">
          <Circle r={14} fill={colors.ink} />
          <Path d="M-6 2 L0 -5 L6 2 V7 H-6 Z" fill={colors.paper} />
        </G>
      </Svg>
      <Animated.View
        style={[styles.courier, { backgroundColor: stale ? colors.ink3 : colors.ink }, marker]}
        pointerEvents="none"
      >
        <Ionicons name="bicycle" size={18} color={colors.onInk} />
      </Animated.View>
      <View style={styles.label}>
        <Tag label="Demo location — not GPS" tone="sample" />
      </View>
      <View style={styles.updated}>
        <Tag
          label={updatedLabel}
          tone={stale ? 'warn' : 'neutral'}
          icon={stale ? 'warning-outline' : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    marginHorizontal: space.gutter,
    marginTop: space.l,
    borderRadius: radius.m,
    overflow: 'hidden',
    aspectRatio: 16 / 10,
  },
  courier: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,252,247,0.85)',
  },
  label: { position: 'absolute', left: space.s, top: space.s },
  updated: { position: 'absolute', right: space.s, bottom: space.s },
});
