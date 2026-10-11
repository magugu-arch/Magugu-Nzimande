import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { isDemo } from '@/providers';
import { Text } from './Text';

export const DEMO_LINE =
  'Concept demo — sample products, sample courier, no real purchase/delivery';

/**
 * The demo label is chrome, not a dismissible toast: while any domain runs on
 * a mock provider it sits above every screen. It wraps rather than truncates.
 */
export function DemoBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!isDemo) return <View style={{ height: insets.top }} />;
  return (
    <View
      style={[styles.strip, { paddingTop: insets.top + 4, backgroundColor: colors.ink }]}
      accessibilityRole="text"
      accessibilityLabel={DEMO_LINE}
    >
      <Text
        variant="caption"
        weight="600"
        align="center"
        style={{ color: colors.onInk }}
        maxFontSizeMultiplier={1.3}
      >
        {DEMO_LINE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { paddingHorizontal: 12, paddingBottom: 5 },
});
