import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ReservationRow } from '@/components/mabu/Cards';
import {
  EmptyState,
  ErrorState,
  Header,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  Screen,
  Segmented,
  Text,
} from '@/components/ui';
import { formatCalendarDate, formatDateLong, formatRand, formatTime } from '@/domain/shared/format';
import { errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { colors, spacing } from '@/theme';

/** §16 My Bookings, My Events, and any waitlist places. */
export default function MyBookings() {
  const params = useLocalSearchParams<{ tab?: 'tables' | 'events' }>();
  const [tab, setTab] = useState<'tables' | 'events'>(params.tab ?? 'tables');
  const bookings = useRpc('booking.mine');
  const events = useRpc('events.mine');
  const waitlist = useRpc('waitlist.mine');
  const leave = useRpcMutation('waitlist.leave', ['waitlist.mine']);
  const cancelEvent = useRpcMutation('events.cancel', ['events.mine', 'events.list']);

  return (
    <Screen header={<Header title="My bookings" />}>
      <View style={{ marginTop: spacing.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'tables', label: 'Tables' },
            { value: 'events', label: 'Events' },
          ]}
        />
      </View>

      {tab === 'tables' ? (
        bookings.isPending ? (
          <LoadingBlock />
        ) : bookings.isError ? (
          <ErrorState
            message={errorMessage(bookings.error)}
            onRetry={() => void bookings.refetch()}
          />
        ) : (
          <>
            {waitlist.data?.map((w) => (
              <InlineNotice
                key={w.id}
                tone={w.status === 'matched' ? 'success' : 'info'}
                style={{ marginTop: spacing.lg }}
              >
                <View style={{ gap: spacing.sm }}>
                  <Text variant="bodySmall">
                    {w.status === 'matched' && w.matchedStartsAt
                      ? `A table for ${w.query.partySize} is free on ${formatDateLong(w.matchedStartsAt)} at ${formatTime(w.matchedStartsAt)}.`
                      : `Waitlist: table for ${w.query.partySize} on ${formatCalendarDate(w.query.date)}.`}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    {w.status === 'matched' ? (
                      <Pressable
                        onPress={() => router.push(`/book?waitlist=${w.id}`)}
                        accessibilityRole="button"
                      >
                        <Text variant="eyebrow" color="accent">
                          Reserve it
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => leave.mutate({ id: w.id })}
                      accessibilityRole="button"
                    >
                      <Text variant="eyebrow" color="textMuted">
                        Leave waitlist
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </InlineNotice>
            ))}
            {bookings.data.upcoming.length ? (
              <>
                <Text variant="eyebrow" color="accent" style={{ marginTop: spacing.xl }}>
                  Upcoming
                </Text>
                {bookings.data.upcoming.map((r) => (
                  <ReservationRow key={r.id} reservation={r} />
                ))}
              </>
            ) : (
              <EmptyState
                icon="calendar"
                title="No upcoming tables"
                action="Book your table"
                onAction={() => router.navigate('/book')}
              />
            )}
            {bookings.data.past.length ? (
              <>
                <Text variant="eyebrow" color="textMuted" style={{ marginTop: spacing.xxl }}>
                  Past
                </Text>
                {bookings.data.past.map((r) => (
                  <ReservationRow key={r.id} reservation={r} />
                ))}
              </>
            ) : null}
          </>
        )
      ) : events.isPending ? (
        <LoadingBlock />
      ) : events.isError ? (
        <ErrorState message={errorMessage(events.error)} onRetry={() => void events.refetch()} />
      ) : events.data.length ? (
        <View style={{ marginTop: spacing.lg }}>
          {events.data.map((b) => (
            <View
              key={b.id}
              style={{
                paddingVertical: spacing.lg,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.border,
                gap: spacing.xs,
              }}
            >
              <Pressable
                onPress={() => router.push(`/events/${b.eventId}`)}
                accessibilityRole="button"
              >
                <Text variant="title">{b.event.title}</Text>
              </Pressable>
              <Text variant="bodySmall" color="textMuted">
                {formatDateLong(b.event.startsAt)} · {formatTime(b.event.startsAt)} · {b.seats}{' '}
                {b.seats === 1 ? 'place' : 'places'}
                {b.amountCents ? ` · ${formatRand(b.amountCents)}` : ''}
              </Text>
              <Text variant="caption" color={b.status === 'confirmed' ? 'accent' : 'textMuted'}>
                {b.status === 'confirmed'
                  ? `Reserved · ${b.reference}`
                  : b.status === 'waitlisted'
                    ? 'On the waitlist'
                    : b.status === 'pending_payment'
                      ? 'Payment being confirmed'
                      : b.status === 'attended'
                        ? 'Attended'
                        : b.status}
              </Text>
              {b.status === 'confirmed' || b.status === 'waitlisted' ? (
                <PremiumButton
                  label={b.status === 'waitlisted' ? 'Leave waitlist' : 'Cancel'}
                  variant="ghost"
                  compact
                  style={{ alignSelf: 'flex-start' }}
                  loading={cancelEvent.isPending && cancelEvent.variables?.bookingId === b.id}
                  onPress={() => cancelEvent.mutate({ bookingId: b.id })}
                />
              ) : null}
            </View>
          ))}
          {cancelEvent.isError ? (
            <InlineNotice tone="danger">{errorMessage(cancelEvent.error)}</InlineNotice>
          ) : null}
        </View>
      ) : (
        <EmptyState
          icon="star"
          title="No events yet"
          body="Wine pairings, chef evenings and tasting menus."
          action="See what's on"
          onAction={() => router.navigate('/events')}
        />
      )}
    </Screen>
  );
}
