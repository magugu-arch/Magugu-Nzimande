import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { asPhotoKey } from '@/content/photos';
import { providers } from '@/core/adapters/registry';
import type { AppNotification } from '@/core/domain/models';
import { formatMoney, moneyAccessibilityLabel } from '@/core/domain/money';
import {
  formatCountdown,
  formatDayLong,
  formatDayShort,
  formatTime,
} from '@/core/time/sast';
import {
  useAccount,
  useArrivals,
  useCampusMap,
  useEvents,
  useFunding,
  useOrders,
  useShuttleRoutes,
  useStudentProfile,
  useTimetableToday,
} from '@/data/hooks';
import {
  Button,
  Card,
  Icon,
  Photo,
  Pill,
  Row,
  SectionHeader,
  Skeleton,
  Text,
  Touchable,
  colors,
  radius,
  spacing,
} from '@/design';
import { useQueryClient } from '@tanstack/react-query';
import { isOnNow, KIND_LABEL, nextClass, roomDescription } from '@/features/academics/timetable';
import { useNow } from '@/features/system/useNow';
import { useSession } from '@/state/session';

/** A compact failure inside a Home module: says what failed, offers a retry. */
export function ModuleError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <Card tone="sunken">
      <Row gap={spacing.md}>
        <Icon name="cloud-offline-outline" size={22} color={colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{what} didn’t load</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Everything else still works.
          </Text>
        </View>
        <Button label="Retry" size="md" variant="ghost" onPress={onRetry} />
      </Row>
    </Card>
  );
}

// ── Next class ──────────────────────────────────────────────────────────────

export function NextClassModule() {
  const router = useRouter();
  const now = useNow();
  const timetable = useTimetableToday();
  const map = useCampusMap();

  if (timetable.status === 'loading') {
    return (
      <Card tone="navy">
        <View style={{ gap: spacing.md }}>
          <Skeleton height={12} width="35%" />
          <Skeleton height={26} width="80%" />
          <Skeleton height={14} width="60%" />
        </View>
      </Card>
    );
  }
  if (timetable.status === 'error' || !timetable.data) {
    return <ModuleError what="Your timetable" onRetry={timetable.refetch} />;
  }

  const next = nextClass(timetable.data, now);
  if (!next) {
    return (
      <Card tone="navy" onPress={() => router.push('/academics/timetable')} accessibilityLabel="No more classes today. Open timetable." testID="next-class-none">
        <Text variant="overline" color={colors.yellow}>
          Today
        </Text>
        <Text variant="title2" color={colors.white}>
          No more classes today
        </Text>
        <Text variant="body" color={colors.textOnDarkMuted}>
          See the week ahead in your timetable.
        </Text>
      </Card>
    );
  }

  const building = map.data?.buildings.find((b) => b.id === next.room.buildingId);
  const onNow = isOnNow(next, now);
  const when = onNow ? 'On now' : `Next class · ${formatCountdown(next.start, now)}`;
  const where = roomDescription(next.room.code, building?.name, next.room.floor);
  const href = `/academics/class/${next.id}` as Href;

  return (
    <Card
      tone="navy"
      onPress={() => router.push(href)}
      accessibilityLabel={`${when}. ${next.moduleTitle}, ${next.moduleCode}, ${formatTime(next.start)} to ${formatTime(next.end)}, ${next.room.code}, ${where}.${next.note ? ` ${next.note}.` : ''}`}
      accessibilityHint="Opens class details and directions"
      testID="next-class-card"
    >
      <Row justify="space-between">
        <Text variant="overline" color={colors.yellow}>
          {when}
        </Text>
        {next.status === 'moved' ? <Pill label="Room changed" tone="yellow" icon="swap-horizontal" /> : null}
      </Row>
      <View style={styles.classTitle}>
        <Text variant="title1" color={colors.white}>
          {next.moduleTitle}
        </Text>
        <Text variant="body" color={colors.textOnDarkMuted}>
          {next.moduleCode} · {KIND_LABEL[next.kind]} · {formatTime(next.start)}–{formatTime(next.end)}
        </Text>
      </View>
      <View style={styles.classRoom}>
        <Icon name="location" size={18} color={colors.yellow} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" color={colors.white}>
            {next.room.code}
          </Text>
          <Text variant="caption" color={colors.textOnDarkMuted}>
            {where}
          </Text>
        </View>
      </View>
      <Row gap={spacing.sm} wrap style={{ marginTop: spacing.lg }}>
        <Button
          label="Show me the way"
          icon="navigate"
          variant="accent"
          size="md"
          onPress={() => router.push(`/campus-map?to=${next.room.code}`)}
          testID="next-class-directions"
        />
        <Button label="Details" variant="onDark" size="md" onPress={() => router.push(href)} />
      </Row>
    </Card>
  );
}

