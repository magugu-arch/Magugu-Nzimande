import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/ui';
import { useCartStore } from '@/store/cartStore';
import { colors, radius, spacing, typography, TAB_BAR_HEIGHT } from '@/theme';

/**
 * Primary navigation — brief §4.
 *
 *     Home · Menu · Reserve · Rewards · Account
 *
 * Two changes from what the app had, and the brief is explicit about both:
 *
 *   "Do not create a separate 'Orders' tab unless the existing information
 *    architecture requires it; order history can live in Account, while an
 *    active order uses a persistent status card."
 *
 * So Orders becomes Reserve. That is not a swap of convenience — §4 puts
 * Reserve among the five customer jobs the product is organised around, and a
 * restaurant where most guests eat in should not make booking a table harder
 * to reach than a receipt. Order history moves into Account, where §9 lists
 * it, and an active order surfaces as a status card on Home.
 *
 * And More becomes Account, because "More" names a drawer rather than a
 * destination — a guest looking for their reservations has no reason to think
 * they are under "More".
 *
 * The cart badge moves with the work rather than staying on a tab: it now
 * rides the Menu tab, which is where a part-built order is resumed.
 * Mediterranean Olive marks the active tab.
 */
export default function TabsLayout() {
  const itemCount = useCartStore((state) => state.getItemCount());
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.label,
        // Height comes from the real inset rather than a per-platform guess.
        // The guess was 24pt on iOS and 8 elsewhere, which left the label about
        // three points short of its own line box on a device with no home
        // indicator — enough to shave the descenders off every tab.
        tabBarStyle: [
          styles.bar,
          { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom + spacing.xs },
        ],
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons
                name={focused ? 'restaurant' : 'restaurant-outline'}
                size={23}
                color={color}
              />
              {itemCount > 0 ? (
                <View style={styles.badge}>
                  <Text variant="micro" color={colors.onPrimary}>
                    {itemCount > 9 ? '9+' : itemCount}
                  </Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reserve"
        options={{
          title: 'Reserve',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'ribbon' : 'ribbon-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={23} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: spacing.xs,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: { paddingVertical: 0 },
  // Not typography.micro: that carries a 16pt line box for body-adjacent use,
  // and a tab label needs its ascender-to-descender box, nothing more.
  label: { ...typography.micro, lineHeight: 13, marginTop: spacing.xxs },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
