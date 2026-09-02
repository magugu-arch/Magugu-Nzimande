import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { BrandMark } from '@/components/brand/BrandMark';
import { Badge, Button, Card, Divider, ListRow, Screen, Text } from '@/components/ui';
import { StickyCartBar } from '@/features/cart/components/StickyCartBar';
import { useNotifications } from '@/features/account/hooks';
import { useLoyaltyAccount } from '@/features/rewards/hooks';
import { SUPPORT } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import { useSignOut } from '@/features/system/useSignOut';
import { colors, radius, spacing, CART_BAR_HEIGHT, TAB_BAR_HEIGHT } from '@/theme';
import { groupDigits } from '@/utils/money';
import { ask } from '@/ux/dialog';

/** More tab — Account hub (brief §4). */
export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isGuest = useAuthStore((state) => state.isGuest);
  const { signOut } = useSignOut();

  const loyalty = useLoyaltyAccount();
  const notifications = useNotifications();

  const unreadCount = (notifications.data ?? []).filter((item) => !item.read).length;

  const handleSignOut = useCallback(async () => {
    const confirmed = await ask({
      title: 'Sign out?',
      message: 'You can sign back in any time.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Stay signed in',
      destructive: true,
    });
    // The hook does the routing too — it has to clear the cart, the fulfilment
    // details and the query cache first.
    if (confirmed) await signOut();
  }, [signOut]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <Screen
        scroll
        padded={false}
        edges={[]}
        contentStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: TAB_BAR_HEIGHT + CART_BAR_HEIGHT },
        ]}
        testID="more-screen"
      >
        {/* Identity */}
        {isAuthenticated && user && !isGuest ? (
          <Card onPress={() => router.push('/account/profile')} style={styles.profileCard}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text variant="h3" color={colors.onPrimary}>
                  {user.avatarInitials}
                </Text>
              </View>

              <View style={styles.profileBody}>
                <Text variant="h3">
                  {user.firstName} {user.lastName}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {user.email}
                </Text>
                {loyalty.data ? (
                  <Badge
                    label={`${loyalty.data.tierName} · ${groupDigits(loyalty.data.pointsBalance)} pts`}
                    tone="primary"
                    icon="star"
                    style={styles.profileBadge}
                  />
                ) : null}
              </View>
            </View>
          </Card>
        ) : (
          <Card style={styles.profileCard}>
            <Text variant="h3">You&apos;re browsing as a guest</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Sign in to earn points, save addresses and reorder in two taps.
            </Text>
            <View style={styles.guestActions}>
              <Button label="Sign in" onPress={() => router.push('/(auth)/sign-in')} />
              <Button
                label="Create an account"
                onPress={() => router.push('/(auth)/register')}
                variant="tertiary"
              />
            </View>
          </Card>
        )}

        {/* Account */}
        <View style={styles.group}>
          <Text variant="overline" color={colors.textMuted} style={styles.groupTitle}>
            Account
          </Text>
          <Card padded={false} style={styles.groupCard}>
            <ListRow
              title="Profile"
              subtitle="Name, email and mobile number"
              icon="person-outline"
              onPress={() => router.push('/account/profile')}
            />
            <Divider spacingSize="none" />
            <ListRow
              title="Saved addresses"
              subtitle="Where we deliver to"
              icon="location-outline"
              onPress={() => router.push('/checkout/address')}
            />
            <Divider spacingSize="none" />
            <ListRow
              title="Payment methods"
              subtitle="Cards and other ways to pay"
              icon="card-outline"
              onPress={() => router.push('/account/payment-methods')}
            />
            <Divider spacingSize="none" />
            <ListRow
              title="Notifications"
              subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'Order updates and offers'}
              icon="notifications-outline"
              onPress={() => router.push('/account/notifications')}
              right={
                unreadCount > 0 ? (
                  <View style={styles.unreadDot}>
                    <Text variant="micro" color={colors.onPrimary}>
                      {unreadCount}
                    </Text>
                  </View>
                ) : undefined
              }
            />
            <Divider spacingSize="none" />
            <ListRow
              title="Preferences"
              subtitle="Defaults and marketing choices"
              icon="options-outline"
              onPress={() => router.push('/account/preferences')}
            />
          </Card>
        </View>

        {/* Ordering */}
        <View style={styles.group}>
          <Text variant="overline" color={colors.textMuted} style={styles.groupTitle}>
            Ordering
          </Text>
          <Card padded={false} style={styles.groupCard}>
            <ListRow
              title="Find a store"
              subtitle="Locations, hours and services"
              icon="storefront-outline"
              onPress={() => router.push('/checkout/store')}
            />
            <Divider spacingSize="none" />
            <ListRow
              title="Offers"
              subtitle="Everything running right now"
              icon="pricetags-outline"
              onPress={() => router.push('/offers')}
            />
            <Divider spacingSize="none" />
            <ListRow
              title="Voucher wallet"
              subtitle="Your codes and vouchers"
              icon="ticket-outline"
              onPress={() => router.push('/rewards/vouchers')}
            />
          </Card>
        </View>

        {/* Support */}
        <View style={styles.group}>
          <Text variant="overline" color={colors.textMuted} style={styles.groupTitle}>
            Help & legal
          </Text>
          <Card padded={false} style={styles.groupCard}>
            <ListRow
              title="Help centre"
              subtitle="Answers to common questions"
              icon="help-circle-outline"
              onPress={() => router.push('/account/help')}
            />
            <Divider spacingSize="none" />
            <ListRow
              title="Contact us"
              subtitle={SUPPORT.hours}
              icon="chatbubbles-outline"
              onPress={() => router.push('/account/contact')}
            />
            <Divider spacingSize="none" />
            <ListRow
              title="Terms & privacy"
              subtitle="How we handle your data"
              icon="document-text-outline"
              onPress={() => router.push('/account/legal')}
            />
          </Card>
        </View>

        {isAuthenticated && !isGuest ? (
          <Button
            label="Sign out"
            onPress={handleSignOut}
            variant="tertiary"
            iconLeft="log-out-outline"
            style={styles.signOut}
            testID="more-sign-out"
          />
        ) : null}

        {/* Footer */}
        <View style={styles.footer}>
          <BrandMark size="sm" />
          <Text variant="caption" color={colors.textMuted} align="center">
            Version {Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
          <Text variant="caption" color={colors.textDisabled} align="center">
            bb.q Chicken South Africa
          </Text>
        </View>
      </Screen>

      <StickyCartBar offsetBottom={TAB_BAR_HEIGHT} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundAlt },
  content: { paddingHorizontal: spacing.gutter, gap: spacing.xl },
  profileCard: { gap: spacing.sm },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  profileBody: { flex: 1, gap: spacing.xxs },
  profileBadge: { marginTop: spacing.xs },
  guestActions: { gap: spacing.sm, marginTop: spacing.sm },
  group: { gap: spacing.sm },
  groupTitle: { paddingHorizontal: spacing.xs },
  groupCard: { paddingHorizontal: spacing.lg },
  unreadDot: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  signOut: { marginTop: spacing.sm },
  footer: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
});
