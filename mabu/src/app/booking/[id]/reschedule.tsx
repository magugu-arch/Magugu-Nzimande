import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BookingDatePicker } from '@/components/mabu/BookingDatePicker';
import { TimeSlotGrid } from '@/components/mabu/TimeSlotGrid';
import {
  Card,
  Header,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  Screen,
  SectionTitle,
  Skeleton,
  Stepper,
  Text,
} from '@/components/ui';
import type { ReservationSlot } from '@/domain/reservations/types';
import { formatDateLong, formatTime } from '@/domain/shared/format';
import { newIdempotencyKey } from '@/domain/shared/ids';
import { addDays, venueDate } from '@/domain/shared/time';
import { NO_AVAILABILITY_MESSAGE } from '@/domain/reservations/service';
import { errorMessage } from '@/services/api';
import { ACCOUNT_QUERIES, useRpc, useRpcMutation } from '@/services/queries';
import { spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

/** §30 Manage booking: reschedule to a provider-confirmed time, optionally with a new party size. */
export default function Reschedule() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useRpc('booking.get', { id });
  const policy = useRpc('booking.policy');
  const today = venueDate(new Date());
  const [date, setDate] = useState<string | null>(null);
  const [party, setParty] = useState<number | null>(null);
  const [slot, setSlot] = useState<ReservationSlot | null>(null);
  const [monthStart, setMonthStart] = useState(today);
  const [key] = useState(newIdempotencyKey);

  const current = booking.data?.reservation;
  const partySize = party ?? current?.partySize ?? 2;
  const selectedDate = date ?? (current ? venueDate(current.startsAt) : today);
  const window = useMemo(() => {
    const from = monthStart < today ? today : monthStart;
    const [y, m] = from.split('-').map(Number) as [number, number];
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { from, days: Math.round((Date.parse(end) - Date.parse(from)) / 86_400_000) + 1 };
  }, [monthStart, today]);
  const states = useRpc('booking.dayStates', { ...window, partySize }, { enabled: !!current });
  const slots = useRpc('booking.search', { date: selectedDate, partySize }, { enabled: !!current });
  const move = useRpcMutation('booking.reschedule', [
    ...ACCOUNT_QUERIES,
    'booking.history',
    'booking.search',
    'booking.dayStates',
  ]);

  if (!current) {
    return (
      <Screen header={<Header title="Change booking" />}>
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen
      header={<Header title="Change booking" />}
      footer={
        slot ? (
          <PremiumButton
            label={`Move to ${formatTime(slot.startsAt)}`}
            loading={move.isPending}
            onPress={() =>
              move.mutate(
                { id, slotId: slot.slotId, partySize, idempotencyKey: key },
                {
                  onSuccess: () => {
                    haptic.success();
                    router.back();
                  },
                },
              )
            }
          />
        ) : undefined
      }
    >
      <Text variant="body" color="textMuted" style={{ marginTop: spacing.lg }}>
        Currently {formatDateLong(current.startsAt)} at {formatTime(current.startsAt)} for{' '}
        {current.partySize}.
      </Text>
      <SectionTitle eyebrow="Party" title="How many guests?" />
      <Card>
        <Stepper
          label="Guests"
          value={partySize}
          min={policy.data?.minPartySize ?? 1}
          max={policy.data?.maxPartySize ?? 10}
          onChange={(v) => {
            setParty(v);
            setSlot(null);
          }}
        />
      </Card>
      <SectionTitle eyebrow="Date" title="Choose a new date" />
      <BookingDatePicker
        today={today}
        maxDate={addDays(today, policy.data?.maxAdvanceDays ?? 90)}
        selected={selectedDate}
        states={states.data}
        onSelect={(d) => {
          setDate(d);
          setSlot(null);
        }}
        onMonthChange={setMonthStart}
      />
      <SectionTitle eyebrow="Time" title="Available times" />
      {slots.isPending ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={48} />
          <Skeleton height={48} />
        </View>
      ) : slots.isError ? (
        <InlineNotice tone="danger">{errorMessage(slots.error)}</InlineNotice>
      ) : slots.data.some((s) => s.available) ? (
        <TimeSlotGrid slots={slots.data} selectedId={slot?.slotId} onSelect={setSlot} />
      ) : (
        <Text variant="body" color="textMuted">
          {slots.data.length ? NO_AVAILABILITY_MESSAGE : 'We are closed on this day.'}
        </Text>
      )}
      {move.isError ? (
        <InlineNotice tone="danger" style={{ marginTop: spacing.lg }}>
          {errorMessage(move.error)}
        </InlineNotice>
      ) : null}
    </Screen>
  );
}
