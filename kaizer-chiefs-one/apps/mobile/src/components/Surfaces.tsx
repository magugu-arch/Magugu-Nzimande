import type { ReactNode } from 'react';
import { StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { color, radius, space, touchTarget } from '@/theme';

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  padded?: boolean;
}) {
  const s = [styles.card, padded && styles.padded, style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.985}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={s}
    >
      {children}
    </PressableScale>
  );
}

type IconName = keyof typeof Ionicons.glyphMap;

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  trailing,
  destructive,
  accessibilityHint,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  destructive?: boolean;
  accessibilityHint?: string;
}) {
  const content = (
    <>
      {icon ? (
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={20} color={destructive ? color.danger : color.accent} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text variant="headline" style={destructive ? { color: color.danger } : null}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="footnote" color="textTertiary">
          {value}
        </Text>
      ) : null}
      {trailing}
      {onPress && !trailing ? (
        <Ionicons name="chevron-forward" size={18} color={color.textTertiary} />
      ) : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.99}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      style={styles.row}
    >
      {content}
    </PressableScale>
  );
}

export function ToggleRow({
  title,
  description,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text variant="headline">{title}</Text>
        {description ? (
          <Text variant="footnote" color="textSecondary">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={title}
        accessibilityHint={description}
        trackColor={{ false: color.surfaceHigh, true: color.accent }}
        thumbColor={color.text}
        ios_backgroundColor={color.surfaceHigh}
      />
    </View>
  );
}

/** A grouped list, iOS settings style, on a charcoal surface. */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={[styles.group, style]}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? <View style={styles.sep} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    overflow: 'hidden',
  },
  padded: { padding: space.lg },
  row: {
    minHeight: touchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  rowIcon: { width: 28, alignItems: 'center' },
  rowText: { flex: 1, gap: 2 },
  group: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    overflow: 'hidden',
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: color.line, marginLeft: space.lg },
});
