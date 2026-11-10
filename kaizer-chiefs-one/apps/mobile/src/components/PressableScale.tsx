import { forwardRef, type ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { springConfig, state } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SNAPPY = springConfig('snappy');

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Scale on press. Large surfaces should move less than small chips. */
  pressedScale?: number;
  /** Fire a light haptic on commit. Reserve for meaningful actions. */
  haptic?: boolean;
}

/**
 * Feedback lands on press-in, not release, and is a spring from the current
 * value, so a press can be released or re-pressed mid-animation without a jump.
 * With Reduce Motion on, the scale becomes a gentle opacity change.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  {
    style,
    children,
    pressedScale = state.pressedScale,
    haptic,
    onPressIn,
    onPressOut,
    onPress,
    disabled,
    ...rest
  },
  ref,
) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 1 - pressed.value * (1 - state.pressedOpacity) };
    return { transform: [{ scale: 1 - pressed.value * (1 - pressedScale) }] };
  });

  return (
    <AnimatedPressable
      ref={ref}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={8}
      {...rest}
      onPressIn={(e) => {
        pressed.value = withSpring(1, SNAPPY);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, SNAPPY);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
      style={[style, animated, disabled ? { opacity: state.disabledOpacity } : null]}
    >
      {children}
    </AnimatedPressable>
  );
});
