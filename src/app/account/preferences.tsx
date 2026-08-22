import { StyleSheet, View } from 'react-native';
import { Card, Divider, Screen, ScreenHeader, Text, Toggle } from '@/components/ui';
import { FulfilmentSelector } from '@/features/home/components/FulfilmentSelector';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

/** Preferences + notification channels (brief §4). */
export default function PreferencesScreen() {
  const notificationPreferences = useAuthStore((state) => state.notificationPreferences);
  const setNotificationPreference = useAuthStore((state) => state.setNotificationPreference);
  const preferences = useAuthStore((state) => state.preferences);
  const setPreference = useAuthStore((state) => state.setPreference);

  return (
    <Screen scroll edges={['top', 'bottom']} testID="preferences-screen">
      <ScreenHeader title="Preferences" />

      <View style={styles.body}>
        {/* Ordering defaults */}
        <Card style={styles.card}>
          <Text variant="h3">Default order type</Text>
          <Text variant="caption" color={colors.textSecondary}>
            What we pre-select when you open the app.
          </Text>
          <FulfilmentSelector
            value={preferences.defaultFulfilment}
            onChange={(value) => setPreference('defaultFulfilment', value)}
            compact
          />
        </Card>

        {/* What we notify about */}
        <Card style={styles.card}>
          <Text variant="h3">What to notify me about</Text>

          <Toggle
            label="Order updates"
            description="Status changes, driver on the way, ready to collect"
            value={notificationPreferences.orderUpdates}
            onValueChange={(value) => setNotificationPreference('orderUpdates', value)}
            testID="pref-order-updates"
          />
          <Divider spacingSize="none" />
          <Toggle
            label="Offers and promotions"
            description="Deals, discounts and members-only drops"
            value={notificationPreferences.promotions}
            onValueChange={(value) => setNotificationPreference('promotions', value)}
          />
          <Divider spacingSize="none" />
          <Toggle
            label="Rewards"
            description="Points earned, rewards unlocked and expiry reminders"
            value={notificationPreferences.rewards}
            onValueChange={(value) => setNotificationPreference('rewards', value)}
          />
          <Divider spacingSize="none" />
          <Toggle
            label="New on the menu"
            description="When something new comes out of the kitchen"
            value={notificationPreferences.newProducts}
            onValueChange={(value) => setNotificationPreference('newProducts', value)}
          />
        </Card>

        {/* How we reach you */}
        <Card style={styles.card}>
          <Text variant="h3">How to reach me</Text>

          <Toggle
            label="Push notifications"
            value={notificationPreferences.channelPush}
            onValueChange={(value) => setNotificationPreference('channelPush', value)}
          />
          <Divider spacingSize="none" />
          <Toggle
            label="Email"
            value={notificationPreferences.channelEmail}
            onValueChange={(value) => setNotificationPreference('channelEmail', value)}
          />
          <Divider spacingSize="none" />
          <Toggle
            label="SMS"
            description="Standard network rates apply"
            value={notificationPreferences.channelSms}
            onValueChange={(value) => setNotificationPreference('channelSms', value)}
          />
        </Card>

        {/* Personalisation and consent */}
        <Card style={styles.card}>
          <Text variant="h3">Personalisation</Text>

          <Toggle
            label="Show milder items first"
            description="Puts the gentler flavours at the top of every list"
            value={preferences.preferMildFirst}
            onValueChange={(value) => setPreference('preferMildFirst', value)}
          />
          <Divider spacingSize="none" />
          <Toggle
            label="Marketing consent"
            description="Lets us tailor offers to what you actually order"
            value={preferences.marketingConsent}
            onValueChange={(value) => setPreference('marketingConsent', value)}
          />
        </Card>

        <Text variant="caption" color={colors.textMuted}>
          Order updates are essential to your order and may still be sent by SMS even when other
          notifications are off.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
});
