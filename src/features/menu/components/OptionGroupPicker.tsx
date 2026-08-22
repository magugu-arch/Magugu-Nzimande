import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { OptionGroup } from '@/types';
import { FoodImage } from '@/components/food/FoodImage';
import { Badge, Text } from '@/components/ui';
import { colors, radius, spacing, MIN_TOUCH_TARGET } from '@/theme';
import { formatPriceDelta } from '@/utils/money';

export interface OptionGroupPickerProps {
  group: OptionGroup;
  selectedIds: string[];
  onChange: (optionIds: string[]) => void;
  /** Highlights the group when its minimum has not been met. */
  showRequiredError?: boolean;
}

function requirementLabel(group: OptionGroup): string {
  if (group.minSelect > 0 && group.maxSelect === 1) return 'Required · pick 1';
  if (group.minSelect > 0) return `Required · pick ${group.minSelect}`;
  if (group.maxSelect === 1) return 'Optional · pick 1';
  return `Optional · up to ${group.maxSelect}`;
}

/**
 * One option group: radio behaviour when maxSelect is 1, checkbox otherwise.
 * Handles size, flavour/sauce, add-ons, sides and drinks from a single
 * component so the customiser stays data-driven.
 */
export const OptionGroupPicker = memo(function OptionGroupPicker({
  group,
  selectedIds,
  onChange,
  showRequiredError = false,
}: OptionGroupPickerProps) {
  const isSingle = group.maxSelect === 1;
  const unmet = showRequiredError && selectedIds.length < group.minSelect;

  const toggle = useCallback(
    (optionId: string) => {
      void Haptics.selectionAsync();

      if (isSingle) {
        onChange([optionId]);
        return;
      }

      if (selectedIds.includes(optionId)) {
        onChange(selectedIds.filter((id) => id !== optionId));
        return;
      }

      // At the cap, the newest choice replaces the oldest rather than silently
      // doing nothing — less confusing than an unresponsive tap.
      const next =
        selectedIds.length >= group.maxSelect
          ? [...selectedIds.slice(1), optionId]
          : [...selectedIds, optionId];
      onChange(next);
    },
    [isSingle, selectedIds, group.maxSelect, onChange],
  );

  return (
    <View style={styles.group}>
      <View style={styles.header}>
        <View style={styles.headings}>
          <Text variant="h3">{group.name}</Text>
          <Text variant="caption" color={unmet ? colors.status.error : colors.textMuted}>
            {requirementLabel(group)}
          </Text>
        </View>
        {group.minSelect > 0 ? (
          <Badge label="Required" tone={unmet ? 'warning' : 'neutral'} />
        ) : null}
      </View>

      <View style={[styles.options, unmet ? styles.optionsError : null]}>
        {group.options.map((option) => {
          const selected = selectedIds.includes(option.id);
          const disabled = !option.available;

          return (
            <Pressable
              key={option.id}
              onPress={() => !disabled && toggle(option.id)}
              disabled={disabled}
              accessibilityRole={isSingle ? 'radio' : 'checkbox'}
              accessibilityState={{ checked: selected, disabled }}
              accessibilityLabel={`${option.name}, ${formatPriceDelta(option.priceDelta)}`}
              testID={`option-${option.id}`}
              style={({ pressed }) => [
                styles.option,
                selected ? styles.optionSelected : null,
                pressed && !disabled ? styles.pressed : null,
              ]}
            >
              {option.assetKey ? (
                <FoodImage
                  assetKey={option.assetKey}
                  variant="thumb"
                  rounded="sm"
                  compactPlaceholder
                  style={styles.optionImage}
                />
              ) : null}

              <View style={styles.optionBody}>
                <Text
                  variant="bodyMedium"
                  color={disabled ? colors.textDisabled : colors.textPrimary}
                  numberOfLines={1}
                >
                  {option.name}
                </Text>
                {option.description ? (
                  <Text variant="caption" color={colors.textSecondary}>
                    {option.description}
                  </Text>
                ) : null}
                {disabled ? (
                  <Text variant="caption" color={colors.status.warning}>
                    Sold out
                  </Text>
                ) : null}
              </View>

              {option.priceDelta !== 0 ? (
                <Text variant="captionMedium" color={colors.textSecondary}>
                  {formatPriceDelta(option.priceDelta)}
                </Text>
              ) : null}

              <View
                style={[
                  isSingle ? styles.radio : styles.checkbox,
                  selected ? styles.indicatorSelected : null,
                ]}
              >
                {selected ? (
                  <Ionicons
                    name={isSingle ? 'ellipse' : 'checkmark'}
                    size={isSingle ? 10 : 13}
                    color={colors.onPrimary}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  group: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headings: { flex: 1, gap: spacing.xxs },
  options: { gap: spacing.sm },
  optionsError: {
    padding: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.status.errorSoft,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET + 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionImage: { width: 44, borderRadius: radius.sm },
  optionBody: { flex: 1, gap: spacing.xxs },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.85 },
});
