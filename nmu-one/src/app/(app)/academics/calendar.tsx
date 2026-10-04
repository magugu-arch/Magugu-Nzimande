import { formatCountdown, formatDayLong } from '@/core/time/sast';
import { useAcademicCalendar } from '@/data/hooks';
import { Card, Header, ListRow, QueryState, Screen, StateView, type IconName } from '@/design';
import { useNow } from '@/features/system/useNow';
import { spacing } from '@/design';
import type { AcademicDate } from '@/core/domain/models';

const ICON: Record<AcademicDate['kind'], IconName> = {
  term: 'school-outline',
  exam: 'alarm-outline',
  deadline: 'flag-outline',
  holiday: 'sunny-outline',
  ceremony: 'ribbon-outline',
};

/** The academic calendar (brief §7). */
export default function AcademicCalendar() {
  const now = useNow();
  const calendar = useAcademicCalendar();
  return (
    <Screen
      header={<Header title="Calendar" largeTitle="Academic calendar" eyebrow="Key dates" />}
      testID="calendar"
    >
      <QueryState
        query={calendar}
        what="the academic calendar"
        isEmpty={(c) => c.length === 0}
        empty={<StateView kind="empty" title="No dates published yet" />}
      >
        {(list) => (
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {list.map((d) => (
              <ListRow
                key={d.id}
                icon={ICON[d.kind]}
                title={d.title}
                subtitle={formatDayLong(d.date)}
                meta={new Date(d.date) > now ? formatCountdown(d.date, now) : undefined}
              />
            ))}
          </Card>
        )}
      </QueryState>
    </Screen>
  );
}
