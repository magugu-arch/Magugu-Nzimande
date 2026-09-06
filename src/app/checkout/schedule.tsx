import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Chip, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { businessRules } from '@/constants/config';
import { useNow } from '@/features/system/useNow';
import { isOpeningLater, useFulfilmentStore } from '@/store/fulfilmentStore';
import { colors, radius, spacing } from '@/theme';
import { buildScheduleDays, formatDateTime, formatShortDate } from '@/utils/datetime';
import { clockNotice } from '@/utils/storeClock';

/** Order Scheduling (brief §4). */
export default function ScheduleScreen() {
  const router = useRouter();

  const scheduledFor = useFulfilmentStore((state) => state.scheduledFor);
  const setScheduledFor = useFulfilmentStore((state) => state.setScheduledFor);
  const fulfilmentType = useFulfilmentStore((state) => state.fulfilmentType);
  const store = useFulfilmentStore((state) => state.store);

  // Built against the chosen branch, not a fixed 10:00–21:45. A branch shut on
  // a given day contributes no slots at all, rather than a grid of times
  // nobody will be there for.
  // Ticks, so slots that have gone past drop off a screen left sitting open
  // rather than staying tappable.
  const now = useNow();
  const days = useMemo(() => buildScheduleDays(now, store), [now, store]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [draft, setDraft] = useState<string | null>(scheduledFor);

  const activeDay = days[activeDayIndex];

  const handleConfirm = useCallback(() => {
    setScheduledFor(draft);
    if (router.canGoBack()) router.back();
  }, [draft, setScheduledFor, router]);

  const verb = fulfilmentType === 'delivery' ? 'delivered' : 'ready';

  // Recomputed off the same tick as the slots, so a phone that crosses a
  // daylight-saving boundary while this screen sits open stops claiming a
  // difference that is no longer there.
  const notice = useMemo(() => clockNotice(now), [now]);

  /**
   * No slots is two different situations, and they need different words.
   *
   * A branch that has not opened yet cannot take an order at all, so "place the
   * order as soon as possible instead" is advice nobody can follow — and it was
   * shown for the whole run-up to an opening, which is when most people will
   * meet this screen. A branch that is simply shut for the rest of the horizon
   * genuinely can take one now.
   */
  const notOpenYet = store && isOpeningLater(store, now);

  if (days.length === 0) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Schedule your order" />
        <EmptyState
          icon="calendar-outline"
          title={notOpenYet ? `${store.name} is not open yet` : 'No slots available'}
          message={
            notOpenYet
              ? `It opens on ${formatShortDate(store.opensOn!)}. Choose another branch to order today.`
              : "We're closed for scheduling right now. Place the order as soon as possible instead."
          }
          actionLabel={notOpenYet ? 'Choose another store' : 'Go back'}
          onActionPress={() => (notOpenYet ? router.replace('/checkout/store') : router.back())}
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

        {/*
          Only when the phone and the kitchen disagree, which is why it is a
          nullable string from `clockNotice` rather than a flag checked here.

          Every time on this screen is South African time, because every one of
          them is a claim about a South African kitchen. That is right and it is
          also surprising: a customer in London choosing "18:00" is choosing an
          hour their own phone will never show them. Saying so is the difference
          between a converted time and a wrong one.
        */}
        {notice ? (
          <Text variant="caption" color={colors.textMuted} testID="schedule-clock-notice">
            {notice}
          </Text>
        ) : null}

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
    paddingHorizontal: spacing.gutter,
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
