import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BookingDatePicker } from '@/components/mabu/BookingDatePicker';
import { ContactActions } from '@/components/mabu/Cards';
import { TimeSlotGrid } from '@/components/mabu/TimeSlotGrid';
import {
  Card,
  ErrorState,
  InlineNotice,
  PremiumButton,
  Screen,
  SectionTitle,
  Skeleton,
  Stepper,
  Text,
} from '@/components/ui';
import { formatCalendarDate, formatDateLong, formatTime } from '@/domain/shared/format';
import { addDays, venueDate } from '@/domain/shared/time';
import { NO_AVAILABILITY_MESSAGE } from '@/domain/reservations/service';
import { errorCode, errorMessage } from '@/services/api';
import { useRpc, useRpcMutation } from '@/services/queries';
import { useBookingDraft } from '@/store/bookingDraft';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';
import { track } from '@/utils/analytics';

/**
 * §6 steps 1–3 and §31: date, party size, availability, time. Reached from
 * Home in one tap; the first available date is chosen automatically so the
 * guest sees real times immediately.
 */
export default function Book() {
  const params = useLocalSearchParams<{ waitlist?: string }>();
  const draft = useBookingDraft();
  const signedIn = useSession((s) => !!s.actor);
  const today = venueDate(new Date());
  const policy = useRpc('booking.policy');
  const venue = useRpc('content.venue');
  const [monthStart, setMonthStart] = useState(today);

  const maxDate = addDays(today, policy.data?.maxAdvanceDays ?? 90);
  const window = useMemo(() => {
    const from = monthStart < today ? today : monthStart;
    const [y, m] = from.split('-').map(Number) as [number, number];
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const days = Math.round((Date.parse(end) - Date.parse(from)) / 86_400_000) + 1;
    return { from, days };
  }, [monthStart, today]);

  const tooLarge = !!policy.data && draft.partySize > policy.data.maxPartySize;
  const states = useRpc(
    'booking.dayStates',
    { ...window, partySize: draft.partySize },
    { enabled: !tooLarge },
  );
  const slots = useRpc(
    'booking.search',
    { date: draft.date ?? today, partySize: draft.partySize },
    { enabled: !!draft.date && !tooLarge },
  );

  // A waitlist match deep link: pre-fill the offered table.
  const waitlist = useRpc(
    'waitlist.get',
    { id: params.waitlist ?? '' },
    { enabled: !!params.waitlist && signedIn },
  );
  useEffect(() => {
    const w = waitlist.data;
    if (!w || w.status !== 'matched' || !w.matchedSlotId) return;
    draft.set({ date: w.query.date, partySize: w.query.partySize, waitlistId: w.id, slot: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitlist.data]);
  useEffect(() => {
    const w = waitlist.data;
    if (!w?.matchedSlotId || !slots.data) return;
    const s = slots.data.find((x) => x.slotId === w.matchedSlotId && x.available);
    if (s && draft.slot?.slotId !== s.slotId) draft.set({ slot: s });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.data, waitlist.data]);

  useEffect(() => track('booking_started'), []);

  // Choose the first bookable day once the calendar knows it.
  useEffect(() => {
    if (draft.date || !states.data) return;
    const first = Object.entries(states.data).find(([, s]) => s === 'available')?.[0];
    if (first) draft.set({ date: first });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states.data]);

  const joinWaitlist = useRpcMutation('waitlist.join', ['waitlist.mine']);
  const available = slots.data?.filter((s) => s.available) ?? [];
  const providerDown =
    errorCode(slots.error) === 'NOT_CONFIGURED' || errorCode(states.error) === 'NOT_CONFIGURED';

  return (
    <Screen
      meta={{
        title: 'Book a Table',
        description:
          'Reserve a table at Mábu in Waterfall Wilds, Waterfall City, Midrand. Choose your date, time and party size, and tell us about the occasion.',
        path: '/book',
      }}
      footer={
        draft.slot ? (
          <PremiumButton
            label={`Continue · ${formatTime(draft.slot.startsAt)}`}
            testID="book-continue"
            onPress={() => router.push('/book/details')}
          />
        ) : undefined
      }
    >
      <View style={{ marginTop: spacing.xl, gap: spacing.xs }}>
        <Text variant="eyebrow" color="accent">
          Reservations
        </Text>
        <Text variant="h1" accessibilityRole="header">
          Book your table
        </Text>
      </View>

      {waitlist.data?.status === 'matched' && waitlist.data.matchedStartsAt ? (
        <InlineNotice tone="success" style={{ marginTop: spacing.lg }}>
          {`A table opened up on ${formatDateLong(waitlist.data.matchedStartsAt)} at ${formatTime(waitlist.data.matchedStartsAt)}. It is selected below — continue to reserve it.`}
        </InlineNotice>
      ) : null}

      <SectionTitle eyebrow="Step 1" title="Your party" />
      <Card>
        <Stepper
          label="Guests"
          value={draft.partySize}
          min={policy.data?.minPartySize ?? 1}
          max={(policy.data?.maxPartySize ?? 10) + 1}
          format={(v) =>
            policy.data && v > policy.data.maxPartySize ? `${policy.data.maxPartySize}+` : String(v)
          }
          onChange={(v) =>
            draft.set({
              partySize: v,
              slot: null,
              children: Math.min(draft.children, Math.max(0, v - 1)),
            })
          }
        />
        {!tooLarge && draft.partySize > 1 ? (
          <Stepper
            label="of whom children"
            value={draft.children}
            min={0}
            max={Math.min(policy.data?.maxChildren ?? 6, draft.partySize - 1)}
            onChange={(v) => draft.set({ children: v })}
          />
        ) : null}
      </Card>

      {tooLarge ? (
        <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <Text variant="h3">A larger gathering?</Text>
          <Text variant="body" color="textMuted">
            For more than {policy.data?.maxPartySize} guests, our events team will plan the occasion
            with you — from a long table to exclusive use.
          </Text>
          <PremiumButton
            label="Enquire about private functions"
            onPress={() => router.push('/private-functions')}
          />
        </Card>
      ) : (
        <>
          <SectionTitle eyebrow="Step 2" title="Choose a date" />
          <BookingDatePicker
            today={today}
            maxDate={maxDate}
            selected={draft.date}
            states={states.data}
            onSelect={(date) => draft.set({ date, slot: null })}
            onMonthChange={setMonthStart}
          />

          <SectionTitle
            eyebrow="Step 3"
            title={draft.date ? formatCalendarDate(draft.date) : 'Choose a time'}
          />
          {providerDown && venue.data ? (
            <Card style={{ gap: spacing.md }}>
              <Text variant="body">{errorMessage(slots.error ?? states.error)}</Text>
              <ContactActions
                venue={venue.data}
                subject={`Table for ${draft.partySize}${draft.date ? ` on ${formatCalendarDate(draft.date)}` : ''}`}
              />
            </Card>
          ) : !draft.date ? (
            <Text variant="body" color="textMuted">
              Choose a date to see available times.
            </Text>
          ) : slots.isPending ? (
            <View style={{ gap: spacing.sm }}>
              <Skeleton height={48} />
              <Skeleton height={48} />
              <Skeleton height={48} />
            </View>
          ) : slots.isError ? (
            <ErrorState message={errorMessage(slots.error)} onRetry={() => void slots.refetch()} />
          ) : (
            <>
              {slots.data.length ? (
                <TimeSlotGrid
                  slots={slots.data}
                  selectedId={draft.slot?.slotId}
                  onSelect={(slot) => {
                    track('booking_slot_selected', { partySize: draft.partySize });
                    draft.set({ slot });
                  }}
                />
              ) : (
                <Text variant="body" color="textMuted">
                  We are closed on this day.
                </Text>
              )}
              {slots.data.length && !available.length ? (
                <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
                  <Text variant="body">{NO_AVAILABILITY_MESSAGE}</Text>
                  {joinWaitlist.isSuccess ? (
                    <InlineNotice tone="success">
                      You are on the waitlist. We will let you know the moment a table opens up.
                    </InlineNotice>
                  ) : (
                    <PremiumButton
                      label="Join the waitlist"
                      loading={joinWaitlist.isPending}
                      onPress={() => {
                        if (!signedIn) {
                          router.push('/sign-in?reason=waitlist');
                          return;
                        }
                        joinWaitlist.mutate({ date: draft.date!, partySize: draft.partySize });
                      }}
                    />
                  )}
                  {joinWaitlist.isError ? (
                    <InlineNotice tone="danger">{errorMessage(joinWaitlist.error)}</InlineNotice>
                  ) : null}
                  {venue.data ? (
                    <ContactActions
                      venue={venue.data}
                      subject={`Reservation request · ${formatCalendarDate(draft.date)}`}
                    />
                  ) : null}
                </Card>
              ) : null}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
