import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { businessRules } from '@/constants/config';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import { colors, radius, spacing } from '@/theme';
import { buildScheduleDays, formatDateTime } from '@/utils/datetime';

/** Order Scheduling (brief §4). */
export default function ScheduleScreen() {
  const router = useRouter();

  const scheduledFor = useFulfilmentStore((state) => state.scheduledFor);
  const setScheduledFor = useFulfilmentStore((state) => state.setScheduledFor);
  const fulfilmentType = useFulfilmentStore((state) => state.fulfilmentType);

  const days = useMemo(() => buildScheduleDays(), []);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [draft, setDraft] = useState<string | null>(scheduledFor);

  const activeDay = days[activeDayIndex];

  const handleConfirm = useCallback(() => {
    setScheduledFor(draft);
    if (router.canGoBack()) router.back();
  }, [draft, setScheduledFor, router]);

  const verb = fulfilmentType === 'delivery' ? 'delivered' : 'ready';

  if (days.length === 0) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Schedule your order" />
        <EmptyState
          icon="calendar-outline"
          title="No slots available"
          message="We're closed for scheduling right now. Place the order as soon as possible instead."
          actionLabel="Go back"
          onActionPress={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['top', 'bottom']} testID="schedule-screen">
      <View style={styles.header}>
        <ScreenHeader title="Schedule your order" />
      </View>

      <View style={styles.body}>
        {/* ASAP option */}
        <Card
          onPress={() => setDraft(null)}
          selected={draft === null}
          accessibilityLabel="As soon as possible"
          testID="schedule-asap"
        >
          <View style={styles.asapRow}>
            <View style={styles.asapIcon}>
              <Ionicons name="flash" size={19} color={colors.primary} />
            </View>
            <View style={styles.asapBody}>
              <Text variant="bodyMedium">As soon as possible</Text>
              <Text variant="caption" color={colors.textSecondary}>
                We start cooking the moment you pay
              </Text>
            </View>
            {draft === null ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            ) : null}
          </View>
        </Card>

        <Text variant="h3">Or pick a time</Text>

        <FlatList
          data={days}
          keyExtractor={(day) => day.dateIso}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayRow}
          renderItem={({ item, index }) => (
            <Chip
              label={item.label}
              selected={index === activeDayIndex}
              onPress={() => setActiveDayIndex(index)}
              testID={`schedule-day-${index}`}
            />
          )}
        />

        <FlatList
          data={activeDay?.slots ?? []}
          keyExtractor={(slot) => slot.iso}
          numColumns={3}
          columnWrapperStyle={styles.slotRow}
          contentContainerStyle={styles.slotList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Chip
              label={item.label}
              selected={draft === item.iso}
              onPress={() => setDraft(item.iso)}
              style={styles.slot}
              testID={`schedule-slot-${item.label}`}
            />
          )}
          ListEmptyComponent={
            <Text variant="caption" color={colors.textMuted} style={styles.noSlots}>
              No slots left today. Try another day.
            </Text>
          }
        />
      </View>

      <View style={styles.footer}>
        <Text variant="caption" color={colors.textSecondary} align="center">
          {draft
            ? `Your order will be ${verb} around ${formatDateTime(draft)}`
            : `Orders are ${verb} in about ${businessRules.defaultPreparationMinutes + (fulfilmentType === 'delivery' ? businessRules.deliveryBufferMinutes : 0)} minutes`}
        </Text>
        <Button label="Confirm time" onPress={handleConfirm} size="lg" testID="schedule-confirm" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  body: { flex: 1, gap: spacing.md, padding: spacing.lg },
  asapRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  asapIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  asapBody: { flex: 1, gap: spacing.xxs },
  dayRow: { gap: spacing.sm },
  slotList: { gap: spacing.sm, paddingBottom: spacing.lg },
  slotRow: { gap: spacing.sm },
  slot: { flex: 1, justifyContent: 'center' },
  noSlots: { paddingVertical: spacing.xl },
  footer: {
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
