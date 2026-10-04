import { forwardRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { colors, radius, spacing } from '../tokens';
import { typography } from '../typography';
import { Icon } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, style, multiline, ...rest },
  ref,
) {
  return (
    <View style={styles.field}>
      <Text variant="captionStrong">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          error ? styles.inputError : null,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color={colors.textSecondary}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

export const SearchField = forwardRef<
  TextInput,
  TextInputProps & { onClear?: () => void; label?: string; tone?: 'surface' | 'onDark' }
>(function SearchField(
  { value, onClear, label = 'Search NMU ONE', tone = 'surface', style, onFocus, onBlur, ...rest },
  ref,
) {
  const onDark = tone === 'onDark';
  // The pill shows focus; the input's own square browser outline is removed.
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.search,
        onDark ? styles.searchDark : null,
        focused ? styles.searchFocused : null,
      ]}
    >
      <Icon
        name="search"
        size={20}
        color={onDark ? colors.textOnDarkMuted : colors.textSecondary}
      />
      <TextInput
        ref={ref}
        value={value}
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={onDark ? colors.textOnDarkMuted : colors.textSecondary}
        returnKeyType="search"
        autoCorrect={false}
        style={[
          styles.searchInput,
          NO_OUTLINE,
          { color: onDark ? colors.white : colors.navy },
          style,
        ]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {value && onClear ? (
        <Touchable onPress={onClear} accessibilityLabel="Clear search" style={styles.clear}>
          <Icon name="close-circle" size={20} color={colors.textSecondary} />
        </Touchable>
      ) : null}
    </View>
  );
});

export function Toggle({
  label,
  description,
  value,
  onChange,
  disabled,
  testID,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Touchable
      testID={testID}
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={styles.toggle}
      feedback="none"
    >
      <View style={styles.toggleText}>
        <Text variant="label">{label}</Text>
        {description ? (
          <Text variant="caption" color={colors.textSecondary}>
            {description}
          </Text>
        ) : null}
      </View>
      {/* Drawn rather than a platform Switch: the row is the one control,
          and a nested Switch would be a second, unlabelled one on the web. */}
      <View
        style={[styles.track, value ? styles.trackOn : null]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.thumb, value ? styles.thumbOn : null]} />
      </View>
    </Touchable>
  );
}

/** Two to four mutually exclusive options, e.g. Today / Week. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Touchable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            testID={`segment-${o.value}`}
            style={[styles.segment, selected ? styles.segmentOn : null]}
            minTarget={false}
          >
            <Text variant="captionStrong" color={selected ? colors.white : colors.navy}>
              {o.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

const NO_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    ...typography.body,
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.navy,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchDark: { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: colors.borderOnDark },
  searchFocused: { borderColor: colors.focus, borderWidth: 2 },
  searchInput: { ...typography.body, flex: 1, paddingVertical: spacing.md },
  clear: { alignItems: 'center', justifyContent: 'center' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleText: { flex: 1, gap: 2 },
  track: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 3,
    backgroundColor: colors.borderStrong,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.navy2 },
  thumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white },
  thumbOn: { alignSelf: 'flex-end' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  segmentOn: { backgroundColor: colors.navy },
});
