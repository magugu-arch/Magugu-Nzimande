import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { AssetImage } from '@/components/AssetImage';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DeliveryStatusTimeline } from '@/components/delivery/Timeline';
import {
  ExceptionRecoveryCard,
  type RecoveryAction,
} from '@/components/delivery/ExceptionRecoveryCard';
import { StatusCard } from '@/components/delivery/StatusCard';
import { TrackingMap } from '@/components/delivery/TrackingMap';
import { Group, GroupTitle, Row } from '@/components/List';
import { Screen } from '@/components/Screen';
import { LoadingSkeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { toast } from '@/components/Toast';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { canChangeDelivery, stageIndex, trackingView } from '@/domain/delivery';
import type { DeliveryExceptionKind, DeliveryTracking } from '@/domain/types';
import { useAsync } from '@/features/async';
import { useProducts } from '@/features/catalogue';
import { useTimeFormat } from '@/features/time';
import { useTracking } from '@/features/tracking';
import { providers } from '@/providers';

/**
 * The delivery tracker. It shows only what the commerce platform and courier
 * have confirmed: a timeline, an attributed estimate or an honest absence, a
 * map only for a same-day courier that sends positions, and for every problem
 * a way forward.
 */
export default function Tracker() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tracking } = useTracking(id);
  const order = useAsync(() => providers.commerce.getOrder(id), [id]);
  const products = useProducts();
  const formatTime = useTimeFormat();
  const { colors } = useTheme();

  if (!tracking) {
    return (
      <Screen title={`Order ${id}`}>
        <LoadingSkeleton rows={1} />
      </Screen>
    );
  }
  const view = trackingView(tracking, formatTime);

  const recover = (a: RecoveryAction) => {
    if (a === 'safe-place') router.push({ pathname: '/delivery-preferences/[id]', params: { id } });
    else if (a === 'courier-page')
      toast({
        message:
          'Courier pages need internet and a real tracking reference — this demo has neither.',
        icon: 'open-outline',
        offset: 'none',
      });
    else
      toast({
        message: 'Demo — client care and courier requests aren’t connected yet.',
        icon: 'information-circle-outline',
        offset: 'none',
      });
  };

  return (
    <Screen title={`Order ${id}`}>
      <View style={{ paddingTop: space.s }}>
        <StatusCard
          view={view}
          eyebrow={`${tracking.serviceLevel} · simulated`}
          updated={
            formatTime(view.updatedAt) +
            (view.map.show && view.map.stale ? ' · location may be out of date' : '')
          }
        />
      </View>

      {view.exception ? <ExceptionRecoveryCard kind={view.exception} onAction={recover} /> : null}
      {view.unreviewedUpdate ? (
        <Note icon="information-circle-outline">
          The courier sent an update we haven’t reviewed yet, so it isn’t shown as a status. Your
          last confirmed status is “{view.title}”.
        </Note>
      ) : null}

      {view.map.show && tracking.courier ? (
        <TrackingMap
          courier={tracking.courier}
          stale={view.map.stale}
          updatedLabel={
            view.map.stale
              ? 'Last position 18 min ago'
              : `Updated ${formatTime(tracking.courier.updatedAt)}`
          }
        />
      ) : !view.map.show && view.stage >= 3 && view.stage < 6 ? (
        <Note icon="location-outline">
          {view.map.note} Each scan from the courier appears below as it happens.
        </Note>
      ) : null}

      <GroupTitle>Progress</GroupTitle>
      <DeliveryStatusTimeline events={tracking.events} stage={view.stage} formatTime={formatTime} />

      <GroupTitle>Details</GroupTitle>
      <Group>
        {order.data?.lines.map((l, i) => {
          const p = products.data?.find((x) => x.id === l.productId);
          return (
            <Row
              key={l.variantId}
              first={i === 0}
              title={p?.name ?? l.productId}
              subtitle={`Size ${l.size} · Qty ${l.quantity}`}
              leading={
                p ? (
                  <View style={{ width: 44 }}>
                    <AssetImage
                      assetId={p.media[0]!.assetId}
                      decorative
                      style={{ aspectRatio: 4 / 5, borderRadius: 6 }}
                    />
                  </View>
                ) : null
              }
            />
          );
        })}
        <Row title={tracking.carrier} subtitle="Courier" />
        <Row title={view.trackingReference} subtitle="Tracking reference" />
        <Row title={tracking.serviceLevel} subtitle="Delivery method" />
      </Group>

      <GroupTitle>Help with this delivery</GroupTitle>
      <Group>
        {tracking.mode === 'local' && view.map.show ? (
          <Row
            first
            icon="chatbubbles-outline"
            title="Contact the courier"
            subtitle="Through a masked relay — demo"
            onPress={() =>
              toast({
                message:
                  'Demo — no call or message is placed. The app would use the courier’s masked relay.',
                icon: 'call-outline',
                offset: 'none',
              })
            }
          />
        ) : null}
        <Row
          first={!(tracking.mode === 'local' && view.map.show)}
          icon="location-outline"
          title="Delivery preferences"
          subtitle={
            canChangeDelivery(tracking)
              ? 'Safe place, reception or instructions'
              : 'Closed — the courier is on the way'
          }
          onPress={() => router.push({ pathname: '/delivery-preferences/[id]', params: { id } })}
        />
        <Row
          icon="help-circle-outline"
          title="Client care"
          subtitle="Questions about this order"
          onPress={() => recover('client-care')}
        />
      </Group>

      {providers.demoDelivery ? (
        <PresenterControls
          orderId={id}
          tracking={tracking}
          stale={view.map.show && view.map.stale}
        />
      ) : null}
      <View style={{ height: space.l, backgroundColor: colors.paper }} />
    </Screen>
  );
}

