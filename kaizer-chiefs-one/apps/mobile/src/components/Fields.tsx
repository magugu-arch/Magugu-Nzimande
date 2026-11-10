import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { color, radius, space, type } from '@/theme';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  secure?: boolean;
}

/** Labelled input. Errors are announced and shown inline, not on submit only. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, secure, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="labelSmall" color="textSecondary">
        {label}
      </Text>
      <View style={[styles.box, focused && styles.focused, !!error && styles.errored]}>
        <TextInput
          {...rest}
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={color.textTertiary}
          selectionColor={color.accent}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {secure ? (
          <PressableScale
            onPress={() => setHidden((h) => !h)}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={styles.eye}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={color.textSecondary}
            />
          </PressableScale>
        ) : null}
      </View>
      {error ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="footnote" color="textTertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

/** Checkbox row for consents. The whole row is the target. */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  error,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  error?: string;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        accessibilityHint={description}
        pressedScale={0.99}
        onPress={() => onChange(!checked)}
        style={styles.checkRow}
      >
        <View style={[styles.box2, checked && styles.box2On, !!error && styles.errored]}>
          {checked ? <Ionicons name="checkmark" size={16} color={color.onAccent} /> : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="callout">{label}</Text>
          {description ? (
            <Text variant="footnote" color="textSecondary">
              {description}
            </Text>
          ) : null}
        </View>
      </PressableScale>
      {error ? (
        <Text variant="footnote" color="danger" style={{ marginLeft: 36 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.lineStrong,
    backgroundColor: color.bgRaised,
  },
  focused: { borderColor: color.accent },
  errored: { borderColor: color.danger },
  input: {
    ...type.body,
    flex: 1,
    color: color.text,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  eye: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  checkRow: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    paddingVertical: space.xs,
  },
  box2: {
    width: 24,
    height: 24,
    marginTop: 1,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: color.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box2On: { backgroundColor: color.accent, borderColor: color.accent },
});
