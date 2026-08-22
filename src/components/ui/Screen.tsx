import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, spacing } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Wraps content in a ScrollView. Turn off for FlatList-based screens. */
  scroll?: boolean;
  /** bb.q Black background with a light status bar. */
  dark?: boolean;
  padded?: boolean;
  edges?: readonly Edge[];
  /** Extra bottom padding, e.g. to clear a sticky cart bar. */
  bottomInset?: number;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Screen shell: safe areas, background, status-bar style and scroll behaviour
 * in one place so no screen re-implements them.
 */
export function Screen({
  children,
  scroll = false,
  dark = false,
  padded = true,
  edges = ['top'],
  bottomInset = 0,
  refreshControl,
  contentStyle,
  style,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const background = dark ? colors.surfaceDark : colors.background;

  const paddingTop = edges.includes('top') ? insets.top : 0;
  const paddingBottom = (edges.includes('bottom') ? insets.bottom : 0) + bottomInset;

  const inner: StyleProp<ViewStyle> = [
    padded ? styles.padded : null,
    { paddingTop, paddingBottom },
    contentStyle,
  ];

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: background }, style]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={inner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg },
});
