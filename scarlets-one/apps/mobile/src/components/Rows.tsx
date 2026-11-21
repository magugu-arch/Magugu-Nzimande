import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { hitTarget, radius, space, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Press } from './Press';
import { Text } from './Text';

export function SectionHeader({
  title,
  action,
  style,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: space.md,
        },
        style,
      ]}
    >
      <Text variant="title2" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
      {action ? (
        <Press
          onPress={action.onPress}
          accessibilityLabel={`${action.label}: ${title}`}
          hitSlop={12}
          style={{ paddingVertical: 4 }}
        >
          <Text variant="footnote" color="accentText" style={{ fontWeight: '600' }}>
            {action.label}
          </Text>
        </Press>
      ) : null}
    </View>
  );
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName | string;
  onPress?: () => void;
  trailing?: ReactNode;
  /** Shows an arrow that leaves the app, not a chevron that goes deeper. */
  external?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

/** One row of a grouped list. The whole row is the target. */
export function ListRow({
  title,
  subtitle,
  icon,
  onPress,
  trailing,
  external,
  accessibilityHint,
  testID,
}: ListRowProps) {
  const theme = useTheme();
  const content = (
    <>
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            borderCurve: 'continuous',
            backgroundColor: theme.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={19} color={theme.accentText} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="headline">{title}</Text>
        {subtitle ? (
          <Text variant="footnote" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {onPress && !trailing ? (
        <Icon
          name={external ? 'open-outline' : 'chevron-forward'}
          size={17}
          color={theme.textSecondary}
        />
      ) : null}
    </>
  );
  const style: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: hitTarget + 12,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  };
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Press
      testID={testID}
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      accessibilityRole={external ? 'link' : 'button'}
      style={style}
    >
      {content}
    </Press>
  );
}

/** A group of rows on one card, separated by inset hairlines. */
export function RowGroup({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const rows = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <View
      style={[
        {
          backgroundColor: theme.surface,
          borderRadius: radius.xl,
          borderCurve: 'continuous',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {rows.map((row, index) => (
        <View key={index}>
          {index > 0 ? (
            <View style={{ height: 1, marginLeft: space.lg, backgroundColor: theme.hairline }} />
          ) : null}
          {row}
        </View>
      ))}
    </View>
  );
}

/** Two-letter team mark. The supplied crest is the only crest: none is drawn. */
export function TeamMark({
  shortName,
  isScarlets,
  size = 44,
  onDark,
}: {
  shortName: string;
  isScarlets: boolean;
  size?: number;
  onDark?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isScarlets ? theme.accent : 'transparent',
        borderWidth: isScarlets ? 0 : 1.5,
        borderColor: onDark ? 'rgba(246,242,236,0.45)' : theme.hairline,
      }}
    >
      <Text
        variant="caption"
        style={{
          color: isScarlets ? theme.onAccent : onDark ? theme.onInverse : theme.text,
          fontWeight: '800',
          letterSpacing: 0.6,
          fontSize: size * 0.27,
          lineHeight: size * 0.36,
        }}
      >
        {shortName}
      </Text>
    </View>
  );
}
