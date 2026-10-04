import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { asPhotoKey } from '@/content/photos';
import { providers } from '@/core/adapters/registry';
import { isAdapterError } from '@/core/adapters/errors';
import { formatMoney } from '@/core/domain/money';
import { formatDayLong, formatTime } from '@/core/time/sast';
import { useEvent, useTickets } from '@/data/hooks';
import {
  Button,
  Card,
  HeroBack,
  Icon,
  Notice,
  PhotoHero,
  QueryState,
  Row,
  Screen,
  Sheet,
  Text,
  colors,
  spacing,
} from '@/design';
import { useCan } from '@/features/access/access';
import { addToCalendar, calendarMessage } from '@/features/calendar/addToCalendar';
import { PaymentSheet } from '@/features/money/payment';
import { preferences, usePrefs } from '@/state/preferences';
import { useSession } from '@/state/session';
import { showToast } from '@/state/toasts';

/** Event detail with save, calendar, map and ticketing (brief §12, §26 steps 10–11). */
export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  const prefs = usePrefs(userId);
  const event = useEvent(id);
  const canBook = useCan('events.book');
  const tickets = useTickets();
  const [confirm, setConfirm] = useState(false);
  const [paying, setPaying] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = tickets.data?.find((t) => t.eventId === id && t.status === 'valid');
  const saved = prefs.savedEvents.includes(id);

  const issue = async (paymentId: string | null) => {
    setBooking(true);
    setError(null);
    try {
      const ticket = await providers.community.bookTicket(id, paymentId);
      void queryClient.invalidateQueries({ queryKey: ['tickets', userId] });
      void queryClient.invalidateQueries({ queryKey: ['event', id] });
      setConfirm(false);
      setPaying(false);
      router.push(`/events/ticket/${ticket.id}`);
    } catch (e) {
      setError(isAdapterError(e) && e.kind === 'conflict' ? 'This event has just sold out.' : 'Your ticket wasn’t issued. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <Screen padded={false} topInset={false} testID="event-detail">
      <QueryState query={event} what="this event">
        {(e) => (
          <>
            <PhotoHero photo={asPhotoKey(e.photo, 'events')} eyebrow={`${formatDayLong(e.start)} · ${formatTime(e.start)}`} title={e.title} height={300} topBar={<HeroBack fallbackHref="/events" />} />
            <View style={styles.body}>
              <Text variant="bodyLarge">{e.description}</Text>

              <Card>
                <Row gap={spacing.md} style={styles.fact}>
                  <Icon name="time-outline" size={20} color={colors.navy2} />
                  <Text variant="body">
                    {formatDayLong(e.start)}, {formatTime(e.start)}–{formatTime(e.end)}
                  </Text>
                </Row>
                <Row gap={spacing.md} style={styles.fact}>
                  <Icon name="location-outline" size={20} color={colors.navy2} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {e.venue}
                  </Text>
                </Row>
                <Row gap={spacing.md} style={styles.fact}>
                  <Icon name="people-outline" size={20} color={colors.navy2} />
                  <Text variant="body">
                    {e.organiser}
                    {e.ticketing !== 'open-entry' ? ` · ${e.spotsLeft} of ${e.capacity} places left` : ''}
                  </Text>
                </Row>
                <Row gap={spacing.md} style={styles.fact}>
                  <Icon name="ticket-outline" size={20} color={colors.navy2} />
                  <Text variant="body">{e.ticketing === 'open-entry' ? 'No ticket needed — just arrive' : e.price ? `${formatMoney(e.price)} per ticket` : 'Free, ticket required'}</Text>
                </Row>
              </Card>

              {error ? <Notice tone="danger" title="Ticket not issued" body={error} /> : null}

              {existing ? (
                <Button label="View your ticket" icon="ticket" variant="accent" fullWidth onPress={() => router.push(`/events/ticket/${existing.id}`)} testID="view-ticket" />
              ) : e.ticketing === 'open-entry' ? null : !canBook ? (
                <Notice tone="neutral" title="Tickets aren’t available to you here" body="Ticketing isn’t part of NMU ONE for your role." />
              ) : e.spotsLeft <= 0 ? (
                <Notice tone="neutral" title="Sold out" body="All tickets have been issued." />
              ) : (
                <Button
                  label={e.price ? `Buy ticket · ${formatMoney(e.price)}` : 'Get a free ticket'}
                  icon="ticket"
                  variant="accent"
                  fullWidth
                  onPress={() => (e.price ? setPaying(true) : setConfirm(true))}
                  testID="get-ticket"
                />
              )}

              <Row gap={spacing.sm} wrap>
                <Button
                  label={saved ? 'Saved' : 'Save'}
                  icon={saved ? 'bookmark' : 'bookmark-outline'}
                  variant="secondary"
                  size="md"
                  onPress={() => userId && preferences.toggleSavedEvent(userId, e.id)}
                  accessibilityHint={saved ? 'Removes this event from your saved list' : 'Keeps this event in your saved list'}
                />
                <Button
                  label="Add to calendar"
                  icon="calendar-outline"
                  variant="secondary"
                  size="md"
                  onPress={async () => {
                    const r = await addToCalendar({ title: e.title, start: e.start, end: e.end, location: e.venue, notes: e.summary });
                    showToast({ title: calendarMessage[r], tone: 'success' });
                  }}
                />
                {e.buildingId ? (
                  <Button label="Map" icon="map-outline" variant="secondary" size="md" onPress={() => router.push(`/campus-map?to=${e.buildingId!.toUpperCase()}`)} />
                ) : null}
              </Row>
            </View>

            <Sheet visible={confirm} onClose={() => setConfirm(false)} title="Get a free ticket?" testID="ticket-sheet">
              <Text variant="body">
                {e.title} · {formatDayLong(e.start)} at {formatTime(e.start)}. One ticket per person; show the QR code at the entrance.
              </Text>
              <Button label="Confirm my ticket" variant="accent" fullWidth loading={booking} onPress={() => issue(null)} testID="confirm-ticket" />
              <Button label="Cancel" variant="ghost" fullWidth onPress={() => setConfirm(false)} />
            </Sheet>

            {e.price ? (
              <PaymentSheet
                visible={paying}
                amount={e.price}
                purpose="ticket"
                description={`${e.title} · ${formatDayLong(e.start)}`}
                onClose={() => setPaying(false)}
                onPaid={async (_r, paymentId) => issue(paymentId)}
              />
            ) : null}
          </>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.gutter, gap: spacing.lg },
  fact: { paddingVertical: spacing.sm },
});
