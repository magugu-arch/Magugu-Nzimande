import { forwardRef, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, HIT_SLOP, MIN_TOUCH_TARGET } from '../tokens';

export interface TouchableProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Light haptic on press (native only). Off for routine list rows. */
  haptic?: boolean;
  /** Visual press feedback: dim, or a subtle scale for cards. */
  feedback?: 'dim' | 'scale' | 'none';
  /** Enforce the 48pt minimum (brief §20). On by default. */
  minTarget?: boolean;
}

/**
 * Every tappable thing in NMU ONE. Gives immediate press feedback (brief
 * §19), a 48pt target (§20), a visible focus ring for keyboards on web, and
 * defaults the accessibility role to button.
 */
export const Touchable = forwardRef<View, TouchableProps>(function Touchable(
  {
    children,
    style,
    haptic = false,
    feedback = 'dim',
    minTarget = true,
    onPress,
    accessibilityRole,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      hitSlop={HIT_SLOP}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={{ disabled: !!disabled, ...rest.accessibilityState }}
      disabled={disabled}
      onPress={(e) => {
        if (haptic && Platform.OS !== 'web') void Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={(state) => {
        const { pressed } = state;
        const focused = (state as { focused?: boolean }).focused;
        return [
          minTarget ? styles.min : null,
          style,
          pressed && feedback === 'dim' ? styles.dim : null,
          pressed && feedback === 'scale' ? styles.scale : null,
          disabled ? styles.disabled : null,
          focused && Platform.OS === 'web' ? styles.focus : null,
        ];
      }}
      {...rest}
    >
      {children}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  min: { minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET },
  dim: { opacity: 0.72 },
  scale: { transform: [{ scale: 0.985 }], opacity: 0.94 },
  disabled: { opacity: 0.45 },
  focus: {
    // RN-web maps these to CSS outline on the focused element.
    outlineColor: colors.focus,
    outlineStyle: 'solid',
    outlineWidth: 3,
    outlineOffset: 2,
  } as ViewStyle,
});
