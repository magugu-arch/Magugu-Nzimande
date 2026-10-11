import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SPRING, springConfig } from '@/design/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far it sinks on press. Large surfaces sink less. */
  pressedScale?: number;
};

/**
 * Feedback on the press, not the release: the element sinks the instant a
 * finger lands and springs back from wherever it is when it lifts — a quick
 * tap-and-release mid-animation never jumps.
 */
export function PressableScale({
  children,
  style,
  pressedScale = 0.97,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (!reduced) scale.set(withSpring(pressedScale, springConfig(SPRING.press)));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, springConfig(SPRING.snappy)));
        onPressOut?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
