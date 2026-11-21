import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from '@/lib/haptics';
import { springs, useReducedMotion } from '@/lib/motion';
import { elevation, radius, useTheme } from '@/theme';
import { Press } from './Press';
import { Text } from './Text';

export interface SegmentedProps<T extends string> {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A segmented control whose thumb slides on a critically damped spring. If
 * another segment is chosen mid-slide the spring simply retargets from where
 * the thumb is, so rapid taps never queue up.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
  testID,
}: SegmentedProps<T>) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );
  const segment = width > 0 ? (width - 6) / options.length : 0;
  const x = useSharedValue(0);
  const target = index * segment;

  // Retarget whenever the selection or the measured width changes.
  useEffect(() => {
    if (segment > 0) x.set(reduced ? target : withSpring(target, springs.move));
  }, [reduced, segment, target, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flexDirection: 'row',
          padding: 3,
          borderRadius: radius.pill,
          backgroundColor: theme.surfaceMuted,
        },
        style,
      ]}
    >
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 3,
              bottom: 3,
              left: 3,
              width: segment,
              borderRadius: radius.pill,
              backgroundColor: theme.surface,
              ...elevation(theme, 1),
            },
            thumb,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Press
            key={option.id}
            testID={testID ? `${testID}-${option.id}` : undefined}
            onPress={() => {
              if (selected) return;
              haptic.selection();
              onChange(option.id);
            }}
            scaleTo={0.96}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={{
              flex: 1,
              minHeight: 38,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
            }}
          >
            <Text
              variant="footnote"
              color={selected ? 'text' : 'textSecondary'}
              style={{ fontWeight: selected ? '700' : '500' }}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Press>
        );
      })}
    </View>
  );
}
