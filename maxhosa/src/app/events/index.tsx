import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Chip } from '@/components/Chip';
import { FixtureRow } from '@/components/events/FixtureRow';
import { MonthCalendar } from '@/components/events/MonthCalendar';
import { Group, GroupTitle, Row } from '@/components/List';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { eventDayKeys, eventsByDay, isPast, sastDayKey, upcoming } from '@/domain/events';
import { useMarket } from '@/features/catalogue';
import { addAllToCalendar } from '@/features/calendar';
import { useEvents } from '@/features/events';
import { usePrefs } from '@/store/prefs';

type When = 'upcoming' | 'past';

/**
 * The events calendar: a month of fixtures, a list beneath it filtered by
 * city or by the day tapped, and the ways to stay in the loop — every
 * fixture in your calendar, and (with consent) word of new ones.
 */
export default function EventsScreen() {
  const { colors } = useTheme();
  const market = useMarket();
  const data = useEvents();
  const following = usePrefs((s) => s.notifications.collections.enabled);
  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [city, setCity] = useState('all');
  const [when, setWhen] = useState<When>('upcoming');

  const now = data.data?.now;
  const todayKey = now ? sastDayKey(now) : '';
  const shown =
    month ??
    (todayKey ? { y: Number(todayKey.slice(0, 4)), m: Number(todayKey.slice(5, 7)) - 1 } : null);
  const byDay = useMemo(() => eventsByDay(data.data?.list ?? []), [data.data]);
  const cities = useMemo(
    () => ['all', ...new Set((data.data?.list ?? []).map((e) => e.city))],
    [data.data],
  );
  const list = useMemo(() => {
    if (!data.data) return [];
    const { list: all, now: at } = data.data;
    return all
      .filter((e) => city === 'all' || e.city === city)
      .filter((e) =>
        day ? eventDayKeys(e).includes(day) : when === 'past' ? isPast(e, at) : !isPast(e, at),
      )
      .sort((a, b) =>
        when === 'past' && !day
          ? b.startsAt.localeCompare(a.startsAt)
          : a.startsAt.localeCompare(b.startsAt),
      );
  }, [data.data, city, day, when]);

  const dayLabel = day
    ? new Intl.DateTimeFormat(market.locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).format(new Date(`${day}T12:00:00Z`))
    : '';

  return (
    <Screen title="Events" largeTitle subtitle="Sample fixtures · times in South Africa (SAST)">
      {data.status === 'loading' ? <LoadingSkeleton rows={2} /> : null}
      {data.status === 'error' ? <ErrorState onRetry={data.retry} /> : null}
      {data.data && shown ? (
        <>
          <View style={{ paddingHorizontal: space.gutter }}>
            <MonthCalendar
              year={shown.y}
              month={shown.m}
              todayKey={todayKey}
              selected={day}
              byDay={byDay}
              now={data.data.now}
              onSelect={setDay}
              onMonth={(delta) => {
                const d = new Date(Date.UTC(shown.y, shown.m + delta, 1));
                setMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
                setDay(null);
              }}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            accessibilityRole="radiogroup"
            accessibilityLabel="City"
          >
            {cities.map((c) => (
              <Chip
                key={c}
                kind="radio"
                label={c === 'all' ? 'All cities' : c}
                selected={city === c}
                onPress={() => setCity(c)}
              />
            ))}
          </ScrollView>

          {day ? (
            <View style={styles.dayBar}>
              <Text variant="subhead" weight="600">
                {dayLabel}
              </Text>
              <PressableScale accessibilityRole="button" onPress={() => setDay(null)} hitSlop={10}>
                <Text variant="subhead" weight="600" color="ink2" style={styles.link}>
                  Show all dates
                </Text>
              </PressableScale>
            </View>
          ) : (
            <View
              style={[styles.segment, { backgroundColor: colors.sunk }]}
              accessibilityRole="radiogroup"
              accessibilityLabel="When"
            >
              {(['upcoming', 'past'] as const).map((w) => (
                <PressableScale
                  key={w}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: when === w }}
                  onPress={() => setWhen(w)}
                  style={[styles.segmentItem, when === w && { backgroundColor: colors.card }]}
                >
                  <Text variant="subhead" weight="600" color={when === w ? 'ink' : 'ink2'}>
                    {w === 'upcoming' ? 'Upcoming' : 'Past'}
                  </Text>
                </PressableScale>
              ))}
            </View>
          )}

          <Group>
            {list.length ? (
              list.map((e, i) => (
                <FixtureRow
                  key={e.id}
                  event={e}
                  rsvp={data.data!.rsvps.find((r) => r.eventId === e.id)}
                  now={data.data!.now}
                  first={i === 0}
                  thumb
                />
              ))
            ) : (
              <EmptyState
                icon="calendar-outline"
                title={day ? 'Nothing on this day' : 'No fixtures here yet'}
                body={
                  day
                    ? 'Pick a day with a dot, or show all dates.'
                    : 'Try another city, or follow fixtures to hear when one is announced.'
                }
              />
            )}
          </Group>

          <GroupTitle>Stay in the loop</GroupTitle>
          <Group>
            <Row
              first
              icon="calendar-outline"
              title="Add every upcoming fixture to your calendar"
              subtitle="In the live app, a subscription that updates itself"
              onPress={() => void addAllToCalendar(upcoming(data.data!.list, data.data!.now))}
            />
            <Row
              icon="notifications-outline"
              title="Tell me when new fixtures are announced"
              subtitle={
                following
                  ? 'On · marketing, with your consent'
                  : 'Off · marketing, only with your consent'
              }
              onPress={() => router.push('/notifications')}
            />
          </Group>
          <Text variant="footnote" color="ink3" style={styles.note}>
            Event times, venues and capacity come from MAXHOSA’s event system once it is connected.
            Venues are shared with confirmed guests, never published in the app.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: space.gutter, paddingVertical: space.l, gap: space.s },
  dayBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.gutter,
    paddingBottom: space.m,
  },
  link: { textDecorationLine: 'underline' },
  segment: {
    flexDirection: 'row',
    marginHorizontal: space.gutter,
    marginBottom: space.m,
    padding: 3,
    borderRadius: radius.s,
  },
  segmentItem: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.s - 2,
  },
  note: { paddingHorizontal: space.gutter + 4, paddingTop: space.m },
});
