import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing } from '../tokens';

export interface ScreenProps {
  children: ReactNode;
  /** Rendered above the scroll area (a header that stays put). */
  header?: ReactNode;
  /** Rendered below the scroll area (a sticky action bar). */
  footer?: ReactNode;
  scroll?: boolean;
  tone?: 'canvas' | 'navy' | 'white';
  padded?: boolean;
  /** Apply the top safe-area inset (off when a header or photo handles it). */
  topInset?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Screen shell: background, safe areas, status bar, scroll, pull-to-refresh
 * and a sticky footer — so no screen re-implements them.
 */
export function Screen({
  children,
  header,
  footer,
  scroll = true,
  tone = 'canvas',
  padded = true,
  topInset = true,
  onRefresh,
  refreshing = false,
  contentStyle,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bg = tone === 'navy' ? colors.navy : tone === 'white' ? colors.white : colors.background;
  const inner: StyleProp<ViewStyle> = [
    padded ? styles.padded : null,
    { paddingTop: topInset && !header ? insets.top + spacing.sm : spacing.sm },
    { paddingBottom: footer ? spacing.xl : insets.bottom + spacing.xxl },
    contentStyle,
  ];
  return (
    <View testID={testID} style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar style={tone === 'navy' ? 'light' : 'dark'} />
      {header}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.navy}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>{footer}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.gutter },
  footer: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
