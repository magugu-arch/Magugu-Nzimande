import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatCountdown, formatDayLong, formatTime } from '@/core/time/sast';
import { useCampusMap, useExams, useLmsLinks, useTimetableWeek } from '@/data/hooks';
import {
  Button,
  Card,
  Header,
  ListRow,
  Notice,
  Pill,
  QueryState,
  Row,
  Screen,
  SectionHeader,
  StateView,
  Text,
  colors,
  spacing,
} from '@/design';
import { KIND_LABEL, isOnNow, roomDescription } from '@/features/academics/timetable';
import { addToCalendar, calendarMessage } from '@/features/calendar/addToCalendar';
import { CampusMapView } from '@/features/campus/CampusMapView';
import { useNow } from '@/features/system/useNow';
import { routeTo } from '@/core/campus/routing';
import { showToast } from '@/state/toasts';

/**
 * Class detail (brief §26 step 3–4): the room, the building, the way there,
 * what's due for this module — before the student opens any other system.
 */
export default function ClassDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const now = useNow();
  const week = useTimetableWeek();
  const map = useCampusMap();
  const exams = useExams();

  return (
    <Screen
      header={<Header title="Class" fallbackHref="/academics/timetable" />}
      testID="class-detail"
    >
      <QueryState query={week} what="this class">
        {(entries) => {
          const entry = entries.find((e) => e.id === id);
          if (!entry) {
            return (
              <StateView
                kind="empty"
                title="This class isn’t on your timetable"
                body="It may have been cancelled or moved to another week."
                actionLabel="Open timetable"
                onAction={() => router.replace('/academics/timetable')}
              />
            );
          }
          const building = map.data?.buildings.find((b) => b.id === entry.room.buildingId);
          const route =
            map.data && building
              ? routeTo(map.data, map.data.defaultOrigin, building, entry.room.floor)
              : null;
          const due =
            exams.data?.filter(
              (e) => e.moduleCode === entry.moduleCode && new Date(e.start) > now,
            ) ?? [];
          return (
            <View style={styles.body}>
              <View style={{ gap: spacing.xs }}>
                <Row gap={spacing.sm} wrap>
                  <Pill label={`${entry.moduleCode} · ${KIND_LABEL[entry.kind]}`} tone="navy" />
                  {isOnNow(entry, now) ? (
                    <Pill label="On now" tone="success" />
                  ) : new Date(entry.start) > now ? (
                    <Pill label={formatCountdown(entry.start, now)} tone="yellow" />
                  ) : (
                    <Pill label="Finished" />
                  )}
                </Row>
                <Text variant="title1" accessibilityRole="header">
                  {entry.moduleTitle}
                </Text>
                <Text variant="bodyLarge" color={colors.textSecondary}>
                  {formatDayLong(entry.start)} · {formatTime(entry.start)}–{formatTime(entry.end)}
                </Text>
                <Text variant="body" color={colors.textSecondary}>
                  {entry.lecturer}
                </Text>
              </View>

              {entry.status === 'moved' && entry.note ? (
                <Notice
                  tone="warning"
                  title={`Room changed to ${entry.room.code}`}
                  body={`${entry.note}. The map below goes to the new room.`}
                />
              ) : null}

              <Card padded={false}>
                {map.data ? (
                  <CampusMapView
                    map={map.data}
                    route={route}
                    highlight={building?.id}
                    origin={map.data.defaultOrigin}
                    height={260}
                    label={`Map: route from the Main Gate to ${building?.name ?? entry.room.code}`}
                  />
                ) : null}
                <View style={styles.roomBox}>
                  <Text variant="overline" color={colors.textSecondary}>
                    Room
                  </Text>
                  <Text variant="title2">{entry.room.code}</Text>
                  <Text variant="body" color={colors.textSecondary}>
                    {roomDescription(entry.room.code, building?.name, entry.room.floor)}
                  </Text>
                  {route ? (
                    <Text variant="captionStrong" color={colors.navy2}>
                      About {route.walkingMinutes} min walk from the Main Gate · {route.metres} m
                    </Text>
                  ) : null}
                  {building ? (
                    <Text variant="caption" color={colors.textSecondary}>
                      {building.accessibility}
                    </Text>
                  ) : null}
                  <Button
                    label="Show me the way"
                    icon="navigate"
                    variant="accent"
                    fullWidth
                    onPress={() => router.push(`/campus-map?to=${entry.room.code}`)}
                    testID="class-directions"
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              </Card>

              {due.length ? (
                <View>
                  <SectionHeader title="Coming up in this module" />
                  <Card padded={false} style={styles.list}>
                    {due.map((e) => (
                      <ListRow
                        key={e.id}
                        icon="alarm-outline"
                        title={`${e.kind === 'assignment' ? 'Submission' : e.kind === 'exam' ? 'Exam' : 'Test'} · ${e.weightPercent}%`}
                        subtitle={`${formatDayLong(e.start)} · ${formatTime(e.start)}`}
                        meta={formatCountdown(e.start, now)}
                        onPress={() => router.push('/academics/exams')}
                      />
                    ))}
                  </Card>
                </View>
              ) : null}

              <LmsLinks moduleCode={entry.moduleCode} />

              <Button
                label="Add to my calendar"
                icon="calendar-outline"
                variant="secondary"
                fullWidth
                onPress={async () => {
                  const result = await addToCalendar({
                    title: `${entry.moduleCode} ${entry.moduleTitle}`,
                    start: entry.start,
                    end: entry.end,
                    location: `${entry.room.code}, ${building?.name ?? ''}`,
                  });
                  showToast({
                    title: calendarMessage[result],
                    tone: result === 'added' || result === 'downloaded' ? 'success' : 'info',
                  });
                }}
              />
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}

/** LMS deep links — shown as unavailable until the LMS is connected. */
function LmsLinks({ moduleCode }: { moduleCode: string }) {
  const links = useLmsLinks(moduleCode);
  if (!links.data) return null;
  const connected = links.data.some((l) => l.url);
  return (
    <View>
      <SectionHeader title="On the LMS" />
      <Card padded={false} style={styles.list}>
        {links.data.map((l) => (
          <ListRow
            key={l.label}
            icon="laptop-outline"
            title={l.label}
            subtitle={l.url ? 'Opens in the LMS' : 'Available once the LMS is connected'}
            disabled={!l.url}
            trailing={l.url ? undefined : <Pill label="Not connected" />}
          />
        ))}
      </Card>
      {!connected ? (
        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
          NMU ONE links into the LMS rather than copying it. These open once the LMS integration is
          switched on.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  roomBox: { padding: spacing.lg, gap: spacing.xs },
  list: { paddingHorizontal: spacing.lg },
});
