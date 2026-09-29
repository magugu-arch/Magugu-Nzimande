import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, fontFamily, MIN_TOUCH_TARGET, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';
import { Text } from './Text';

export function TextField({
  label,
  error,
  hint,
  style,
  ...rest
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text variant="eyebrow" color="textMuted">
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.accent}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        {...rest}
        style={[
          styles.input,
          rest.multiline && styles.multiline,
          error ? styles.inputError : null,
          style,
        ]}
      />
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textSubtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
}) {
  return (
    <Pressable
      onPress={
        disabled || !onPress
          ? undefined
          : () => {
              haptic.select();
              onPress();
            }
      }
      accessibilityRole={onPress ? 'button' : 'text'}
      // A chip that filters is a toggle button: pressed or not. "Selected"
      // belongs to a tab or an option in a list, and reads wrongly here.
      {...(onPress ? { 'aria-pressed': !!selected } : {})}
      aria-disabled={!!disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        // A chip that is on and fixed ("In app" for booking messages) keeps its
        // brass, so its label keeps the contrast brass gives it.
        disabled && !selected && styles.chipDisabled,
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <Feather name={icon} size={13} color={selected ? colors.textOnAccent : colors.textMuted} />
      ) : null}
      <Text
        variant="bodySmall"
        style={{
          color: selected ? colors.textOnAccent : disabled ? colors.textSubtle : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text variant="title">{label}</Text>
        {description ? (
          <Text variant="bodySmall" color="textMuted">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: colors.borderStrong, true: colors.accent }}
        thumbColor={colors.text}
        ios_backgroundColor={colors.borderStrong}
      />
    </View>
  );
}

export function ListRow({
  icon,
  label,
  value,
  onPress,
  right,
  destructive,
}: {
  icon?: ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <Text variant="body" color={destructive ? 'danger' : 'text'} style={{ flex: 1 }}>
        {label}
      </Text>
      {value ? (
        <Text variant="bodySmall" color="textMuted" numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      {right ??
        (onPress ? <Feather name="chevron-right" size={18} color={colors.textSubtle} /> : null)}
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              haptic.select();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            aria-selected={active}
            accessibilityLabel={o.label}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text
              variant="eyebrow"
              style={{ color: active ? colors.textOnAccent : colors.textMuted }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** §25 PartySizeStepper. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  format = (v: number) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const step = (d: number) => {
    const next = Math.min(max, Math.max(min, value + d));
    if (next !== value) {
      haptic.select();
      onChange(next);
    }
  };
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: format(value) }}
      // React Native for Web gives this the slider role but not the values a
      // slider must publish, so they are set here as well.
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      <Text variant="title" style={{ flex: 1 }}>
        {label}
      </Text>
      <Pressable
        onPress={() => step(-1)}
        disabled={value <= min}
        accessibilityLabel={`Fewer, ${label}`}
        style={[styles.stepButton, value <= min && styles.chipDisabled]}
      >
        <Feather name="minus" size={18} color={colors.text} />
      </Pressable>
      <Text variant="h3" style={styles.stepValue}>
        {format(value)}
      </Text>
      <Pressable
        onPress={() => step(1)}
        disabled={value >= max}
        accessibilityLabel={`More, ${label}`}
        style={[styles.stepButton, value >= max && styles.chipDisabled]}
      >
        <Feather name="plus" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs, marginBottom: spacing.lg },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: fontFamily.body,
    fontSize: 16,
  },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  // Dimming the whole chip took its label under 2:1. A chip that cannot be
  // changed is shown by a quieter surface instead, and stays readable.
  chipDisabled: { borderColor: colors.border, backgroundColor: colors.surface },
  pressed: { opacity: 0.7 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: { width: 28, alignItems: 'center' },
  rowValue: { maxWidth: '45%' },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.accent },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { minWidth: 36, textAlign: 'center' },
});
