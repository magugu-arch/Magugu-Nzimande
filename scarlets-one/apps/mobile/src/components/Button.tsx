import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { hitTarget, radius, space, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Press } from './Press';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'onDark' | 'outlineOnDark';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: IconName;
  iconAfter?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fill?: boolean;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconAfter,
  loading,
  disabled,
  fill,
  accessibilityHint,
  accessibilityLabel,
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const look = {
    primary: { bg: theme.accent, fg: theme.onAccent, border: 'transparent' },
    secondary: { bg: theme.surfaceMuted, fg: theme.text, border: 'transparent' },
    ghost: { bg: 'transparent', fg: theme.accentText, border: 'transparent' },
    // On photography and the always-dark premium surface.
    onDark: { bg: theme.onInverse, fg: '#191619', border: 'transparent' },
    outlineOnDark: {
      bg: 'rgba(246,242,236,0.12)',
      fg: theme.onInverse,
      border: 'rgba(246,242,236,0.38)',
    },
  }[variant];
  const height = size === 'md' ? 50 : 38;

  return (
    <Press
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: Boolean(loading) }}
      // A small button keeps a full-size touch target.
      hitSlop={size === 'sm' ? (hitTarget - height) / 2 : undefined}
      style={[
        {
          minHeight: height,
          paddingHorizontal: size === 'md' ? space.xl : space.lg,
          borderRadius: radius.pill,
          backgroundColor: look.bg,
          borderWidth: variant === 'outlineOnDark' ? 1 : 0,
          borderColor: look.border,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: fill ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          opacity: loading ? 0 : 1,
        }}
      >
        {icon ? <Icon name={icon} size={size === 'md' ? 19 : 16} color={look.fg} /> : null}
        <Text
          variant={size === 'md' ? 'headline' : 'footnote'}
          style={{ color: look.fg, fontWeight: '600' }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {iconAfter ? (
          <Icon name={iconAfter} size={size === 'md' ? 18 : 15} color={look.fg} />
        ) : null}
      </View>
      {loading ? <ActivityIndicator color={look.fg} style={{ position: 'absolute' }} /> : null}
    </Press>
  );
}
