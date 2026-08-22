import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '@/components/ui';
import { useCartStore } from '@/store/cartStore';
import { colors, radius, spacing, typography, TAB_BAR_HEIGHT } from '@/theme';

/**
 * Primary navigation (brief §5): Home | Menu | Rewards | Orders | More.
 * bb.q Red marks the active tab.
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
            <Ionicons
              name={focused ? 'restaurant' : 'restaurant-outline'}
              size={23}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'gift' : 'gift-outline'} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={23} color={color} />
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
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'}
              size={23}
              color={color}
            />
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
