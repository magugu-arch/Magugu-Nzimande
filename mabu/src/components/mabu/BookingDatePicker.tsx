import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { DayState } from '@/domain/reservations/service';
import { formatCalendarDate, monthName } from '@/domain/shared/format';
import { venueWeekday } from '@/domain/shared/time';
import { colors, HIT_SLOP, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';
import { Text } from '../ui';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * §25 BookingDatePicker — a month calendar with available / full / closed
 * states (§6 step 1). States come from the provider; while they load, days
 * are selectable but unmarked, never shown as available on a guess.
 */
export function BookingDatePicker({
  today,
  maxDate,
  selected,
  states,
  onSelect,
  onMonthChange,
}: {
  today: string;
  maxDate: string;
  selected: string | null;
  states?: Record<string, DayState>;
  onSelect: (date: string) => void;
  onMonthChange?: (firstOfMonth: string) => void;
}) {
  const [cursor, setCursor] = useState(() => (selected ?? today).slice(0, 7));
  const [year, month] = cursor.split('-').map(Number) as [number, number];

  const cells = useMemo(() => {
    const first = `${cursor}-01`;
    // Monday-first grid.
    const lead = (venueWeekday(first) + 6) % 7;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) out.push(`${cursor}-${String(d).padStart(2, '0')}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [cursor, year, month]);

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    const next = d.toISOString().slice(0, 7);
    setCursor(next);
    onMonthChange?.(`${next}-01`);
  };
  const canBack = cursor > today.slice(0, 7);
  const canForward = cursor < maxDate.slice(0, 7);

  return (
    <View>
      <View style={styles.head}>
        <Pressable
          onPress={() => canBack && shift(-1)}
          disabled={!canBack}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={[styles.nav, !canBack && styles.dim]}
        >
          <Feather name="chevron-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="h3" accessibilityRole="header">
          {monthName(month - 1)} {year}
        </Text>
        <Pressable
          onPress={() => canForward && shift(1)}
          disabled={!canForward}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={[styles.nav, !canForward && styles.dim]}
        >
          <Feather name="chevron-right" size={20} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((w, i) => (
          <Text
            key={`${w}${i}`}
            variant="caption"
            color="textSubtle"
            style={styles.weekday}
            importantForAccessibility="no"
          >
            {w}
          </Text>
        ))}
        {cells.map((date, i) => {
          if (!date) return <View key={`e${i}`} style={styles.cell} />;
          const outOfRange = date < today || date > maxDate;
          const state = states?.[date];
          const closed = state === 'closed';
          const full = state === 'full';
          const isSelected = date === selected;
          const disabled = outOfRange || closed;
          const day = Number(date.slice(8));
          const stateText = outOfRange
            ? 'not bookable'
            : closed
              ? 'closed'
              : full
                ? 'fully booked, waitlist open'
                : state === 'available'
                  ? 'tables available'
                  : '';
          return (
            <Pressable
              key={date}
              onPress={() => {
                haptic.select();
                onSelect(date);
              }}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${formatCalendarDate(date)}${stateText ? `, ${stateText}` : ''}`}
              aria-pressed={isSelected}
              aria-disabled={disabled}
              style={styles.cell}
            >
              <View
                style={[
                  styles.day,
                  isSelected && styles.daySelected,
                  date === today && !isSelected && styles.today,
                ]}
              >
                <Text
                  variant="bodySmall"
                  style={{
                    color: isSelected
                      ? colors.textOnAccent
                      : disabled
                        ? colors.border
                        : full
                          ? colors.textSubtle
                          : colors.text,
                    textDecorationLine: full && !isSelected ? 'line-through' : 'none',
                  }}
                >
                  {day}
                </Text>
              </View>
              {state === 'available' && !isSelected ? <View style={styles.dot} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View
        style={styles.legend}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.legendItem}>
          <View style={styles.dotStatic} />
          <Text variant="caption" color="textMuted">
            Tables available
          </Text>
        </View>
        <View style={styles.legendItem}>
          <Text variant="caption" color="textSubtle" style={{ textDecorationLine: 'line-through' }}>
            12
          </Text>
          <Text variant="caption" color="textMuted">
            Fully booked — join the waitlist
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', paddingBottom: spacing.sm },
  cell: { width: `${100 / 7}%`, height: 48, alignItems: 'center', justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.accent },
  today: { borderWidth: 1, borderColor: colors.hairline },
  dot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  dotStatic: { width: 5, height: 5, borderRadius: radius.pill, backgroundColor: colors.accent },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