// ── Critical notice ─────────────────────────────────────────────────────────

export function CriticalNoticeModule({ notice }: { notice: AppNotification }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  const open = async () => {
    try {
      await providers.notifications.markRead(notice.id);
      void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    } catch {
      // Reading the action matters more than the read receipt.
    }
    if (notice.action) router.push(notice.action.href as Href);
  };
  return (
    <Touchable
      onPress={open}
      feedback="scale"
      accessibilityRole="button"
      accessibilityLabel={`Important: ${notice.title}. ${notice.body}${notice.action ? ` ${notice.action.label}.` : ''}`}
      style={styles.notice}
      testID="critical-notice"
    >
      <View style={styles.noticeBar} />
      <View style={styles.noticeIcon}>
        <Icon name={notice.category === 'money' ? 'cash' : 'alert'} size={20} color={colors.navy} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{notice.title}</Text>
        {notice.action ? (
          <Text variant="captionStrong" color={colors.navy2}>
            {notice.action.label} →
          </Text>
        ) : null}
      </View>
    </Touchable>
  );
}

// ── Money and shuttle (paired, compact) ─────────────────────────────────────

export function MoneyTile() {
  const router = useRouter();
  const account = useAccount();
  const funding = useFunding();
  if (account.status === 'loading') return <TileSkeleton />;
  if (!account.data) return <TileError label="Fees" onRetry={account.refetch} />;
  const a = account.data;
  const owing = a.balance.cents > 0;
  const delayed = funding.data?.status === 'delayed';
  return (
    <Card
      onPress={() => router.push('/money')}
      style={styles.tile}
      accessibilityLabel={`Fees. ${owing ? `${moneyAccessibilityLabel(a.balance)} owed${a.dueDate ? `, due ${formatDayLong(a.dueDate)}` : ''}` : 'Paid up'}.${delayed ? ' NSFAS allowance delayed.' : ''}`}
      testID="money-tile"
    >
      <Row gap={spacing.xs}>
        <Icon name="wallet-outline" size={18} color={colors.navy2} />
        <Text variant="overline" color={colors.textSecondary}>
          Fees
        </Text>
      </Row>
      <Text variant="metricSmall" style={{ marginTop: spacing.sm }}>
        {owing ? formatMoney(a.balance) : 'Paid up'}
      </Text>
      <Text variant="caption" color={colors.textSecondary}>
        {owing && a.dueDate ? `Due ${formatDayShort(a.dueDate)}` : 'Nothing owed'}
      </Text>
      {delayed ? (
        <View style={{ marginTop: spacing.sm }}>
          <Pill label="NSFAS delayed" tone="warning" />
        </View>
      ) : null}
    </Card>
  );
}

