import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { providers } from '@/core/adapters/registry';
import { isAdapterError } from '@/core/adapters/errors';
import type { StudySlot, StudySpace, StudySpaceBooking } from '@/core/domain/models';
import { formatDayLong, formatTime } from '@/core/time/sast';
import { useBookings, useLibrarySearch, useStudySpaces } from '@/data/hooks';
import {
  Button,
  Card,
  Header,
  Icon,
  ListRow,
  Notice,
  Photo,
  Pill,
  QueryState,
  Row,
  Screen,
  SearchField,
  Segmented,
  Sheet,
  StateView,
  Text,
  Touchable,
  colors,
  radius,
  spacing,
} from '@/design';
import { AccessDenied, useDecision } from '@/features/access/access';
import { addToCalendar, calendarMessage } from '@/features/calendar/addToCalendar';
import { useSession } from '@/state/session';
import { showToast } from '@/state/toasts';

type Tab = 'spaces' | 'search' | 'bookings';

/** Library (brief §9, §26 step 6): study-space availability and booking, search, saved bookings. */
export default function Library() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'spaces');
  const bookDecision = useDecision('library.book');

  return (
    <Screen header={<Header title="Library" />} testID="library">
      <View style={styles.hero}>
        <Photo photo="library" size="md" style={styles.heroPhoto} decorative />
        <View style={styles.heroText}>
          <Text variant="overline" color={colors.textSecondary}>
            Library & Learning Commons
          </Text>
          <Text variant="title1" accessibilityRole="header">
            Find a space. Find a source.
          </Text>
        </View>
      </View>
      <Segmented<Tab>
        label="Library sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'spaces', label: 'Study spaces' },
          { value: 'search', label: 'Search' },
          { value: 'bookings', label: 'My bookings' },
        ]}
      />
      <View style={styles.content}>
        {tab === 'search' ? (
          <SearchTab />
        ) : bookDecision && !bookDecision.allowed ? (
          <AccessDenied decision={bookDecision} capability="library.book" />
        ) : tab === 'spaces' ? (
          <SpacesTab />
        ) : (
          <BookingsTab />
        )}
      </View>
    </Screen>
  );
}

function SpacesTab() {
  const spaces = useStudySpaces();
  const queryClient = useQueryClient();
  const router = useRouter();
  const userId = useSession((s) => s.user?.id);
  const [pick, setPick] = useState<{ space: StudySpace; slot: StudySlot } | null>(null);
  const [state, setState] = useState<'confirm' | 'booking' | 'done' | 'conflict' | 'failed'>(
    'confirm',
  );
  const [booking, setBooking] = useState<StudySpaceBooking | null>(null);

  const book = async () => {
    if (!pick) return;
    setState('booking');
    try {
      const b = await providers.library.bookStudySpace({
        spaceId: pick.space.id,
        start: pick.slot.start,
        end: pick.slot.end,
      });
      setBooking(b);
      setState('done');
      void queryClient.invalidateQueries({ queryKey: ['study-spaces', userId] });
      void queryClient.invalidateQueries({ queryKey: ['bookings', userId] });
    } catch (e) {
      setState(isAdapterError(e) && e.kind === 'conflict' ? 'conflict' : 'failed');
      void queryClient.invalidateQueries({ queryKey: ['study-spaces', userId] });
    }
  };

  const close = () => {
    setPick(null);
    setState('confirm');
    setBooking(null);
  };

  return (
    <>
      <QueryState query={spaces} what="study spaces">
        {(list) => {
          const free = list.filter((s) => s.slots.some((sl) => sl.available));
          return (
            <View style={{ gap: spacing.md }}>
              <Text variant="body" color={colors.textSecondary}>
                {free.length
                  ? `${free.length} spaces have free slots today. Tap a time to book it.`
                  : 'Every space is booked for the rest of today.'}
              </Text>
              {list.map((space) => {
                const open = space.slots.filter((s) => s.available);
                return (
                  <Card key={space.id} testID={`space-${space.id}`}>
                    <Row justify="space-between" align="flex-start">
                      <View style={{ flex: 1 }}>
                        <Text variant="title3">{space.name}</Text>
                        <Text variant="caption" color={colors.textSecondary}>
                          Level {space.floor} · up to {space.capacity}{' '}
                          {space.capacity === 1 ? 'person' : 'people'} ·{' '}
                          {space.features.join(' · ')}
                        </Text>
                      </View>
                      <Pill
                        label={open.length ? `${open.length} free` : 'Full'}
                        tone={open.length ? 'success' : 'neutral'}
                      />
                    </Row>
                    {open.length ? (
                      <Row wrap gap={spacing.sm} style={{ marginTop: spacing.md }}>
                        {open.map((slot) => (
                          <Touchable
                            key={slot.start}
                            onPress={() => setPick({ space, slot })}
                            accessibilityLabel={`Book ${space.name} from ${formatTime(slot.start)} to ${formatTime(slot.end)}`}
                            style={styles.slot}
                            testID={`slot-${space.id}-${formatTime(slot.start).replace(':', '')}`}
                          >
                            <Text variant="captionStrong">{formatTime(slot.start)}</Text>
                          </Touchable>
                        ))}
                      </Row>
                    ) : (
                      <Text
                        variant="caption"
                        color={colors.textSecondary}
                        style={{ marginTop: spacing.sm }}
                      >
                        No free slots left today.
                      </Text>
                    )}
                  </Card>
                );
              })}
            </View>
          );
        }}
      </QueryState>

      <Sheet
        visible={!!pick}
        onClose={close}
        title={state === 'done' ? 'You’re booked' : 'Book this space?'}
        testID="booking-sheet"
      >
        {pick ? (
          state === 'done' && booking ? (
            <>
              <Notice
                tone="success"
                title={`${booking.spaceName}, ${formatTime(booking.start)}–${formatTime(booking.end)}`}
                body={`Reference ${booking.reference}. Show it at the Library desk if asked.`}
                testID="booking-confirmed"
              />
              <Button
                label="Add to calendar"
                icon="calendar-outline"
                variant="secondary"
                fullWidth
                onPress={async () => {
                  const r = await addToCalendar({
                    title: `Study space: ${booking.spaceName}`,
                    start: booking.start,
                    end: booking.end,
                    location: 'Library & Learning Commons',
                  });
                  showToast({ title: calendarMessage[r], tone: 'success' });
                }}
              />
              <Button
                label="Show on map"
                icon="map-outline"
                variant="ghost"
                fullWidth
                onPress={() => {
                  close();
                  router.push('/campus-map?to=LIB');
                }}
              />
              <Button
                label="Done"
                variant="primary"
                fullWidth
                onPress={close}
                testID="booking-done"
              />
            </>
          ) : (
            <>
              <Card tone="sunken">
                <Text variant="title3">{pick.space.name}</Text>
                <Text variant="body">
                  {formatDayLong(pick.slot.start)} · {formatTime(pick.slot.start)}–
                  {formatTime(pick.slot.end)}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  Library & Learning Commons, level {pick.space.floor}
                </Text>
              </Card>
              {state === 'conflict' ? (
                <Notice
                  tone="warning"
                  title="Someone just booked that slot"
                  body="The list has been refreshed — pick another time."
                />
              ) : null}
              {state === 'failed' ? (
                <Notice
                  tone="danger"
                  title="Booking didn’t go through"
                  body="Nothing was booked. Please try again."
                />
              ) : null}
              <Button
                label="Book this slot"
                variant="accent"
                fullWidth
                loading={state === 'booking'}
                disabled={state === 'conflict'}
                onPress={book}
                testID="booking-confirm"
              />
              <Button label="Cancel" variant="ghost" fullWidth onPress={close} />
            </>
          )
        ) : null}
      </Sheet>
    </>
  );
}

