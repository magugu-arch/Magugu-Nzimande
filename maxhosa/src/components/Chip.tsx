import { StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/design/theme';
import { MIN_TOUCH, radius, space } from '@/design/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** radio: one of a group; checkbox: any number. */
  kind?: 'radio' | 'checkbox';
  struck?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  tall?: boolean;
};

export function Chip({
  label,
  selected,
  onPress,
  kind = 'checkbox',
  struck,
  icon,
  accessibilityLabel,
  tall,
}: Props) {
  const { colors } = useTheme();
  const fg = selected ? colors.onInk : struck ? colors.ink3 : colors.ink2;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole={kind}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={tall ? 0 : 4}
      style={[
        styles.chip,
        tall && styles.tall,
        selected
          ? { backgroundColor: colors.ink, borderColor: colors.ink }
          : { borderColor: colors.hairlineStrong },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text
        variant="subhead"
        weight="600"
        maxFontSizeMultiplier={1.6}
        style={{ color: fg, textDecorationLine: struck ? 'line-through' : 'none' }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tall: { minHeight: MIN_TOUCH, minWidth: 52, justifyContent: 'center' },
});
