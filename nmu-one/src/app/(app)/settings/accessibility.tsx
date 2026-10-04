import { View } from 'react-native';
import { Card, Header, ListRow, Screen, Text, colors, spacing, useReduceMotion } from '@/design';

/**
 * Accessibility (brief §20) — NMU ONE follows the phone's own settings rather
 * than asking people to configure the app separately.
 */
export default function AccessibilitySettings() {
  const reduceMotion = useReduceMotion();
  return (
    <Screen
      header={
        <Header
          title="Accessibility"
          largeTitle="Accessibility"
          eyebrow="Settings"
          fallbackHref="/profile"
        />
      }
      testID="accessibility-settings"
    >
      <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.lg }}>
        NMU ONE follows your phone’s accessibility settings, so there’s nothing extra to switch on
        here.
      </Text>
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <ListRow
          icon="text-outline"
          title="Text size"
          subtitle="Follows your phone’s text size. Reading text grows without limit; buttons and labels grow to twice their size."
        />
        <ListRow
          icon="move-outline"
          title="Reduce motion"
          subtitle={
            reduceMotion
              ? 'On — screens fade instead of sliding, and nothing pulses.'
              : 'Off — turn it on in your phone settings to remove movement.'
          }
        />
        <ListRow
          icon="ear-outline"
          title="Screen readers"
          subtitle="Every control has a spoken label; maps and photos have text alternatives."
        />
        <ListRow
          icon="contrast-outline"
          title="Contrast"
          subtitle="Text meets WCAG 2.2 AA contrast throughout. Colour never carries meaning on its own."
        />
        <ListRow
          icon="hand-left-outline"
          title="Touch targets"
          subtitle="Every tappable control is at least 48 points."
        />
      </Card>
      <View style={{ marginTop: spacing.lg }}>
        <Text variant="caption" color={colors.textSecondary}>
          Something hard to use? Tell the Student Help Desk — accessibility issues are treated as
          defects.
        </Text>
      </View>
    </Screen>
  );
}