function SearchTab() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const results = useLibrarySearch(submitted);
  return (
    <View style={{ gap: spacing.md }}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => setSubmitted(query)}
        onClear={() => {
          setQuery('');
          setSubmitted('');
        }}
        label="Search books, journals and databases"
      />
      <QueryState
        query={results}
        what="search results"
        isEmpty={(r) => r.length === 0}
        empty={<StateView kind="empty" title="No matches" body="Try fewer or different words." />}
      >
        {(list) => (
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {list.map((r) => (
              <ListRow
                key={r.id}
                icon={
                  r.kind === 'book'
                    ? 'book-outline'
                    : r.kind === 'ebook'
                      ? 'tablet-portrait-outline'
                      : r.kind === 'journal'
                        ? 'newspaper-outline'
                        : 'server-outline'
                }
                title={r.title}
                subtitle={[r.authors.join(', '), r.year, r.callNumber].filter(Boolean).join(' · ')}
                trailing={
                  <Pill
                    label={
                      r.availability === 'available'
                        ? 'On shelf'
                        : r.availability === 'online'
                          ? 'Online'
                          : 'On loan'
                    }
                    tone={r.availability === 'on-loan' ? 'neutral' : 'success'}
                  />
                }
              />
            ))}
          </Card>
        )}
      </QueryState>
    </View>
  );
}

function BookingsTab() {
  const bookings = useBookings();
  const queryClient = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  return (
    <QueryState
      query={bookings}
      what="your bookings"
      isEmpty={(b) => b.filter((x) => x.status === 'confirmed').length === 0}
      empty={
        <StateView
          kind="empty"
          title="No bookings yet"
          body="Book a study space and it will appear here."
        />
      }
    >
      {(list) => (
        <View style={{ gap: spacing.md }}>
          {list
            .filter((b) => b.status === 'confirmed')
            .map((b) => (
              <Card key={b.id}>
                <Row justify="space-between">
                  <View>
                    <Text variant="title3">{b.spaceName}</Text>
                    <Text variant="body">
                      {formatDayLong(b.start)} · {formatTime(b.start)}–{formatTime(b.end)}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      Ref {b.reference}
                    </Text>
                  </View>
                  <Icon name="checkmark-circle" size={24} color={colors.success} />
                </Row>
                <Button
                  label="Cancel booking"
                  variant="ghost"
                  size="md"
                  onPress={async () => {
                    try {
                      await providers.library.cancelBooking(b.id);
                      showToast({ title: 'Booking cancelled', tone: 'info' });
                    } catch {
                      showToast({ title: 'Couldn’t cancel — try again', tone: 'info' });
                    }
                    void queryClient.invalidateQueries({ queryKey: ['bookings', userId] });
                    void queryClient.invalidateQueries({ queryKey: ['study-spaces', userId] });
                  }}
                />
              </Card>
            ))}
        </View>
      )}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: spacing.lg, gap: spacing.md },
  heroPhoto: { height: 150 },
  heroText: { gap: spacing.xs },
  content: { marginTop: spacing.lg },
  slot: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
