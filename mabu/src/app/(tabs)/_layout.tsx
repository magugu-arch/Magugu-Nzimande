import { Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandIcon, type BrandIconName } from '@/components/brand/BrandIcon';
import { Text } from '@/components/ui';
import { colors, fontFamily, spacing, TAB_BAR_HEIGHT } from '@/theme';
import { haptic } from '@/utils/haptics';

/**
 * §4 navigation: Home · Discover · Book · Events · Profile. Book is the brass
 * centre button, reachable from every tab (§4 "Keep Book visually prominent").
 *
 * SDK 57: `Tabs` from the package root is deprecated; the JS tab navigator
 * now lives at `expo-router/js-tabs`.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [
          styles.bar,
          { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom + spacing.xs },
        ],
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('discover') }} />
      <Tabs.Screen
        name="book"
        options={{
          title: 'Book',
          tabBarAccessibilityLabel: 'Book a table',
          tabBarButton: (props) => (
            <Pressable
              onPress={(e) => {
                haptic.select();
                props.onPress?.(e);
              }}
              accessibilityRole="button"
              accessibilityLabel="Book a table"
              aria-selected={props['aria-selected'] ?? undefined}
              style={styles.bookWrap}
            >
              <View style={styles.book}>
                <BrandIcon
                  name="reservations"
                  size={26}
                  color={colors.textOnAccent}
                  strokeWidth={1.6}
                />
              </View>
              <Text variant="caption" color="accent" style={styles.bookLabel}>
                Book
              </Text>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="events" options={{ title: 'Events', tabBarIcon: icon('events') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('profile') }} />
    </Tabs>
  );
}

function icon(name: BrandIconName) {
  const TabIcon = ({ color }: { color: ColorValue }) => (
    <BrandIcon name={name} size={24} color={String(color)} strokeWidth={1.5} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xs,
  },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 10, letterSpacing: 0.8 },
  bookWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  book: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginTop: -20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  bookLabel: { fontFamily: fontFamily.bodyMedium, fontSize: 10, letterSpacing: 0.8, marginTop: 2 },
});
