import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { color, radius, space, springConfig } from '@/theme';

const SPRING = springConfig('snappy');

/**
 * Tabs within a screen. The selection underline is a spring that re-targets
 * from wherever it is, so rapid taps never queue up or jump.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
}) {
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const active = layouts[value];

  const indicator = useAnimatedStyle(() => {
    if (!active) return { opacity: 0 };
    return {
      opacity: 1,
      width: withSpring(active.width, SPRING),
      transform: [{ translateX: withSpring(active.x, SPRING) }],
    };
  }, [active]);

  return (
    <View style={styles.wrap} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      <View style={styles.row}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <PressableScale
              key={o.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              pressedScale={0.96}
              onLayout={(e: LayoutChangeEvent) => {
                const { x, width } = e.nativeEvent.layout;
                setLayouts((prev) =>
                  prev[o.value]?.x === x && prev[o.value]?.width === width
                    ? prev
                    : { ...prev, [o.value]: { x, width } },
                );
              }}
              onPress={() => {
                if (!selected) {
                  void Haptics.selectionAsync().catch(() => {});
                  onChange(o.value);
                }
              }}
              style={styles.item}
            >
              <Text variant="labelSmall" color={selected ? 'accent' : 'textSecondary'}>
                {o.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <Animated.View style={[styles.indicator, indicator]} />
    </View>
  );
}

/** Small filter chips: ALL / HOME / AWAY. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
}) {
  return (
    <View
      style={styles.chips}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            pressedScale={0.94}
            onPress={() => onChange(o.value)}
            style={[styles.chip, selected && styles.chipOn]}
          >
            <Text
              variant="labelSmall"
              style={{ color: selected ? color.onAccent : color.textSecondary }}
            >
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  row: { flexDirection: 'row', gap: space.xl },
  item: { paddingVertical: space.md, minHeight: 44, justifyContent: 'center' },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: -1,
    height: 2,
    backgroundColor: color.accent,
  },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  chipOn: { backgroundColor: color.accent, borderColor: color.accent },
});