export function ShuttleTile() {
  const router = useRouter();
  const arrivals = useArrivals();
  const routes = useShuttleRoutes();
  if (arrivals.status === 'loading' || routes.status === 'loading') return <TileSkeleton />;
  if (!arrivals.data || !routes.data) return <TileError label="Shuttle" onRetry={arrivals.refetch} />;
  const next = arrivals.data.find((a) => a.live && a.stopId === 'stop-si');
  const route = routes.data.find((r) => r.id === next?.routeId);
  return (
    <Card
      onPress={() => router.push('/transport')}
      style={styles.tile}
      accessibilityLabel={
        next && route
          ? `Next shuttle: Route ${route.code} to ${route.stops[route.stops.length - 1]?.name}, ${next.etaMinutes} minutes, from Shuttle Interchange.`
          : 'No shuttles running now. Open shuttle times.'
      }
      testID="shuttle-tile"
    >
      <Row gap={spacing.xs}>
        <Icon name="bus-outline" size={18} color={colors.navy2} />
        <Text variant="overline" color={colors.textSecondary}>
          Shuttle
        </Text>
      </Row>
      {next && route ? (
        <>
          <Text variant="metricSmall" style={{ marginTop: spacing.sm }}>
            {next.etaMinutes} min
          </Text>
          <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
            Route {route.code} · {route.stops[route.stops.length - 1]?.name}
          </Text>
          {route.status === 'delayed' ? (
            <View style={{ marginTop: spacing.sm }}>
              <Pill label="Delayed" tone="warning" />
            </View>
          ) : (
            <View style={{ marginTop: spacing.sm }}>
              <Pill label="Live" tone="success" icon="radio-outline" />
            </View>
          )}
        </>
      ) : (
        <Text variant="bodyStrong" style={{ marginTop: spacing.sm }}>
          Not running now
        </Text>
      )}
    </Card>
  );
}

function TileSkeleton() {
  return (
    <Card style={styles.tile}>
      <View style={{ gap: spacing.sm }}>
        <Skeleton height={12} width="50%" />
        <Skeleton height={22} width="80%" />
        <Skeleton height={12} width="60%" />
      </View>
    </Card>
  );
}

function TileError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <Card tone="sunken" style={styles.tile} onPress={onRetry} accessibilityLabel={`${label} didn’t load. Tap to retry.`}>
      <Text variant="overline" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ marginTop: spacing.sm }}>
        Didn’t load
      </Text>
      <Text variant="captionStrong" color={colors.navy2}>
        Tap to retry
      </Text>
    </Card>
  );
}

// ── Rest of today ───────────────────────────────────────────────────────────

export function TodayModule() {
  const router = useRouter();
  const now = useNow();
  const timetable = useTimetableToday();
  if (!timetable.data) return null;
  const next = nextClass(timetable.data, now);
  const rest = timetable.data.filter((e) => new Date(e.end) > now && e.id !== next?.id);
  return (
    <View>
      <SectionHeader title="Rest of today" action="Week" onAction={() => router.push('/academics/timetable')} />
      {rest.length === 0 ? (
        <Card tone="sunken">
          <Text variant="body" color={colors.textSecondary}>
            Nothing else scheduled today.
          </Text>
        </Card>
      ) : (
        <Card padded={false}>
          {rest.map((e, i) => (
            <Touchable
              key={e.id}
              onPress={() => router.push(`/academics/class/${e.id}`)}
              accessibilityLabel={`${formatTime(e.start)}, ${e.moduleTitle}, ${e.room.code}`}
              style={[styles.todayRow, i > 0 ? styles.todayDivider : null]}
            >
              <Text variant="bodyStrong" style={styles.todayTime}>
                {formatTime(e.start)}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant="label">{e.moduleTitle}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {e.moduleCode} · {KIND_LABEL[e.kind]} · {e.room.code}
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textSecondary} />
            </Touchable>
          ))}
        </Card>
      )}
    </View>
  );
}

// ── Lunch (campus commerce) ─────────────────────────────────────────────────

