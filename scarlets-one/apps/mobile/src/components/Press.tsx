import { useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type AccessibilityRole,
  type AccessibilityState,
  type Insets,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { springs, useReducedMotion } from '@/lib/motion';
import { useTheme } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Whether the last input was the keyboard. A focus ring is for people moving
 * by keyboard; a tap or click that happens to focus a control should not
 * leave an outline behind.
 */
let keyboardNavigation = false;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Tab' || event.key.startsWith('Arrow')) keyboardNavigation = true;
    },
    true,
  );
  window.addEventListener(
    'pointerdown',
    () => {
      keyboardNavigation = false;
    },
    true,
  );
}

export interface PressProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far the control gives under the finger. Larger surfaces move less. */
  scaleTo?: number;
  disabled?: boolean;
  /** Dim the control while disabled. Off for a control that is locked but still needs reading. */
  dimWhenDisabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  hitSlop?: Insets | number;
  testID?: string;
}

/**
 * The one pressable in the app.
 *
 * Feedback starts on touch-DOWN, inside the touch, on a critically damped
 * spring. Releasing springs back from wherever the scale is at that instant,
 * so a quick tap and a long press both look right and neither waits for the
 * other to finish. With reduced motion the control dims instead of moving.
 */
export function Press({
  onPress,
  children,
  style,
  scaleTo = 0.97,
  disabled,
  dimWhenDisabled = true,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop,
  testID,
}: PressProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const [focused, setFocused] = useState(false);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 - (1 - scaleTo) * pressed.value }],
    opacity: reduced ? 1 - 0.3 * pressed.value : 1,
  }));

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        pressed.set(reduced ? withTiming(1, { duration: 60 }) : withSpring(1, springs.press));
      }}
      onPressOut={() => {
        pressed.set(reduced ? withTiming(0, { duration: 120 }) : withSpring(0, springs.press));
      }}
      onFocus={() => setFocused(keyboardNavigation)}
      onBlur={() => setFocused(false)}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled), ...accessibilityState }}
      // The same state as aria-* attributes: the web build reads these, so a
      // screen reader there hears "selected", "checked" and "expanded" too.
      aria-disabled={disabled ? true : undefined}
      aria-selected={accessibilityState?.selected}
      aria-checked={accessibilityState?.checked}
      aria-expanded={accessibilityState?.expanded}
      aria-busy={accessibilityState?.busy}
      style={[
        style,
        animated,
        disabled && dimWhenDisabled ? { opacity: 0.45 } : null,
        Platform.OS === 'web' ? ({ cursor: disabled ? 'default' : 'pointer' } as ViewStyle) : null,
        // A keyboard focus ring. Pointer presses do not trigger it.
        focused && Platform.OS === 'web'
          ? {
              outlineWidth: 3,
              outlineStyle: 'solid',
              outlineColor: theme.accentText,
              outlineOffset: 2,
            }
          : null,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
