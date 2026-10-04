import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  addMinutes,
  formatCountdown,
  formatDayLong,
  formatTime,
  minutesBetween,
} from '@/core/time/sast';
import { useExams } from '@/data/hooks';
import {
  Button,
  Card,
  Header,
  Pill,
  QueryState,
  Row,
  Screen,
  StateView,
  Text,
  colors,
  spacing,
} from '@/design';
import { addToCalendar, calendarMessage } from '@/features/calendar/addToCalendar';
import { useNow } from '@/features/system/useNow';
import { showToast } from '@/state/toasts';

const KIND = { exam: 'Exam', test: 'Test', assignment: 'Submission' } as const;

/** Exam timetable and assessment countdowns (brief §7). */
export default function Exams() {
  const router = useRouter();
  const now = useNow();
  const exams = useExams();
  return (
    <Screen
      header={<Header title="Assessments" largeTitle="Exams & assessments" eyebrow="Academics" />}
      onRefresh={exams.refetch}
      testID="exams"
    >
      <QueryState
        query={exams}
        what="your assessments"
        isEmpty={(e) => e.length === 0}
        empty={
          <StateView
            kind="empty"
            title="Nothing scheduled"
            body="Assessments appear here once they’re published."
          />
        }
      >
        {(list) => (
          <View style={{ gap: spacing.md }}>
            {[...list]
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((e) => {
                const days = Math.floor(minutesBetween(now, e.start) / (60 * 24));
                const soon = days <= 7;
                return (
                  <Card key={e.id} testID={`exam-${e.id}`}>
                    <Row justify="space-between">
                      <Pill label={`${KIND[e.kind]} · ${e.weightPercent}%`} tone="navy" />
                      <Pill
                        label={formatCountdown(e.start, now)}
                        tone={soon ? 'yellow' : 'neutral'}
                      />
                    </Row>
                    <Text variant="title3" style={{ marginTop: spacing.sm }}>
                      {e.moduleTitle}
                    </Text>
                    <Text variant="body">
                      {formatDayLong(e.start)} ·{' '}
                      {e.kind === 'assignment'
                        ? `due ${formatTime(e.start)}`
                        : `${formatTime(e.start)}, ${e.durationMinutes} min`}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {e.moduleCode} · {e.venue ? `Venue ${e.venue.code}` : 'Submit online'}
                      {e.seat ? ` · Seat: ${e.seat}` : ''}
                    </Text>
                    <Row gap={spacing.sm} style={{ marginTop: spacing.md }} wrap>
                      {e.venue ? (
                        <Button
                          label="Directions"
                          icon="navigate"
                          size="md"
                          variant="secondary"
                          onPress={() => router.push(`/campus-map?to=${e.venue!.code}`)}
                        />
                      ) : null}
                      <Button
                        label="Add to calendar"
                        icon="calendar-outline"
                        size="md"
                        variant="ghost"
                        onPress={async () => {
                          const r = await addToCalendar({
                            title: `${e.moduleCode} ${KIND[e.kind]}`,
                            start: e.start,
                            end: addMinutes(e.start, Math.max(30, e.durationMinutes)).toISOString(),
                            location: e.venue?.code ?? 'Online submission',
                          });
                          showToast({ title: calendarMessage[r], tone: 'success' });
                        }}
                      />
                    </Row>
                  </Card>
                );
              })}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}
