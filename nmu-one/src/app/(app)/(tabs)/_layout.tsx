import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { unreadCount } from '@/core/notifications/priority';
import { useNotificationsQuery } from '@/data/hooks';
import { Icon, Text, TAB_BAR_HEIGHT, colors, spacing, type IconName } from '@/design';

/**
 * Primary navigation (brief §4): Home · Services · Campus · Notifications ·
 * Profile. Five destinations, no hamburger menu.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const notifications = useNotificationsQuery();
  const unread = notifications.data ? unreadCount(notifications.data) : 0;

  const icon =
    (outline: IconName, filled: IconName, badge = 0) =>
    ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <View>
        <Icon name={focused ? filled : outline} size={24} color={color as string} />
        {badge > 0 ? (
          <View style={styles.badge}>
            <Text variant="tab" color={colors.navy}>
              {badge > 9 ? '9+' : badge}
            </Text>
          </View>
        ) : null}
      </View>
    );

  // Tab labels scale with the OS setting, but only so far: the bar has a
  // fixed height, and past 1.3× five labels collide at 320pt.
  const label =
    (title: string) =>
    ({ color }: { color: ColorValue }) => (
      <Text variant="tab" color={color as string} maxFontSizeMultiplier={1.3} style={styles.label}>
        {title}
      </Text>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: [styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom + spacing.xs }],
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarLabel: label('Home'), tabBarIcon: icon('home-outline', 'home'), tabBarButtonTestID: 'tab-home' }} />
      <Tabs.Screen name="services" options={{ title: 'Services', tabBarLabel: label('Services'), tabBarIcon: icon('grid-outline', 'grid'), tabBarButtonTestID: 'tab-services' }} />
      <Tabs.Screen name="campus" options={{ title: 'Campus', tabBarLabel: label('Campus'), tabBarIcon: icon('map-outline', 'map'), tabBarButtonTestID: 'tab-campus' }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarLabel: label('Notifications'),
          tabBarAccessibilityLabel: unread ? `Notifications, ${unread} unread` : 'Notifications',
          tabBarIcon: icon('notifications-outline', 'notifications', unread),
          tabBarButtonTestID: 'tab-notifications',
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: label('Profile'), tabBarIcon: icon('person-circle-outline', 'person-circle'), tabBarButtonTestID: 'tab-profile' }} />
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
  label: { marginTop: 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.yellow,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
