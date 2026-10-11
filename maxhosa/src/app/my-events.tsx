import { router } from 'expo-router';
import { FixtureRow } from '@/components/events/FixtureRow';
import { Group, GroupTitle } from '@/components/List';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/States';
import { useEvents } from '@/features/events';

/** The guest's RSVPs, invitations and waitlist places in one list. */
export default function MyEvents() {
  const data = useEvents();
  const mine = data.data
    ? data.data.list.filter((e) => data.data!.rsvps.some((r) => r.eventId === e.id))
    : [];
  return (
    <Screen title="My events">
      {data.status === 'loading' ? <LoadingSkeleton rows={2} /> : null}
      {data.status === 'error' ? <ErrorState onRetry={data.retry} /> : null}
      {data.data && !mine.length ? (
        <EmptyState
          icon="calendar-outline"
          title="No RSVPs yet"
          body="Events you RSVP to appear here, with the date, your place and the event edit."
          action={{ label: 'Open the events calendar', onPress: () => router.push('/events') }}
        />
      ) : null}
      {mine.length ? (
        <>
          <GroupTitle>Your RSVPs</GroupTitle>
          <Group>
            {mine.map((e, i) => (
              <FixtureRow
                key={e.id}
                event={e}
                rsvp={data.data!.rsvps.find((r) => r.eventId === e.id)}
                now={data.data!.now}
                first={i === 0}
                thumb
              />
            ))}
          </Group>
        </>
      ) : null}
    </Screen>
  );
}
