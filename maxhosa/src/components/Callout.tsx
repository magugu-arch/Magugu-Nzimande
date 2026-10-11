import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { Text } from './Text';

export function Callout({
  icon = 'information-circle-outline',
  title,
  children,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.paper, borderColor: colors.hairline }]}>
      <Ionicons name={icon} size={20} color={colors.ink} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <Text variant="subhead" weight="700">
            {title}
          </Text>
        ) : null}
        <Text variant="subhead" color="ink2">
          {children}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: space.m,
    padding: space.l,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
