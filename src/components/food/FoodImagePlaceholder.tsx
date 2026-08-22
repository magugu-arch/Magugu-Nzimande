import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';

export interface FoodImagePlaceholderProps {
  label: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

/**
 * Branded stand-in for a product whose supplied bb.q artwork has not landed yet.
 *
 * Deliberately non-photographic: the brief forbids generic stock food imagery
 * and placeholder food blocks in production UI, so this reads unmistakably as
 * "artwork pending" rather than pretending to be a product shot. It disappears
 * on its own the moment the master is added to assets/food/masters/.
 */
export const FoodImagePlaceholder = memo(function FoodImagePlaceholder({
  label,
  style,
  compact = false,
}: FoodImagePlaceholderProps) {
  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${label} — product photography coming soon`}
    >
      <View style={styles.mark}>
        <Ionicons name="camera-outline" size={compact ? 16 : 22} color={colors.brand.red} />
      </View>
      {!compact ? (
        <>
          <Text variant="captionMedium" color={colors.textOnDark} align="center" numberOfLines={2}>
            {label}
          </Text>
          <Text variant="micro" color={colors.textOnDarkMuted} align="center">
            Photography coming soon
          </Text>
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.brand.black,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(227,25,55,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(227,25,55,0.5)',
  },
});
