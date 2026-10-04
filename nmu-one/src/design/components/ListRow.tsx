import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: IconName;
  iconTone?: 'navy' | 'yellow' | 'sunken' | 'danger' | 'success';
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  testID?: string;
}

const ICON_TONES = {
  navy: { bg: colors.navy, fg: colors.white },
  yellow: { bg: colors.yellow, fg: colors.navy },
  sunken: { bg: colors.surfaceSunken, fg: colors.navy },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  success: { bg: colors.successSoft, fg: colors.success },
} as const;

/** A row in a list. With `onPress` it is a single, labelled control. */
export function ListRow({
  title,
  subtitle,
  meta,
  icon,
  iconTone = 'sunken',
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  testID,
}: ListRowProps) {
  const tone = ICON_TONES[iconTone];
  const content = (
    <>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: tone.bg }]}>
          <Icon name={icon} size={20} color={tone.fg} />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text variant="label">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textSecondary}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="captionStrong" color={colors.navy2}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? <Icon name="chevron-forward" size={18} color={colors.textSecondary} /> : null)}
    </>
  );
  if (!onPress) {
    return (
      <View testID={testID} style={styles.row} accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      style={styles.row}
    >
      {content}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 1 },
});
