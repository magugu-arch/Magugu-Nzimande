import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, elevation, radius, spacing } from '@/theme';
import { a11yState } from '@/utils/a11yState';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  /**
   * A second action, drawn at the trailing edge and kept *outside* the card's
   * own pressable region.
   *
   * A pressable card with a control inside it is ordinary React Native and
   * invalid HTML: React Native Web compiles both to `<button>`, and React says
   * so — "In HTML, <button> cannot be a descendant of <button>. This will cause
   * a hydration error." A screen reader has the parser's problem too, two
   * controls at one position with nothing to say which a tap meant.
   *
   * Passing the second action here rather than nesting it in `children` makes
   * the two siblings, so any card that needs one is correct by construction.
   * The saved-address card is what found this: every unselected address wrapped
   * its own delete button.
   */
  trailing?: ReactNode;
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
  trailing,
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
        {trailing}
      </View>
    );
  }

  /**
   * With a trailing action the card stops *being* the button and starts
   * *containing* one, so the two controls end up side by side rather than one
   * inside the other. The padding moves onto the pressable half so the card
   * still looks the same and the tap target still reaches the card's edges.
   */
  if (trailing) {
    return (
      <View style={[containerStyle, styles.split, padded ? styles.unpadded : null]}>
        <Pressable
          testID={testID}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          {...a11yState({ selected })}
          style={({ pressed }) => [
            styles.splitMain,
            padded ? styles.padded : null,
            pressed ? styles.pressed : null,
          ]}
        >
          {children}
        </Pressable>
        <View style={[styles.trailing, padded ? styles.trailingPadded : null]}>{trailing}</View>
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...a11yState({ selected })}
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
  /** The card's own padding moves onto its two halves. */
  unpadded: { padding: 0 },
  split: { flexDirection: 'row', alignItems: 'flex-start' },
  splitMain: { flex: 1 },
  trailing: { alignItems: 'center', justifyContent: 'flex-start' },
  trailingPadded: { paddingTop: spacing.lg, paddingRight: spacing.lg, paddingBottom: spacing.lg },
  bordered: { borderWidth: 1, borderColor: colors.border },
  selected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.9 },
});
