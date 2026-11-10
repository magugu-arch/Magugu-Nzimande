import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { color, radius, space, touchTarget } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Trailing glyph, e.g. the reference's "↓" or "→". */
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The editorial call to action from the design reference: a flat, nearly
 * square block of colour with a bold tracked label. Gold for the one primary
 * action on a screen; outline for everything else.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  trailingIcon,
  disabled,
  loading,
  compact,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const fg =
    variant === 'primary' ? color.onAccent : variant === 'danger' ? color.danger : color.text;
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      haptic={variant === 'primary'}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      pressedScale={compact ? 0.95 : 0.98}
      style={[styles.base, compact && styles.compact, styles[variant], style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text variant={compact ? 'labelSmall' : 'label'} style={{ color: fg }} numberOfLines={1}>
            {label}
          </Text>
          {trailingIcon ? <Ionicons name={trailingIcon} size={18} color={fg} /> : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    paddingHorizontal: space.xl,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: touchTarget - 8, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  primary: { backgroundColor: color.accent },
  secondary: { borderWidth: 1, borderColor: color.lineStrong, backgroundColor: 'transparent' },
  ghost: { backgroundColor: 'transparent', minHeight: touchTarget, paddingHorizontal: space.sm },
  danger: { borderWidth: 1, borderColor: color.danger, backgroundColor: 'transparent' },
});
