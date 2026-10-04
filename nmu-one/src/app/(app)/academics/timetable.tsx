import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { TimetableEntry } from '@/core/domain/models';
import { formatDayLong, formatRelativeDay, formatTime, sastDayDiff } from '@/core/time/sast';
import { useTimetableToday, useTimetableWeek } from '@/data/hooks';
import {
  Card,
  Header,
  Pill,
  QueryState,
  Row,
  Screen,
  SectionHeader,
  Segmented,
  StateView,
  Text,
  Touchable,
  colors,
  radius,
  spacing,
} from '@/design';
import { KIND_LABEL, isOnNow } from '@/features/academics/timetable';
import { useNow } from '@/features/system/useNow';

/** Today and week timetables (brief §7). Today's is kept for offline use. */
export default function Timetable() {
  const router = useRouter();
  const now = useNow();
  const [view, setView] = useState<'today' | 'week'>('today');
  const today = useTimetableToday();
  const week = useTimetableWeek();
  const query = view === 'today' ? today : week;

  const row = (e: TimetableEntry) => {
    const past = new Date(e.end) <= now;
    return (
      <Touchable
        key={e.id}
        onPress={() => router.push(`/academics/class/${e.id}`)}
        accessibilityLabel={`${formatTime(e.start)} to ${formatTime(e.end)}, ${e.moduleTitle}, ${KIND_LABEL[e.kind]}, ${e.room.code}${isOnNow(e, now) ? ', on now' : ''}${e.status === 'moved' ? ', room changed' : ''}`}
        style={[styles.row, past ? styles.past : null]}
        testID={`tt-${e.id}`}
      >
        <View style={styles.time}>
          <Text variant="bodyStrong">{formatTime(e.start)}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {formatTime(e.end)}
          </Text>
        </View>
        <View style={[styles.bar, isOnNow(e, now) ? styles.barNow : null]} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{e.moduleTitle}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {e.moduleCode} · {KIND_LABEL[e.kind]} · {e.room.code} · {e.lecturer}
          </Text>
          <Row gap={spacing.xs} wrap>
            {isOnNow(e, now) ? <Pill label="On now" tone="success" /> : null}
            {e.status === 'moved' ? <Pill label="Room changed" tone="yellow" /> : null}
            {e.status === 'cancelled' ? <Pill label="Cancelled" tone="danger" /> : null}
          </Row>
        </View>
      </Touchable>
    );
  };

  return (
    <Screen
      header={
        <Header
          title="Timetable"
          largeTitle={view === 'today' ? formatDayLong(now) : 'This week'}
          eyebrow="Timetable"
        />
      }
      onRefresh={query.refetch}
      testID="timetable"
    >
      <Segmented
        label="Timetable view"
        value={view}
        onChange={setView}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'Week' },
        ]}
      />
      <View style={{ marginTop: spacing.lg }}>
        <QueryState
          query={query}
          what="your timetable"
          isEmpty={(d) => d.length === 0}
          empty={
            <StateView
              kind="empty"
              title={view === 'today' ? 'No classes today' : 'No classes this week'}
              body="Enjoy the space — or book a study room."
            />
          }
        >
          {(entries) => {
            if (view === 'today') return <Card padded={false}>{entries.map(row)}</Card>;
            const days = [...new Set(entries.map((e) => sastDayDiff(now, e.start)))];
            return days.map((d) => {
              const dayEntries = entries.filter((e) => sastDayDiff(now, e.start) === d);
              return (
                <View key={d} style={{ marginBottom: spacing.lg }}>
                  <SectionHeader
                    title={`${formatRelativeDay(dayEntries[0]!.start, now)} · ${formatDayLong(dayEntries[0]!.start)}`}
                  />
                  <Card padded={false}>{dayEntries.map(row)}</Card>
                </View>
              );
            });
          }}
        </QueryState>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  past: { opacity: 0.55 },
  time: { width: 52 },
  bar: { width: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  barNow: { backgroundColor: colors.yellow },
});
