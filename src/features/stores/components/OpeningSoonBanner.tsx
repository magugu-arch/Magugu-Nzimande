import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { formatShortDate } from '@/utils/datetime';

export interface OpeningSoonBannerProps {
  /** ISO date of the first branch to open. */
  opensOn: string;
}

/**
 * Says, before anything else, that we are not open yet.
 *
 * Deliberately a banner rather than a takeover. Someone who cannot order today
 * can still read the menu and decide what they want on opening day, and a
 * store reviewer needs to see that the app works. Blocking the whole thing
 * would trade one wrong impression for another.
 */
export const OpeningSoonBanner = memo(function OpeningSoonBanner({
  opensOn,
}: OpeningSoonBannerProps) {
  const date = formatShortDate(opensOn);

  return (
    <View
      style={styles.banner}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`We open on ${date}. You can browse the menu now, but orders cannot be placed yet.`}
      testID="opening-soon-banner"
    >
      <View style={styles.icon}>
        <Ionicons name="sparkles" size={17} color={colors.onPrimary} />
      </View>
      <View style={styles.body} importantForAccessibility="no-hide-descendants">
        <Text variant="bodyMedium" color={colors.textOnDark}>
          We open on {date}
        </Text>
        <Text variant="caption" color={colors.textOnDarkMuted}>
          Have a look at the menu — ordering opens with the doors.
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.brand.black,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  body: { flex: 1, gap: spacing.xxs },
});
