import { memo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography, MIN_TOUCH_TARGET } from '@/theme';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  helperText?: string;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  /** Adds a show/hide toggle and starts obscured. */
  secure?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  required?: boolean;
}

export const TextField = memo(function TextField({
  label,
  error,
  helperText,
  iconLeft,
  secure = false,
  containerStyle,
  required = false,
  onFocus,
  onBlur,
  testID,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [obscured, setObscured] = useState(secure);

  const borderColor = error ? colors.status.error : focused ? colors.primary : colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text variant="captionMedium" color={colors.textSecondary}>
        {label}
        {required ? (
          <Text variant="captionMedium" color={colors.primary}>
            {' *'}
          </Text>
        ) : null}
      </Text>

      <View style={[styles.inputRow, { borderColor }]}>
        {iconLeft ? (
          <Ionicons name={iconLeft} size={18} color={focused ? colors.primary : colors.textMuted} />
        ) : null}

        <TextInput
          {...inputProps}
          testID={testID}
          style={styles.input}
          secureTextEntry={obscured}
          placeholderTextColor={colors.textDisabled}
          accessibilityLabel={label}
          accessibilityHint={error ?? helperText}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />

        {secure ? (
          <Pressable
            onPress={() => setObscured((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={obscured ? 'Show password' : 'Hide password'}
            // 13, not 12: the icon is 19 across, and 19 + 24 came to 43 — one
            // point under §22.9, which is the sort of miss that only a
            // measurement finds.
            hitSlop={13}
            dataSet={{ slopX: 13, slopY: 13 }}
          >
            <Ionicons
              name={obscured ? 'eye-outline' : 'eye-off-outline'}
              size={19}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={styles.messageRow}>
          <Ionicons name="alert-circle" size={13} color={colors.status.error} />
          <Text variant="caption" color={colors.status.error} style={styles.message}>
            {error}
          </Text>
        </View>
      ) : helperText ? (
        <Text variant="caption" color={colors.textMuted}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.xs + 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    minHeight: MIN_TOUCH_TARGET + 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  message: { flex: 1 },
});
