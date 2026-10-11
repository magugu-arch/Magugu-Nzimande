import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

/**
 * Content for a native sheet: title, close button, scrolling body, and a
 * footer that stays on screen. The sheet itself — grabber, detents, drag and
 * flick-to-dismiss — is the platform's.
 */
export function SheetScaffold({
  title,
  children,
  footer,
  scroll = true,
  closable = true,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  closable?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;
  return (
    <View style={[styles.fill, { backgroundColor: colors.card }]}>
      <View style={styles.head}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {closable ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            style={[styles.close, { backgroundColor: colors.sunk }]}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={colors.ink} />
          </PressableScale>
        ) : null}
      </View>
      <Body
        style={scroll ? styles.fill : undefined}
        contentContainerStyle={scroll ? styles.body : undefined}
      >
        {scroll ? children : <View style={styles.body}>{children}</View>}
      </Body>
      {footer ? (
        <View
          style={[
            styles.footer,
            { borderColor: colors.hairline, paddingBottom: insets.bottom + space.m },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space.gutter,
    paddingRight: space.m,
    paddingTop: space.xl,
    paddingBottom: space.m,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: space.gutter, paddingBottom: space.xl },
  footer: {
    paddingHorizontal: space.gutter,
    paddingTop: space.m,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
