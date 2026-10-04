import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { asPhotoKey } from '@/content/photos';
import type { EventCategory } from '@/core/domain/models';
import { formatMoney } from '@/core/domain/money';
import { formatDayShort, formatTime } from '@/core/time/sast';
import { useEvents, useTickets } from '@/data/hooks';
import {
  Card,
  ChipRow,
  Header,
  Icon,
  ListRow,
  Photo,
  Pill,
  QueryState,
  Row,
  Screen,
  SectionHeader,
  StateView,
  Text,
  colors,
  radius,
  spacing,
} from '@/design';
import { useCan } from '@/features/access/access';
import { usePrefs } from '@/state/preferences';
import { useSession } from '@/state/session';

type Filter = 'all' | 'saved' | EventCategory;

const CATEGORY: Record<EventCategory, string> = {
  music: 'Music',
  careers: 'Careers',
  innovation: 'Innovation',
  wellbeing: 'Wellbeing',
  sport: 'Sport',
  learning: 'Learning',
};

/**
 * Event discovery (brief §12): a useful participation layer — what's on,
 * filters, saved events and tickets. Not another social network.
 */
export default function Events() {
  const router = useRouter();
  const events = useEvents();
  const canBook = useCan('events.book');
  const tickets = useTickets();
  const userId = useSession((s) => s.user?.id);
  const prefs = usePrefs(userId);
  const [filter, setFilter] = useState<Filter>('all');

  const valid = canBook ? (tickets.data?.filter((t) => t.status === 'valid') ?? []) : [];

  return (
    <Screen
      header={<Header title="Events" largeTitle="What’s on" eyebrow="Community" />}
      testID="events"
    >
      {valid.length ? (
        <View style={styles.section}>
          <SectionHeader title="Your tickets" />
          <Card padded={false} style={styles.list}>
            {valid.map((t) => (
              <ListRow
                key={t.id}
                icon="ticket"
                iconTone="yellow"
                title={t.eventTitle}
                subtitle={`${formatDayShort(t.start)} · ${formatTime(t.start)} · ${t.venue}`}
                onPress={() => router.push(`/events/ticket/${t.id}`)}
              />
            ))}
          </Card>
        </View>
      ) : null}

      <ChipRow<Filter>
        value={filter}
        onChange={setFilter}
        testIDPrefix="event-filter"
        options={[
          { value: 'all', label: 'All' },
          { value: 'saved', label: 'Saved', icon: 'bookmark-outline' },
          { value: 'music', label: 'Music' },
          { value: 'learning', label: 'Learning' },
          { value: 'innovation', label: 'Innovation' },
          { value: 'careers', label: 'Careers' },
          { value: 'wellbeing', label: 'Wellbeing' },
        ]}
      />

      <View style={styles.list2}>
        <QueryState
          query={events}
          what="events"
          isEmpty={(e) => e.length === 0}
          empty={<StateView kind="empty" title="Nothing scheduled" body="Check back soon." />}
        >
          {(list) => {
            const shown = list.filter((e) =>
              filter === 'all'
                ? true
                : filter === 'saved'
                  ? prefs.savedEvents.includes(e.id)
                  : e.category === filter,
            );
            if (!shown.length) {
              return (
                <StateView
                  kind="empty"
                  title={filter === 'saved' ? 'No saved events' : 'Nothing in this category'}
                  body={
                    filter === 'saved'
                      ? 'Tap Save on an event to keep it here.'
                      : 'Try another filter.'
                  }
                />
              );
            }
            return shown.map((e) => (
              <Card
                key={e.id}
                padded={false}
                onPress={() => router.push(`/events/${e.id}`)}
                accessibilityLabel={`${e.title}. ${formatDayShort(e.start)} at ${formatTime(e.start)}, ${e.venue}. ${e.price ? 'Paid ticket.' : e.ticketing === 'open-entry' ? 'No ticket needed.' : 'Free ticket.'}`}
                testID={`event-${e.id}`}
              >
                <Photo
                  photo={asPhotoKey(e.photo, 'events')}
                  size="md"
                  rounded={false}
                  style={styles.photo}
                  decorative
                />
                <View style={styles.body}>
                  <Row justify="space-between">
                    <Text variant="overline" color={colors.textSecondary}>
                      {formatDayShort(e.start)} · {formatTime(e.start)}
                    </Text>
                    <Pill label={CATEGORY[e.category]} />
                  </Row>
                  <Text variant="title3">{e.title}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {e.venue}
                  </Text>
                  <Row gap={spacing.xs} style={{ marginTop: spacing.xs }} wrap>
                    <Pill
                      label={
                        e.ticketing === 'open-entry'
                          ? 'Walk in'
                          : e.price
                            ? formatMoney(e.price, { showCents: false })
                            : 'Free ticket'
                      }
                      tone={e.ticketing === 'open-entry' ? 'info' : 'yellow'}
                    />
                    {e.ticketing !== 'open-entry' && e.spotsLeft < 60 ? (
                      <Pill label={`${e.spotsLeft} left`} tone="warning" />
                    ) : null}
                    {prefs.savedEvents.includes(e.id) ? (
                      <Pill label="Saved" tone="navy" icon="bookmark" />
                    ) : null}
                  </Row>
                </View>
              </Card>
            ));
          }}
        </QueryState>
      </View>

      <Card
        onPress={() => router.push('/societies')}
        style={styles.section}
        accessibilityLabel="Societies. Find your people."
      >
        <Row gap={spacing.md}>
          <View style={styles.socIcon}>
            <Icon name="people" size={22} color={colors.navy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="title3">Societies</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Join a club, find your people
            </Text>
          </View>
        </Row>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg, marginTop: spacing.md },
  list: { paddingHorizontal: spacing.lg },
  list2: { marginTop: spacing.lg, gap: spacing.lg },
  photo: { height: 170, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  body: { padding: spacing.lg, gap: spacing.xs },
  socIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
