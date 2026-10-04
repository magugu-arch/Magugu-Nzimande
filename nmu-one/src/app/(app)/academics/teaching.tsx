import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDayLong, formatRelativeDay, formatTime, sastDayDiff } from '@/core/time/sast';
import { useTeachingWeek } from '@/data/hooks';
import {
  Card,
  Header,
  ListRow,
  Pill,
  QueryState,
  Screen,
  SectionHeader,
  StateView,
  spacing,
} from '@/design';
import { KIND_LABEL, isOnNow } from '@/features/academics/timetable';
import { useNow } from '@/features/system/useNow';

/** A lecturer's week: teaching and consultations (brief §3 staff "teaching information"). */
export default function Teaching() {
  const router = useRouter();
  const now = useNow();
  const teaching = useTeachingWeek();
  return (
    <Screen
      header={<Header title="Teaching" largeTitle="Your teaching week" eyebrow="Staff" />}
      testID="teaching"
    >
      <QueryState
        query={teaching}
        what="your teaching schedule"
        isEmpty={(t) => t.length === 0}
        empty={<StateView kind="empty" title="No teaching this week" />}
      >
        {(list) => {
          const days = [...new Set(list.map((e) => sastDayDiff(now, e.start)))];
          return days.map((d) => {
            const items = list.filter((e) => sastDayDiff(now, e.start) === d);
            return (
              <View key={d} style={{ marginBottom: spacing.lg }}>
                <SectionHeader
                  title={`${formatRelativeDay(items[0]!.start, now)} · ${formatDayLong(items[0]!.start)}`}
                />
                <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
                  {items.map((e) => (
                    <ListRow
                      key={e.id}
                      icon={e.kind === 'consultation' ? 'chatbubbles-outline' : 'easel-outline'}
                      title={`${formatTime(e.start)} · ${e.moduleTitle}`}
                      subtitle={`${e.moduleCode} · ${KIND_LABEL[e.kind]} · ${e.room.code}`}
                      trailing={
                        isOnNow(e, now) ? (
                          <Pill label="Now" tone="success" />
                        ) : e.status === 'moved' ? (
                          <Pill label="Moved" tone="yellow" />
                        ) : undefined
                      }
                      onPress={() => router.push(`/campus-map?to=${e.room.code}`)}
                      accessibilityHint="Shows the room on the campus map"
                    />
                  ))}
                </Card>
              </View>
            );
          });
        }}
      </QueryState>
    </Screen>
  );
}
