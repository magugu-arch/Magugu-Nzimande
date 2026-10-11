import { ScrollView, Share, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AssetImage } from '@/components/AssetImage';
import { Button } from '@/components/Button';
import { Group, Row } from '@/components/List';
import { PressableScale } from '@/components/PressableScale';
import { ProductCard } from '@/components/ProductCard';
import { HeaderButton, Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/States';
import { Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { toast } from '@/components/Toast';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { isPast } from '@/domain/events';
import type { BrandEvent, Rsvp } from '@/domain/types';
import { addToCalendar } from '@/features/calendar';
import { useMarket, useProducts } from '@/features/catalogue';
import {
  eventStatus,
  inviteMessage,
  localStart,
  primaryLabel,
  rsvpLabel,
  useEvent,
  useEventDate,
} from '@/features/events';
import { providers } from '@/providers';
import { useEventsState } from '@/store/events';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useEvent(id);
  const { width } = useWindowDimensions();

  if (data.status === 'loading')
    return (
      <Screen title="">
        <LoadingSkeleton rows={1} />
      </Screen>
    );
  if (data.status === 'error')
    return (
      <Screen title="">
        <ErrorState onRetry={data.retry} />
      </Screen>
    );
  if (!data.data.event)
    return (
      <Screen title="Not found">
        <EmptyState
          icon="calendar-outline"
          title="This event isn’t listed"
          body="It may have been moved or cancelled. The events calendar has what’s on."
        />
      </Screen>
    );
  return (
    <EventDetail
      event={data.data.event}
      rsvp={data.data.rsvp}
      now={data.data.now}
      heroHeight={Math.min(width * 1.1, 560)}
    />
  );
}

function EventDetail({
  event,
  rsvp,
  now,
  heroHeight,
}: {
  event: BrandEvent;
  rsvp?: Rsvp;
  now: Date;
  heroHeight: number;
}) {
  const { colors } = useTheme();
  const market = useMarket();
  const dateLabel = useEventDate();
  const products = useProducts();
  const reminder = useEventsState((s) => !!s.reminders[event.id]);
  const toggleReminder = useEventsState((s) => s.toggleReminder);
  const bump = useEventsState((s) => s.bump);
  const past = isPast(event, now);
  const status = eventStatus(event, now);
  const mine = rsvp ? rsvpLabel(rsvp) : null;
  const local = localStart(event, market.locale);
  const date = dateLabel(event);
  const edit = (products.data ?? []).filter((p) => event.productIds.includes(p.id));

  const invite = () => void Share.share({ message: inviteMessage(event, date) });

  const release = async () => {
    if (!rsvp) return;
    const before = rsvp;
    await providers.events.cancelRsvp(event.id);
    bump();
    toast({
      message: before.status === 'going' ? 'Your place is released' : 'You’ve left the waitlist',
      icon: 'calendar-outline',
      offset: 'action-bar',
      action: {
        label: 'Undo',
        run: async () => {
          const again = await providers.events.rsvp(
            {
              eventId: event.id,
              guests: before.guests,
              name: '',
              email: '',
              updates: before.updates,
            },
            `undo-${before.reference}-${Date.now()}`,
          );
          bump();
          if (again.status !== before.status)
            toast({
              message: 'The evening filled up — you’re on the waitlist',
              icon: 'time-outline',
            });
        },
      },
    });
  };

  const onPrimary = () => {
    if (rsvp?.status === 'requested') {
      toast({
        message: 'MAXHOSA replies to invitation requests by email (demo).',
        icon: 'shield-outline',
        offset: 'action-bar',
      });
    } else if (rsvp) {
      void addToCalendar(event);
    } else {
      router.push({ pathname: '/rsvp/[id]', params: { id: event.id } });
    }
  };

  return (
    <Screen
      title={event.title}
      hero={
        <AssetImage assetId={event.heroAssetId} style={StyleSheet.absoluteFill} priority="high" />
      }
      heroHeight={heroHeight}
      right={<HeaderButton icon="share-outline" label="Invite a friend" onMedia onPress={invite} />}
      actionBar={
        past ? undefined : <Button label={primaryLabel(event, rsvp)} onPress={onPrimary} />
      }
    >
      <View style={styles.head}>
        <Text variant="eyebrow" color="ink3">
          {event.sample ? 'Sample event · ' : ''}
          {event.kindLabel}
        </Text>
        <Text variant="display" accessibilityRole="header">
          {event.title}
        </Text>
        <View style={styles.tags}>
          <Tag label={status.label} tone={status.tone} icon={status.icon} />
          {mine ? <Tag label={mine.label} tone={mine.tone} /> : null}
        </View>
      </View>

      <Group>
        <Row
          first
          icon="calendar-outline"
          title={date}
          subtitle={local ? `Starts ${local} where you are` : undefined}
          end={
            past ? undefined : (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Add ${event.title} to your calendar`}
                onPress={() => void addToCalendar(event)}
                hitSlop={8}
              >
                <Text variant="subhead" weight="600" color="ink2" style={styles.link}>
                  Add to calendar
                </Text>
              </PressableScale>
            )
          }
        />
        <Row
          icon={
            event.city === 'Online'
              ? 'videocam-outline'
              : event.kind === 'popup'
                ? 'storefront-outline'
                : 'location-outline'
          }
          title={event.city === 'Online' ? 'Online' : `${event.city} · ${event.place}`}
          subtitle={
            event.city === 'Online'
              ? 'The link is sent to confirmed guests'
              : event.kind === 'popup'
                ? 'A temporary pop-up, not a permanent store · address shared on the day'
                : 'The venue is shared with confirmed guests'
          }
        />
        {!past ? (
          <Row
            icon="notifications-outline"
            title="Remind me the day before"
            subtitle={
              providers.events.isMock
                ? 'Demo — nothing is scheduled'
                : 'A notification on this phone'
            }
            end={
              <Switch
                value={reminder}
                onValueChange={() => toggleReminder(event.id)}
                trackColor={{ true: colors.green, false: colors.hairlineStrong }}
                accessibilityLabel="Remind me the day before"
              />
            }
          />
        ) : null}
      </Group>

      <View style={styles.prose}>
        <Text variant="body" color="ink2">
          {event.summary}
        </Text>
        {event.sample ? (
          <Text variant="footnote" color="ink3">
            Sample event for the concept demo — the title, date, place and capacity are
            illustrative.
          </Text>
        ) : null}
      </View>

      {edit.length ? (
        <View style={{ paddingTop: space.xl }}>
          <View style={styles.sectionHead}>
            <Text variant="heading" accessibilityRole="header">
              {past ? 'Shop the looks from the day' : 'The event edit'}
            </Text>
            <Tag label="Curated · sample" tone="sample" />
          </View>
          <Text variant="footnote" color="ink3" style={styles.sectionNote}>
            {past
              ? 'Photos from the day appear here once MAXHOSA publishes them.'
              : 'Pieces chosen for the evening — wear them on the night.'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {edit.map((p) => (
              <ProductCard key={p.id} product={p} width={180} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {!past ? (
        <View style={styles.actions}>
          <Button
            label="Invite a friend"
            icon="share-outline"
            variant="secondary"
            onPress={invite}
          />
          {rsvp && rsvp.status !== 'requested' ? (
            <Button
              label={
                rsvp.status === 'going' ? 'Can’t make it? Release your place' : 'Leave the waitlist'
              }
              variant="secondary"
              onPress={() => void release()}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: space.gutter,
    paddingTop: space.xl,
    paddingBottom: space.l,
    gap: space.s,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  link: { textDecorationLine: 'underline' },
  prose: { paddingHorizontal: space.gutter, paddingTop: space.l, gap: space.s },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.gutter,
  },
  sectionNote: { paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.m },
  rail: { paddingHorizontal: space.gutter, gap: space.m },
  actions: { paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.s },
});
