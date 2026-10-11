import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export function GroupTitle({ children }: { children: string }) {
  return (
    <Text
      variant="footnote"
      weight="600"
      color="ink3"
      style={styles.groupTitle}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

export function Group({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
      {children}
    </View>
  );
}

type RowProps = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  end?: ReactNode;
  external?: boolean;
  first?: boolean;
  leading?: ReactNode;
};

export function Row({ title, subtitle, icon, onPress, end, external, first, leading }: RowProps) {
  const { colors } = useTheme();
  const content = (
    <View style={styles.row}>
      {leading}
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: colors.sunk }]}>
          <Ionicons name={icon} size={17} color={colors.ink} />
        </View>
      ) : null}
      <View style={styles.rowMain}>
        <Text variant="callout" weight="500">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="ink3">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {end ??
        (onPress ? (
          <Ionicons
            name={external ? 'open-outline' : 'chevron-forward'}
            size={16}
            color={colors.ink3}
          />
        ) : null)}
    </View>
  );
  return (
    <View>
      {!first ? (
        <View
          style={[
            styles.divider,
            { backgroundColor: colors.hairline, marginLeft: icon ? 52 : space.l },
          ]}
        />
      ) : null}
      {onPress ? (
        <PressableScale
          onPress={onPress}
          pressedScale={0.99}
          accessibilityRole={external ? 'link' : 'button'}
          accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
        >
          {content}
        </PressableScale>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: { paddingHorizontal: space.gutter + 4, paddingTop: space.xl, paddingBottom: space.s },
  group: {
    marginHorizontal: space.gutter,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: 52,
    paddingHorizontal: space.l,
    paddingVertical: space.s + 2,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, gap: 1 },
  divider: { height: StyleSheet.hairlineWidth },
});
