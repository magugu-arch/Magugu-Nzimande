import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Divider, Screen, ScreenHeader, Text, Toggle } from '@/components/ui';
import { FulfilmentSelector } from '@/features/home/components/FulfilmentSelector';
import { usePushRegistration } from '@/features/notifications/hooks';
import { useRemotePreferences } from '@/features/account/useRemotePreferences';
import { useAuthStore } from '@/store/authStore';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import { colors, radius, spacing } from '@/theme';
import { openAppSettings } from '@/utils/linking';

/** Preferences + notification channels (brief §4). */
export default function PreferencesScreen() {
  const notificationPreferences = useAuthStore((state) => state.notificationPreferences);
  const preferences = useAuthStore((state) => state.preferences);
  const setPreference = useAuthStore((state) => state.setPreference);
  const applyDefaultFulfilment = useFulfilmentStore((state) => state.applyDefaultFulfilment);

  // Every switch below used to write to AsyncStorage and stop there, so
  // switching off "Promotions" changed a local boolean and the promotions kept
  // coming. These go to the server and put themselves back if that fails.
  const { setNotification, setMarketingConsent, error, dismissError } = useRemotePreferences();

  const { outcome, registerNow } = usePushRegistration();

  return (
    <Screen scroll edges={['top', 'bottom']} testID="preferences-screen">
      <ScreenHeader title="Preferences" />

      <View style={styles.body}>
        {/*
          A reverted switch has to say why. Putting it back silently would look
          exactly like the bug this replaced — a toggle that does not do what
          it appears to have done.
        */}
        {error ? (
          <View style={styles.notice} testID="preferences-error">
            <Ionicons name="alert-circle" size={18} color={colors.status.warning} />
            <Text variant="caption" color={colors.textSecondary} style={styles.noticeBody}>
              {error}
            </Text>
            <Pressable
              onPress={dismissError}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Dismiss preferences error"
            >
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {/* Ordering defaults */}
        <Card style={styles.card}>
          <Text variant="h3">Default order type</Text>
          <Text variant="caption" color={colors.textSecondary}>
            What we pre-select when you open the app.
          </Text>
          <FulfilmentSelector
            value={preferences.defaultFulfilment}
            onChange={(value) => {
              setPreference('defaultFulfilment', value);
              // Applied now as well as on the next open, so the control does
              // something the customer can see. Declines if a branch is
              // already chosen — see `applyDefaultFulfilment`.
              applyDefaultFulfilment(value);
            }}
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
            onValueChange={(value) => setNotification('orderUpdates', value)}
            testID="pref-order-updates"
          />
          <Divider spacingSize="none" />
          <Toggle
            label="Offers and promotions"
            description="Deals, discounts and members-only drops"
            value={notificationPreferences.promotions}
            onValueChange={(value) => setNotification('promotions', value)}
          />
          <Divider spacingSize="none" />
          <Toggle
            label="Rewards"
            description="Points earned, rewards unlocked and expiry reminders"
            value={notificationPreferences.rewards}
            onValueChange={(value) => setNotification('rewards', value)}
          />
          <Divider spacingSize="none" />
          <Toggle
            label="New on the menu"
            description="When something new comes out of the kitchen"
            value={notificationPreferences.newProducts}
            onValueChange={(value) => setNotification('newProducts', value)}
          />
        </Card>

        {/* How we reach you */}
        <Card style={styles.card}>
          <Text variant="h3">How to reach me</Text>

          <Toggle
            label="Push notifications"
            value={notificationPreferences.channelPush}
            onValueChange={(value) => setNotification('channelPush', value)}
          />

          {/*
            A toggle that is on while the OS permission is denied is a lie.
            Say what actually happened and give them the way to fix it.
          */}
          {notificationPreferences.channelPush && outcome && outcome.status !== 'granted' ? (
            <View style={styles.pushNotice}>
              <Ionicons name="information-circle" size={16} color={colors.status.warning} />
              <View style={styles.pushNoticeBody}>
                <Text variant="caption" color={colors.textSecondary}>
                  {outcome.status === 'denied'
                    ? 'Push is switched off for bb.q in your device settings, so these will not arrive.'
                    : outcome.reason}
                </Text>
                {outcome.status === 'denied' ? (
                  <Button
                    label="Open device settings"
                    onPress={() => void openAppSettings()}
                    variant="text"
                    size="sm"
                    fullWidth={false}
                    style={styles.pushAction}
                  />
                ) : outcome.status === 'error' ? (
                  <Button
                    label="Try again"
                    onPress={() => void registerNow()}
                    variant="text"
                    size="sm"
                    fullWidth={false}
                    style={styles.pushAction}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
          <Divider spacingSize="none" />
          <Toggle
            label="Email"
            value={notificationPreferences.channelEmail}
            onValueChange={(value) => setNotification('channelEmail', value)}
          />
          <Divider spacingSize="none" />
          <Toggle
            label="SMS"
            description="Standard network rates apply"
            value={notificationPreferences.channelSms}
            onValueChange={(value) => setNotification('channelSms', value)}
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
            onValueChange={(value) => setMarketingConsent(value)}
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
  pushNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.status.warningSoft,
  },
  pushNoticeBody: { flex: 1, gap: spacing.xs },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.status.warningSoft,
  },
  noticeBody: { flex: 1 },
  pushAction: { marginLeft: -spacing.md },
});
