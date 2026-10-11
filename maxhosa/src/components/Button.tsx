import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/design/theme';
import { MIN_TOUCH, radius, space } from '@/design/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'light' | 'glass';
  icon?: keyof typeof Ionicons.glyphMap;
  busy?: boolean;
  /** Visibly disabled, still focusable, and says why through `accessibilityHint`. */
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  busy,
  disabled,
  accessibilityHint,
  style,
  testID,
}: Props) {
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.ink, fg: colors.onInk, border: 'transparent' },
    secondary: { bg: 'transparent', fg: colors.ink, border: colors.hairlineStrong },
    light: { bg: '#FFFCF7', fg: '#16130F', border: 'transparent' },
    glass: { bg: 'rgba(255,252,247,0.22)', fg: '#FFFCF7', border: 'rgba(255,252,247,0.5)' },
  }[variant];
  return (
    <PressableScale
      testID={testID}
      onPress={busy || disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={[
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      <View style={styles.row}>
        {busy ? (
          <ActivityIndicator color={palette.fg} />
        ) : icon ? (
          <Ionicons name={icon} size={18} color={palette.fg} />
        ) : null}
        <Text
          variant="headline"
          style={{ color: palette.fg, fontSize: 15 }}
          maxFontSizeMultiplier={1.4}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    minWidth: MIN_TOUCH,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s },
});