function Note({
  icon,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
      <Ionicons name={icon} size={20} color={colors.ink2} />
      <Text variant="subhead" color="ink2" style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

const PROBLEMS: [DeliveryExceptionKind | 'none', string][] = [
  ['none', 'None'],
  ['delayed', 'Delay'],
  ['address_issue', 'Address issue'],
  ['delivery_attempted', 'Missed delivery'],
  ['customs_hold', 'Customs hold'],
];

/** Demo-only: exists because the provider is the simulator, and says so. */
function PresenterControls({
  orderId,
  tracking,
  stale,
}: {
  orderId: string;
  tracking: DeliveryTracking;
  stale: boolean;
}) {
  const { colors } = useTheme();
  const demo = providers.demoDelivery!;
  const stage = stageIndex(tracking);
  const current = tracking.exception ?? 'none';
  return (
    <View style={[styles.presenter, { borderColor: colors.hairlineStrong }]}>
      <Text variant="headline">Presenter controls</Text>
      <Text variant="footnote" color="ink3">
        Simulated courier data for demonstrations. The production tracker shows only what the
        commerce platform and courier confirm.
      </Text>
      <Button
        label="Advance demo status"
        icon="arrow-forward"
        disabled={stage >= 6}
        onPress={() => {
          demo.advance(orderId);
          void Haptics.selectionAsync();
        }}
      />
      <Text variant="caption" weight="700" color="ink3">
        Delivery type
      </Text>
      <View style={styles.chips}>
        <Chip
          kind="radio"
          label="Standard parcel"
          selected={tracking.mode === 'parcel'}
          onPress={() => demo.setMode(orderId, 'parcel')}
        />
        <Chip
          kind="radio"
          label="Same-day courier"
          selected={tracking.mode === 'local'}
          onPress={() => demo.setMode(orderId, 'local')}
        />
      </View>
      <Text variant="caption" weight="700" color="ink3">
        Simulate a problem
      </Text>
      <View style={styles.chips}>
        {PROBLEMS.map(([k, label]) => (
          <Chip
            key={k}
            kind="radio"
            label={label}
            selected={current === k}
            onPress={() => demo.setException(orderId, k === 'none' ? null : k)}
          />
        ))}
      </View>
      <Text variant="caption" weight="700" color="ink3">
        Data quality
      </Text>
      <View style={styles.chips}>
        <Chip
          label="Stale location"
          selected={stale}
          onPress={() => demo.setStale(orderId, !stale)}
        />
        <Chip
          label="Unrecognised courier event"
          selected={false}
          onPress={() => demo.injectUnknownEvent(orderId)}
        />
      </View>
      <Button
        label="Restart this order’s timeline"
        variant="secondary"
        icon="refresh"
        onPress={() => demo.reset(orderId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    gap: space.m,
    marginHorizontal: space.gutter,
    marginTop: space.l,
    padding: space.l,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
  },
  presenter: {
    marginHorizontal: space.gutter,
    marginTop: space.xxl,
    padding: space.l,
    borderRadius: radius.m,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: space.m,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
});
