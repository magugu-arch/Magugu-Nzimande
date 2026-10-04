import { StyleSheet, View } from 'react-native';
import { colors, MIN_TOUCH_TARGET, radius } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface IconButtonProps {
  icon: IconName;
  /** Required: an icon alone says nothing to a screen reader. */
  label: string;
  onPress: () => void;
  tone?: 'plain' | 'filled' | 'onDark' | 'onPhoto';
  badge?: number;
  testID?: string;
}

const TONES = {
  plain: { bg: 'transparent', fg: colors.navy },
  filled: { bg: colors.surface, fg: colors.navy },
  onDark: { bg: 'rgba(255,255,255,0.12)', fg: colors.white },
  onPhoto: { bg: 'rgba(20,28,43,0.55)', fg: colors.white },
} as const;

export function IconButton({
  icon,
  label,
  onPress,
  tone = 'plain',
  badge,
  testID,
}: IconButtonProps) {
  const t = TONES[tone];
  const a11y = badge ? `${label}, ${badge} unread` : label;
  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      accessibilityLabel={a11y}
      style={[styles.button, { backgroundColor: t.bg }]}
    >
      <Icon name={icon} size={22} color={t.fg} />
      {badge ? (
        <View style={styles.badge}>
          <Text variant="tab" color={colors.navy}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
