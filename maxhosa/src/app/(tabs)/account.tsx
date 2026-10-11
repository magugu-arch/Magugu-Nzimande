import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { BagButton } from '@/components/HeaderActions';
import { Group, GroupTitle, Row } from '@/components/List';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { toast } from '@/components/Toast';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { useMarket, useOrders } from '@/features/catalogue';
import { useEvents } from '@/features/events';
import { openOfficialSite } from '@/features/links';
import { usePrefs } from '@/store/prefs';

export default function Account() {
  const { colors } = useTheme();
  const market = useMarket();
  const orders = useOrders();
  const events = useEvents();
  const rsvps = events.data?.rsvps.length ?? 0;
  const sizes = usePrefs((s) => s.sizes);
  const notifications = usePrefs((s) => s.notifications);
  const appearance = usePrefs((s) => s.appearance);
  const setAppearance = usePrefs((s) => s.setAppearance);
  const on = Object.values(notifications).filter((n) => n.enabled).length;

  return (
    <Screen title="Account" largeTitle inTabs right={<BagButton />}>
      <Group>
        <View style={styles.guest}>
          <Text variant="headline">Browsing as a guest</Text>
          <Text variant="footnote" color="ink3">
            Accounts use MAXHOSA AFRICA’s customer-account provider (OAuth with PKCE, tokens in the
            Keychain or Keystore), which isn’t connected in this demo. Guest checkout stays
            available.
          </Text>
          <Button
            label="Sign in"
            variant="secondary"
            onPress={() =>
              toast({ message: 'Sign-in isn’t connected in this demo.', icon: 'person-outline' })
            }
            style={{ alignSelf: 'flex-start', marginTop: space.s }}
          />
        </View>
      </Group>

      <GroupTitle>Orders and bookings</GroupTitle>
      <Group>
        <Row
          first
          icon="cube-outline"
          title="Orders"
          subtitle={
            orders.data
              ? `${orders.data.length} sample ${orders.data.length === 1 ? 'order' : 'orders'}`
              : 'Loading…'
          }
          onPress={() => router.push('/orders')}
        />
        <Row
          icon="calendar-outline"
          title="Styling appointments"
          subtitle="Request a time with a stylist"
          onPress={() => router.push('/appointment')}
        />
        <Row
          icon="sparkles-outline"
          title="My events"
          subtitle={
            rsvps
              ? `${rsvps} ${rsvps === 1 ? 'RSVP' : 'RSVPs'}${events.data?.list[0]?.sample ? ' (demo)' : ''}`
              : 'RSVPs, invitations and reminders'
          }
          onPress={() => router.push('/my-events')}
        />
      </Group>

      <GroupTitle>Shopping</GroupTitle>
      <Group>
        <Row
          first
          icon="globe-outline"
          title="Market and currency"
          subtitle={`${market.label} · ${market.currencyCode}`}
          onPress={() => router.push('/market')}
        />
        <Row
          icon="resize-outline"
          title="Sizes and preferences"
          subtitle={
            sizes.length ? sizes.join(', ') : 'Optional — marks your sizes, never chooses them'
          }
          onPress={() => router.push('/market?section=sizes')}
        />
        <Row
          icon="notifications-outline"
          title="Notifications"
          subtitle={on ? `${on} of 3 on` : 'All off'}
          onPress={() => router.push('/notifications')}
        />
      </Group>

      <GroupTitle>Help</GroupTitle>
      <Group>
        <Row
          first
          icon="help-circle-outline"
          title="Policies, FAQs and client care"
          subtitle="On maxhosa.africa · needs internet"
          external
          onPress={openOfficialSite}
        />
        <Row
          icon="storefront-outline"
          title="Stores"
          subtitle="Verified locations load from MAXHOSA"
          onPress={() =>
            toast({
              message: 'Store details appear only from verified location data — not in this demo.',
              icon: 'storefront-outline',
            })
          }
        />
      </Group>

      <GroupTitle>Appearance</GroupTitle>
      <Group>
        <View
          style={styles.segmentRow}
          accessibilityRole="radiogroup"
          accessibilityLabel="Appearance"
        >
          {(['system', 'light', 'dark'] as const).map((a) => (
            <PressableScale
              key={a}
              accessibilityRole="radio"
              accessibilityState={{ checked: appearance === a }}
              onPress={() => setAppearance(a)}
              style={[
                styles.segment,
                appearance === a && {
                  backgroundColor: colors.card,
                  borderColor: colors.hairlineStrong,
                },
              ]}
            >
              <Text variant="subhead" weight="600" color={appearance === a ? 'ink' : 'ink2'}>
                {a === 'system' ? 'System' : a === 'light' ? 'Light' : 'Dark'}
              </Text>
            </PressableScale>
          ))}
        </View>
      </Group>

      <GroupTitle>This demo</GroupTitle>
      <Group>
        <Row
          first
          icon="information-circle-outline"
          title="What is real in this demo"
          subtitle="Sample data, simulated services"
          onPress={() => router.push('/about')}
        />
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  guest: { padding: space.l, gap: space.xs },
  segmentRow: { flexDirection: 'row', padding: space.s, gap: space.xs },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
