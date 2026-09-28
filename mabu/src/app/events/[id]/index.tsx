import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AvailabilityChip } from '@/components/mabu/TimeSlotGrid';
import { ExperienceBadge } from '@/components/mabu/Menu';
import {
  BrassRule,
  Card,
  ErrorState,
  Header,
  IconButton,
  LoadingBlock,
  Photo,
  PremiumButton,
  Screen,
  SectionTitle,
  Text,
} from '@/components/ui';
import { formatDateLong, formatRand, formatTime } from '@/domain/shared/format';
import { errorMessage } from '@/services/api';
import { useRpc } from '@/services/queries';
import { colors, spacing } from '@/theme';
import { track } from '@/utils/analytics';
import { addToCalendar } from '@/utils/calendar';
import { shareText } from '@/utils/linking';

/** §11 Event detail: hero, when, where, price, availability, experience, share and calendar. */
export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const q = useRpc('events.get', { id });
  useEffect(() => track('event_viewed', { id }), [id]);

  if (q.isPending)
    return (
      <Screen header={<Header title="" />}>
        <LoadingBlock />
      </Screen>
    );
  if (q.isError)
    return (
      <Screen header={<Header title="" />}>
        <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
      </Screen>
    );
  const e = q.data;
  const price =
    e.priceCents === null ? 'Price on request' : `${formatRand(e.priceCents)} per guest`;
  const left = e.capacity - e.seatsBooked;
  const bookable = e.availability !== 'past' && e.availability !== 'sold-out';

  return (
    <Screen
      padded={false}
      topInset={false}
      header={
        <Header
          transparent
          right={
            <IconButton
              icon="share"
              label="Share this event"
              onPhoto
              onPress={() =>
                void shareText(
                  e.title,
                  `${e.title} at Mábu — ${formatDateLong(e.startsAt)}, ${formatTime(e.startsAt)}. ${price}.`,
                )
              }
            />
          }
        />
      }
      footer={
        bookable ? (
          <PremiumButton
            label={e.availability === 'waitlist' ? 'Join the waitlist' : 'Reserve the experience'}
            onPress={() => router.push(`/events/${e.id}/book`)}
            testID="event-reserve"
          />
        ) : undefined
      }
    >
      <Photo
        photo={e.heroPhoto}
        label={e.title}
        style={{ width, height: width * 1.0 }}
        scrim="bottom"
      />
      <View style={styles.body}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <AvailabilityChip state={e.availability} />
          {e.isSample ? <ExperienceBadge label="Sample event" tone="muted" /> : null}
        </View>
        <Text variant="h1" accessibilityRole="header">
          {e.title}
        </Text>
        <Text variant="quote" color="textMuted">
          {e.subtitle}
        </Text>
        <BrassRule />

        <Card style={{ gap: spacing.md }}>
          <Fact
            label="When"
            value={`${formatDateLong(e.startsAt)}\n${formatTime(e.startsAt)} – ${formatTime(e.endsAt)}`}
          />
          <Fact label="Where" value={e.room} />
          <Fact label="Price" value={price} accent />
          {e.availability === 'limited' ? <Fact label="Places" value={`${left} left`} /> : null}
          {e.winePartner ? <Fact label="Wine partner" value={e.winePartner} /> : null}
          {e.dressCode ? <Fact label="Dress" value={e.dressCode} /> : null}
          {e.ageRule ? <Fact label="Age" value={e.ageRule} /> : null}
        </Card>

        <Text variant="body" color="textMuted">
          {e.description}
        </Text>

        {e.menuTeaser?.length ? (
          <>
            <SectionTitle eyebrow="A taste of the evening" title="Menu" />
            <View style={{ gap: spacing.sm, alignItems: 'center' }}>
              {e.menuTeaser.map((m, i) => (
                <View key={m} style={{ alignItems: 'center', gap: spacing.sm }}>
                  {i ? <View style={styles.dot} /> : null}
                  <Text variant="title" align="center">
                    {m}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {e.availability !== 'past' ? (
          <PremiumButton
            label="Add to calendar"
            icon="calendar"
            variant="secondary"
            style={{ marginTop: spacing.xl }}
            onPress={() =>
              void addToCalendar({
                title: `${e.title} · Mábu`,
                startsAt: e.startsAt,
                endsAt: e.endsAt,
                location: e.room,
                notes: e.subtitle,
              })
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}

function Fact({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Text variant="eyebrow" color="textMuted" style={{ width: 100 }}>
        {label}
      </Text>
      <Text variant="body" color={accent ? 'accent' : 'text'} style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.gutter, gap: spacing.lg, marginTop: -spacing.xxl },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
});
