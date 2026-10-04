import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

/** A section eyebrow with an optional "See all"-style link. */
export function SectionHeader({
  title,
  action,
  onAction,
  tone = 'default',
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  tone?: 'default' | 'onDark';
}) {
  return (
    <View style={styles.section}>
      <Text
        variant="overline"
        color={tone === 'onDark' ? colors.textOnDarkMuted : colors.textSecondary}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {action && onAction ? (
        <Touchable onPress={onAction} accessibilityRole="link" accessibilityLabel={`${action}: ${title}`} style={styles.link} minTarget={false}>
          <Text variant="captionStrong" color={tone === 'onDark' ? colors.yellow : colors.navy2}>
            {action}
          </Text>
        </Touchable>
      ) : null}
    </View>
  );
}

export function Divider({ inset = 0, tone = 'default' }: { inset?: number; tone?: 'default' | 'onDark' }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        marginLeft: inset,
        backgroundColor: tone === 'onDark' ? colors.borderOnDark : colors.border,
      }}
    />
  );
}

export function Stack({
  children,
  gap = spacing.md,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Row({
  children,
  gap = spacing.sm,
  align = 'center',
  justify = 'flex-start',
  wrap = false,
  style,
}: {
  children: ReactNode;
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: align, justifyContent: justify, gap, flexWrap: wrap ? 'wrap' : 'nowrap' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type NoticeTone = 'info' | 'warning' | 'danger' | 'success' | 'neutral';

const NOTICE: Record<NoticeTone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: colors.infoSoft, fg: colors.info, icon: 'information-circle' },
  warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'alert-circle' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, icon: 'warning' },
  success: { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle' },
  neutral: { bg: colors.surfaceSunken, fg: colors.textPrimary, icon: 'information-circle-outline' },
};

/** An inline message inside a screen: stale data, a delay, a confirmation. */
export function Notice({
  tone = 'info',
  title,
  body,
  action,
  onAction,
  icon,
  testID,
}: {
  tone?: NoticeTone;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  icon?: IconName;
  testID?: string;
}) {
  const t = NOTICE[tone];
  return (
    <View testID={testID} style={[styles.notice, { backgroundColor: t.bg }]} accessibilityRole="summary">
      <Icon name={icon ?? t.icon} size={20} color={t.fg} />
      <View style={styles.noticeBody}>
        <Text variant="bodyStrong" color={t.fg}>
          {title}
        </Text>
        {body ? <Text variant="caption">{body}</Text> : null}
        {action && onAction ? (
          <Touchable onPress={onAction} accessibilityRole="link" minTarget={false} style={styles.noticeAction}>
            <Text variant="captionStrong" color={colors.navy2} style={styles.underline}>
              {action}
            </Text>
          </Touchable>
        ) : null}
      </View>
    </View>
  );
}

export function ProgressBar({
  value,
  tone = 'navy',
  label,
}: {
  value: number;
  tone?: 'navy' | 'yellow' | 'success';
  label: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  const fill = tone === 'yellow' ? colors.yellow : tone === 'success' ? colors.success : colors.navy;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: fill }]} />
    </View>
  );
}

export function Avatar({ initials, size = 44, tone = 'yellow' }: { initials: string; size?: number; tone?: 'yellow' | 'navy' }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone === 'yellow' ? colors.yellow : colors.navy2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text variant={size > 50 ? 'title3' : 'captionStrong'} color={tone === 'yellow' ? colors.navy : colors.white}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    minHeight: 24,
  },
  link: { paddingVertical: spacing.xs, paddingLeft: spacing.md, minHeight: 32, justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.md },
  noticeBody: { flex: 1, gap: spacing.xxs },
  noticeAction: { paddingTop: spacing.xs, minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  underline: { textDecorationLine: 'underline' },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
});