export function LunchModule() {
  const router = useRouter();
  const orders = useOrders();
  const active = orders.data?.find((o) => o.status === 'placed' || o.status === 'preparing' || o.status === 'ready');
  if (active) {
    const ready = active.status === 'ready';
    return (
      <Card
        tone={ready ? 'yellow' : 'surface'}
        onPress={() => router.push(`/dining/order/${active.id}`)}
        accessibilityLabel={`Your order from ${active.vendorName} is ${ready ? 'ready for pickup' : 'being prepared'}. Pickup code ${active.pickupCode}.`}
        testID="lunch-active-order"
      >
        <Row gap={spacing.md}>
          <View style={styles.lunchIcon}>
            <Icon name={ready ? 'bag-check' : 'restaurant'} size={22} color={colors.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="overline" color={colors.navy}>
              {ready ? 'Ready for pickup' : 'Preparing your order'}
            </Text>
            <Text variant="title3">{active.vendorName}</Text>
            <Text variant="caption">
              Code {active.pickupCode} · {active.pickupPoint}
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.navy} />
        </Row>
      </Card>
    );
  }
  return (
    <Card padded={false} onPress={() => router.push('/dining')} accessibilityLabel="Lunch on campus. Order ahead from Campus Kitchen and skip the queue." testID="lunch-card">
      <Photo photo="cafeteria" size="md" rounded={false} style={styles.lunchPhoto} decorative />
      <View style={styles.lunchBody}>
        <Text variant="overline" color={colors.textSecondary}>
          Between classes
        </Text>
        <Text variant="title3">Order lunch ahead, skip the queue</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Campus Kitchen · ready in about 12 min
        </Text>
      </View>
    </Card>
  );
}

// ── Graduation ──────────────────────────────────────────────────────────────

export function GraduationModule() {
  const router = useRouter();
  const profile = useStudentProfile();
  const ceremony = profile.data?.graduation.ceremony;
  if (!ceremony) return null;
  return (
    <Card padded={false} onPress={() => router.push('/graduation')} accessibilityLabel={`Graduation, ${formatDayLong(ceremony)}. See what changes on the day.`} testID="graduation-card">
      <Photo photo="graduation" size="md" rounded={false} style={styles.gradPhoto} decorative />
      <View style={styles.lunchBody}>
        <Text variant="overline" color={colors.textSecondary}>
          Graduation · {formatDayLong(ceremony)}
        </Text>
        <Text variant="title3">You’re approved to graduate</Text>
        <Text variant="caption" color={colors.textSecondary}>
          See what happens to NMU ONE on the day →
        </Text>
      </View>
    </Card>
  );
}

// ── Discover ────────────────────────────────────────────────────────────────

export function DiscoverModule() {
  const router = useRouter();
  const events = useEvents();
  const now = useNow();
  const next = events.data?.find((e) => new Date(e.start) > now && e.ticketing !== 'open-entry') ?? events.data?.[0];
  if (events.status === 'loading') return <TileSkeleton />;
  if (!next) return null;
  return (
    <View>
      <SectionHeader title="Happening on campus" action="All events" onAction={() => router.push('/events')} />
      <Card padded={false} onPress={() => router.push(`/events/${next.id}`)} accessibilityLabel={`${next.title}. ${formatDayLong(next.start)} at ${formatTime(next.start)}, ${next.venue}.`} testID="discover-event">
        <Photo photo={asPhotoKey(next.photo, 'events')} size="md" rounded={false} style={styles.eventPhoto} decorative />
        <View style={styles.lunchBody}>
          <Text variant="overline" color={colors.textSecondary}>
            {formatDayShort(next.start)} · {formatTime(next.start)} · {next.venue}
          </Text>
          <Text variant="title3">{next.title}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {next.summary}
          </Text>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  classTitle: { marginTop: spacing.md, gap: spacing.xs },
  classRoom: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
    paddingLeft: spacing.lg + 4,
    overflow: 'hidden',
  },
  noticeBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: colors.yellow },
  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: { flex: 1, minHeight: 150 },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  todayDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  todayTime: { width: 52, fontVariant: ['tabular-nums'] },
  lunchIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(20,28,43,0.08)', alignItems: 'center', justifyContent: 'center' },
  lunchPhoto: { height: 150, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  gradPhoto: { height: 170, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  eventPhoto: { height: 170, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  lunchBody: { padding: spacing.lg, gap: spacing.xs },
});
