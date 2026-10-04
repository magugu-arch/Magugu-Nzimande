import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type PillTone =
  'neutral' | 'navy' | 'yellow' | 'success' | 'warning' | 'danger' | 'info' | 'onDark';

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceSunken, fg: colors.textPrimary },
  navy: { bg: colors.navy, fg: colors.white },
  yellow: { bg: colors.yellow, fg: colors.navy },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  onDark: { bg: 'rgba(255,255,255,0.14)', fg: colors.white },
};

/** A status label. Never colour alone — the text always says it. */
export function Pill({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: PillTone;
  icon?: IconName;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {icon ? <Icon name={icon} size={13} color={t.fg} /> : null}
      <Text variant="captionStrong" color={t.fg}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radius.pill,
  },
});
