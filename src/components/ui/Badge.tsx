import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

export type BadgeTone = 'primary' | 'dark' | 'success' | 'warning' | 'neutral' | 'onImage';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

function toneStyles(tone: BadgeTone) {
  switch (tone) {
    case 'primary':
      return { background: colors.primary, text: colors.onPrimary };
    case 'dark':
      return { background: colors.brand.black, text: colors.textOnDark };
    case 'success':
      return { background: colors.status.successSoft, text: colors.status.success };
    case 'warning':
      return { background: colors.status.warningSoft, text: colors.status.warning };
    case 'neutral':
      return { background: colors.surfaceAlt, text: colors.textSecondary };
    case 'onImage':
      return { background: 'rgba(34,30,30,0.72)', text: colors.textOnDark };
  }
}

export const Badge = memo(function Badge({ label, tone = 'primary', icon, style }: BadgeProps) {
  const palette = toneStyles(tone);
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }, style]}>
      {icon ? <Ionicons name={icon} size={11} color={palette.text} /> : null}
      <Text variant="micro" color={palette.text}>
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
});
