import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatTime } from '@/core/time/sast';
import {
  useArrivals,
  useCampusMap,
  useShuttleRoutes,
  useStudySpaces,
  useTimetableToday,
  useVendors,
} from '@/data/hooks';
import {
  Button,
  Card,
  ListRow,
  Pill,
  PhotoHero,
  Row,
  Screen,
  SectionHeader,
  Text,
  colors,
  spacing,
} from '@/design';
import { useCan } from '@/features/access/access';
import { nextClass } from '@/features/academics/timetable';
import { CampusMapView } from '@/features/campus/CampusMapView';
import { useNow } from '@/features/system/useNow';

/**
 * The Campus world (brief §9): the map, getting around, and the places you
 * use every day — each with its live status, not a list of departments.
 */
export default function Campus() {
  const router = useRouter();
  const now = useNow();
  const canTimetable = useCan('academics.timetable');
  const canShuttle = useCan('transport.view');
  const canBook = useCan('library.book');
  const canDining = useCan('dining.view');
  const canResidence = useCan('residence.view');

  const map = useCampusMap();
  const timetable = useTimetableToday(canTimetable);
  const arrivals = useArrivals(canShuttle);
  const routes = useShuttleRoutes(canShuttle);
  const spaces = useStudySpaces(canBook);
  const vendors = useVendors(canDining);

  const next = timetable.data ? nextClass(timetable.data, now) : null;
  const freeRooms = spaces.data?.filter((s) => s.slots.some((sl) => sl.available)).length ?? 0;
  const openVendors = vendors.data?.filter((v) => v.isOpen).length ?? 0;

  return (
    <Screen padded={false} topInset={false} testID="campus">
      <PhotoHero
        photo="heroCampus"
        eyebrow="South Campus · Gqeberha"
        title="Your campus"
        subtitle="Find your way, catch the shuttle, book a space, grab lunch."
        height={260}
      />

      <View style={styles.body}>
        <View>
          <SectionHeader
            title="Map"
            action="Open map"
            onAction={() => router.push('/campus-map')}
          />
          {map.data ? (
            <Card
              padded={false}
              onPress={() => router.push(next ? `/campus-map?to=${next.room.code}` : '/campus-map')}
              accessibilityLabel="Open the campus map"
            >
              <CampusMapView
                map={map.data}
                height={190}
                origin={map.data.defaultOrigin}
                highlight={next?.room.buildingId ?? null}
                label="Schematic map of South Campus"
              />
            </Card>
          ) : null}
          {next ? (
            <Button
              label={`Take me to my next class · ${next.room.code}`}
              icon="navigate"
              variant="primary"
              fullWidth
              style={{ marginTop: spacing.md }}
              onPress={() => router.push(`/campus-map?to=${next.room.code}`)}
              testID="campus-next-class"
            />
          ) : null}
        </View>

        {canShuttle ? (
          <View>
            <SectionHeader
              title="Shuttle"
              action="All routes"
              onAction={() => router.push('/transport')}
            />
            <Card padded={false} style={styles.list}>
              {routes.data?.map((r) => {
                const a = arrivals.data?.find(
                  (x) => x.routeId === r.id && x.stopId === r.stops[0]?.id,
                );
                const running = r.status !== 'not-running';
                return (
                  <ListRow
                    key={r.id}
                    icon="bus"
                    iconTone={running ? 'navy' : 'sunken'}
                    title={`Route ${r.code} · ${r.name}`}
                    subtitle={
                      running && a
                        ? `${a.etaMinutes} min · departs ${formatTime(a.departsAt)}`
                        : (r.statusNote ?? 'Not running')
                    }
                    trailing={
                      r.status === 'delayed' ? (
                        <Pill label="Delayed" tone="warning" />
                      ) : running ? (
                        <Pill label="Live" tone="success" />
                      ) : undefined
                    }
                    onPress={() => router.push(`/transport/${r.id}`)}
                  />
                );
              }) ?? <Text variant="body">Loading shuttle times…</Text>}
            </Card>
          </View>
        ) : null}

        <View>
          <SectionHeader title="Places" />
          <Card padded={false} style={styles.list}>
            {canBook ? (
              <ListRow
                icon="book"
                iconTone="yellow"
                title="Library study spaces"
                subtitle={
                  spaces.data
                    ? `${freeRooms} rooms with free slots today`
                    : 'Checking availability…'
                }
                onPress={() => router.push('/library?tab=spaces')}
              />
            ) : null}
            {canDining ? (
              <ListRow
                icon="restaurant"
                iconTone="yellow"
                title="Food & campus shops"
                subtitle={
                  vendors.data ? `${openVendors} open now · order ahead` : 'Checking who’s open…'
                }
                onPress={() => router.push('/dining')}
              />
            ) : null}
            {canResidence ? (
              <ListRow
                icon="home"
                iconTone="yellow"
                title="Residence"
                subtitle="Your room and requests"
                onPress={() => router.push('/residence')}
              />
            ) : null}
            <ListRow
              icon="sparkles"
              iconTone="yellow"
              title="Events"
              subtitle="What’s on this week"
              onPress={() => router.push('/events')}
            />
          </Card>
        </View>

        <Card
          tone="navy"
          onPress={() => router.push('/safety')}
          accessibilityLabel="Safety. Emergency numbers, Campus Protection and safe travel."
          testID="campus-safety"
        >
          <Row gap={spacing.md}>
            <View style={{ flex: 1 }}>
              <Text variant="overline" color={colors.yellow}>
                Safety
              </Text>
              <Text variant="title3" color={colors.white}>
                Emergency help and safe travel
              </Text>
              <Text variant="caption" color={colors.textOnDarkMuted}>
                One tap to emergency numbers. Share your location when you choose.
              </Text>
            </View>
          </Row>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xl, gap: spacing.xl },
  list: { paddingHorizontal: spacing.lg },
});
