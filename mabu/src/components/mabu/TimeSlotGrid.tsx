import { Pressable, StyleSheet, View } from 'react-native';
import type { ReservationSlot } from '@/domain/reservations/types';
import { formatTime } from '@/domain/shared/format';
import { colors, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';
import { Text } from '../ui';

/**
 * §25 TimeSlotGrid — times grouped by service (§6 step 3). A slot is
 * tappable only when the provider said it is available; unavailable times
 * stay visible, struck through, so the guest can see the shape of the
 * evening and choose the waitlist knowingly.
 */
export function TimeSlotGrid({
  slots,
  selectedId,
  onSelect,
}: {
  slots: ReservationSlot[];
  selectedId?: string;
  onSelect: (slot: ReservationSlot) => void;
}) {
  const groups: { label: string; slots: ReservationSlot[] }[] = [
    { label: 'Lunch', slots: slots.filter((s) => s.servicePeriod === 'lunch') },
    { label: 'Dinner', slots: slots.filter((s) => s.servicePeriod === 'dinner') },
  ].filter((g) => g.slots.length);

  return (
    <View style={{ gap: spacing.xl }}>
      {groups.map((g) => (
        <View key={g.label} style={{ gap: spacing.md }}>
          <Text variant="eyebrow" color="textMuted" accessibilityRole="header">
            {g.label}
          </Text>
          <View style={styles.grid}>
            {g.slots.map((s) => {
              const selected = s.slotId === selectedId;
              const time = formatTime(s.startsAt);
              return (
                <Pressable
                  key={s.slotId}
                  disabled={!s.available}
                  onPress={() => {
                    haptic.select();
                    onSelect(s);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${time}${s.available ? '' : ', unavailable'}`}
                  aria-selected={selected}
                  aria-disabled={!s.available}
                  style={({ pressed }) => [
                    styles.slot,
                    selected && styles.selected,
                    !s.available && styles.unavailable,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    variant="title"
                    style={{
                      color: selected
                        ? colors.textOnAccent
                        : s.available
                          ? colors.text
                          : colors.textSubtle,
                      textDecorationLine: s.available ? 'none' : 'line-through',
                    }}
                  >
                    {time}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

/** §25 AvailabilityChip. */
export function AvailabilityChip({
  state,
}: {
  state: 'available' | 'limited' | 'sold-out' | 'waitlist' | 'past';
}) {
  const map = {
    available: { label: 'Places available', color: colors.success },
    limited: { label: 'Few places left', color: colors.warning },
    'sold-out': { label: 'Sold out', color: colors.textSubtle },
    waitlist: { label: 'Waitlist open', color: colors.copper },
    past: { label: 'Ended', color: colors.textSubtle },
  }[state];
  return (
    <View
      style={[styles.chip, { borderColor: map.color }]}
      accessible
      accessibilityLabel={map.label}
    >
      <View style={[styles.chipDot, { backgroundColor: map.color }]} />
      <Text variant="caption" style={{ color: map.color }}>
        {map.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: {
    width: '31%',
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  unavailable: { borderColor: colors.border, backgroundColor: 'transparent' },
  pressed: { opacity: 0.75 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
});
