import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, elevation, radius, spacing } from '@/theme';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  padded?: boolean;
  raised?: boolean;
  bordered?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export const Card = memo(function Card({
  children,
  onPress,
  padded = true,
  raised = false,
  bordered = true,
  selected = false,
  style,
  accessibilityLabel,
  testID,
}: CardProps) {
  const containerStyle: StyleProp<ViewStyle> = [
    styles.card,
    padded ? styles.padded : null,
    bordered ? styles.bordered : null,
    selected ? styles.selected : null,
    raised ? elevation.sm : null,
    style,
  ];

  if (!onPress) {
    return (
      <View testID={testID} style={containerStyle} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={({ pressed }) => [containerStyle, pressed ? styles.pressed : null]}
    >
      {children}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  padded: { padding: spacing.lg },
  bordered: { borderWidth: 1, borderColor: colors.border },
  selected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.9 },
});
