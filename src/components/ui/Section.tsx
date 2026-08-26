import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, headingGap, HIT_SLOP } from '@/theme';
import { Text } from './Text';

export interface SectionProps {
  title: string;
  subtitle?: string;
  overline?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  children: ReactNode;
  /** Horizontal padding is dropped so carousels can bleed to the screen edge. */
  bleed?: boolean;
  style?: StyleProp<ViewStyle>;
  onDark?: boolean;
}

/** Titled content block used on Home, Menu, Rewards and Orders. */
export const Section = memo(function Section({
  title,
  subtitle,
  overline,
  actionLabel,
  onActionPress,
  children,
  bleed = false,
  style,
  onDark = false,
}: SectionProps) {
  const titleColor = onDark ? colors.textOnDark : colors.textPrimary;
  const subtitleColor = onDark ? colors.textOnDarkMuted : colors.textSecondary;

  return (
    <View style={[styles.section, style]}>
      <View style={[styles.header, bleed ? styles.headerBleed : null]}>
        <View style={styles.headings}>
          {overline ? (
            <Text variant="overline" color={colors.primary}>
              {overline}
            </Text>
          ) : null}
          <Text variant="h2" color={titleColor}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color={subtitleColor}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {actionLabel && onActionPress ? (
          <Pressable
            onPress={onActionPress}
            hitSlop={HIT_SLOP}
            dataSet={{ slopX: HIT_SLOP.left, slopY: HIT_SLOP.top }}
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel}, ${title}`}
            style={styles.action}
          >
            <Text variant="captionMedium" color={colors.primary}>
              {actionLabel}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerBleed: { paddingHorizontal: spacing.gutter },
  // §14.3 puts 8–12px between a heading and the text supporting it. This
  // stack is eyebrow over title over subtitle, so it takes the lower bound.
  headings: { flex: 1, gap: headingGap.h4ToBody },
  /**
   * "See all" is a line of 13pt text, so its box was 19 tall — and `HIT_SLOP`,
   * which is 8 a side, only brought that to 35. Padding takes the box itself
   * to 45 and the negative margin gives the space straight back, so the header
   * is laid out exactly as it was and the target is real rather than declared.
   *
   * Real matters twice: `hitSlop` is a no-op in React Native Web, so on the web
   * build the 19pt box was the whole target, and a browser measuring this can
   * only ever see the box.
   */
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: 13,
    marginVertical: -13,
  },
});
