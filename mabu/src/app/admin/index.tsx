import { View } from 'react-native';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { AdminScreen, Tile, TileRow } from '@/components/admin/Admin';
import {
  InlineNotice,
  ListRow,
  LoadingBlock,
  PremiumButton,
  SectionTitle,
  Text,
} from '@/components/ui';
import { formatCalendarDate, formatRand } from '@/domain/shared/format';
import { venueDate } from '@/domain/shared/time';
import { config } from '@/services/config';
import { resetMockData } from '@/services/mockServer';
import { useRpc, useRpcMutation } from '@/services/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

type Link = { icon: keyof typeof Feather.glyphMap; label: string; href: string; admin?: boolean };

const LINKS: Link[] = [
  { icon: 'calendar', label: 'Reservations', href: '/admin/reservations' },
  { icon: 'star', label: 'Events & check-in', href: '/admin/events' },
  { icon: 'gift', label: 'Vouchers & reward codes', href: '/admin/vouchers' },
  { icon: 'users', label: 'Guest CRM', href: '/admin/guests' },
  { icon: 'send', label: 'Message log', href: '/admin/messages' },
  { icon: 'sliders', label: 'Booking policy', href: '/admin/policy', admin: true },
  { icon: 'award', label: 'Rewards programme', href: '/admin/rewards', admin: true },
  { icon: 'file-text', label: 'Notification templates', href: '/admin/templates', admin: true },
  { icon: 'radio', label: 'Campaigns', href: '/admin/campaigns', admin: true },
  { icon: 'book-open', label: 'Menu & wine CMS', href: '/admin/menu', admin: true },
  { icon: 'credit-card', label: 'Payment reconciliation', href: '/admin/payments', admin: true },
  { icon: 'shield', label: 'Audit log', href: '/admin/audit', admin: true },
];

/** §18 Admin dashboard: today at a glance, and the way into each tool. */
export default function AdminHome() {
  const role = useSession((s) => s.actor?.role);
  const client = useQueryClient();
  const today = venueDate(new Date());
  const q = useRpc(
    'admin.dashboard',
    { date: today },
    { enabled: role === 'admin' || role === 'staff' },
  );
  const jobs = useRpcMutation('admin.jobs.run', ['admin.dashboard']);
  const d = q.data;

  return (
    <AdminScreen title="Restaurant">
      <Text variant="eyebrow" color="accent" style={{ marginTop: spacing.lg }}>
        {formatCalendarDate(today)}
      </Text>
      <Text variant="h1" accessibilityRole="header">
        Today at Mábu
      </Text>
      {!d ? (
        <LoadingBlock />
      ) : (
        <>
          <TileRow>
            <Tile label="Bookings today" value={d.reservationsToday} />
            <Tile label="Covers today" value={d.coversToday} />
            <Tile label="Visits completed" value={d.completedToday} />
            <Tile label="On the waitlist" value={d.waitlistWaiting} />
            <Tile label="Rewards members" value={d.rewardsMembers} />
            <Tile label="Voucher sales" value={formatRand(d.vouchers.soldCents)} />
          </TileRow>
          {d.pendingPayments || d.failedDeliveries ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              {d.pendingPayments ? (
                <InlineNotice tone="warning">{`${d.pendingPayments} payment(s) awaiting reconciliation.`}</InlineNotice>
              ) : null}
              {d.failedDeliveries ? (
                <InlineNotice tone="danger">{`${d.failedDeliveries} notification deliveries failed after retries.`}</InlineNotice>
              ) : null}
            </View>
          ) : null}

          <SectionTitle eyebrow="Events" title="Occupancy" />
          {d.events.map((e) => (
            <View key={e.id} style={{ gap: spacing.xs, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodySmall" style={{ flex: 1 }}>
                  {e.title}
                </Text>
                <Text variant="bodySmall" color="textMuted">
                  {e.seatsBooked}/{e.capacity}
                </Text>
              </View>
              <View style={{ height: 3, backgroundColor: colors.borderStrong }}>
                <View
                  style={{
                    height: 3,
                    width: `${Math.min(100, Math.round((e.seatsBooked / e.capacity) * 100))}%`,
                    backgroundColor: colors.accent,
                  }}
                />
              </View>
            </View>
          ))}

          <SectionTitle eyebrow="Last 30 days" title="Conversion" />
          <TileRow>
            <Tile label="Bookings started" value={d.conversion.bookingStarted} />
            <Tile label="Availability checks" value={d.conversion.availabilityChecked} />
            <Tile label="Bookings made" value={d.conversion.bookingCreated} />
            <Tile
              label="Voucher checkouts"
              value={`${d.conversion.voucherCompleted}/${d.conversion.voucherStarted}`}
            />
            <Tile
              label="Event checkouts"
              value={`${d.conversion.eventCompleted}/${d.conversion.eventStarted}`}
            />
            <Tile label="Sent from guests' devices" value={d.conversion.fromDevices} />
          </TileRow>
        </>
      )}

      <SectionTitle title="Tools" />
      {LINKS.filter((l) => !l.admin || role === 'admin').map((l) => (
        <ListRow
          key={l.href}
          icon={<Feather name={l.icon} size={19} color={colors.accent} />}
          label={l.label}
          onPress={() => router.push(l.href as never)}
        />
      ))}

      {role === 'admin' ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <PremiumButton
            label="Run scheduled jobs now"
            variant="secondary"
            loading={jobs.isPending}
            onPress={() => jobs.mutate(undefined)}
          />
          {jobs.data ? (
            <Text variant="caption" color="textMuted">
              {Object.entries(jobs.data)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </Text>
          ) : null}
          {config.useMockApi ? (
            <PremiumButton
              label="Reset demo data"
              variant="ghost"
              onPress={async () => {
                await resetMockData();
                useSession.getState().signOut();
                client.clear();
                router.replace('/home');
              }}
            />
          ) : null}
        </View>
      ) : null}
    </AdminScreen>
  );
}
