import { Platform, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { Material } from './Material';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export const TAB_BAR_HEIGHT = 56;

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['home-outline', 'home'],
  shop: ['grid-outline', 'grid'],
  discover: ['compass-outline', 'compass'],
  saved: ['heart-outline', 'heart'],
  account: ['person-outline', 'person'],
};

type Route = { key: string; name: string };
type Props = {
  state: { index: number; routes: Route[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
};

/**
 * A translucent material the content scrolls beneath, rather than an opaque
 * strip. Tapping the current tab returns its list to the top (each tab's
 * scroll view registers with `useScrollToTop`).
 */
export function TabBar({ state, descriptors, navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}
    >
      <Material />
      <View style={[styles.hairline, { backgroundColor: colors.hairline }]} />
      <View style={styles.row} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const label = descriptors[route.key]?.options.title ?? route.name;
          const [outline, filled] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.tab}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (Platform.OS === 'ios') void Haptics.selectionAsync();
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            >
              <Ionicons
                name={focused ? filled : outline}
                size={23}
                color={focused ? colors.ink : colors.ink3}
              />
              <Text
                variant="caption"
                weight="600"
                maxFontSizeMultiplier={1.2}
                style={{ color: focused ? colors.ink : colors.ink3, fontSize: 11 }}
              >
                {label}
              </Text>
              <View
                style={[styles.dot, { backgroundColor: colors.ochre, opacity: focused ? 1 : 0 }]}
              />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  hairline: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
  row: { flex: 1, flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: space.xs },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
