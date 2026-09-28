import { CompletePayment } from '@/components/mabu/CompletePayment';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, ZoomIn, ReduceMotion } from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import {
  ContactActions,
  DirectionsCard,
  OCCASION_LABEL,
  ReservationSummary,
} from '@/components/mabu/Cards';
import { DEFAULT_TEST_TOKEN, PaymentChoice } from '@/components/mabu/PaymentChoice';
import {
  Card,
  Chip,
  ErrorState,
  Header,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  Screen,
  SectionTitle,
  Text,
  TextField,
} from '@/components/ui';
import type { Occasion } from '@/domain/reservations/types';
import { formatDateLong, formatDateShort, formatTime } from '@/domain/shared/format';
import { newIdempotencyKey } from '@/domain/shared/ids';
import { errorMessage } from '@/services/api';
import { ACCOUNT_QUERIES, useRpc, useRpcMutation } from '@/services/queries';
import { colors, spacing } from '@/theme';
import { addToCalendar } from '@/utils/calendar';
import { haptic } from '@/utils/haptics';
import { shareText } from '@/utils/linking';
import { enter } from '@/utils/motion';

const EVENT_LABEL: Record<string, string> = {
  created: 'Booking made',
  confirmed: 'Confirmed',
  amended: 'Details updated',
  rescheduled: 'Moved',
  cancelled: 'Cancelled',
  completed: 'Visit completed',
  'no-show': 'Marked as missed',
  'deposit-requested': 'Deposit requested',
  'deposit-paid': 'Deposit received',
  'deposit-failed': 'Deposit not completed',
};

/** §6 steps 8–9, §30: confirmation and manage booking. */
export default function BookingScreen() {
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new?: string }>();
  const q = useRpc('booking.get', { id });
  const history = useRpc('booking.history', { id });
  const venue = useRpc('content.venue');
  const [mode, setMode] = useState<'view' | 'amend' | 'cancel' | 'pay'>('view');
  const [payToken, setPayToken] = useState<string>(DEFAULT_TEST_TOKEN);
  const [payKey, setPayKey] = useState(newIdempotencyKey);
  const [calendarNote, setCalendarNote] = useState<string | null>(null);

  const refresh = [
    ...ACCOUNT_QUERIES,
    'booking.history',
    'booking.search',
    'booking.dayStates',
  ] as const;
  const cancel = useRpcMutation('booking.cancel', [...refresh]);
  const pay = useRpcMutation('booking.payDeposit', [...refresh]);

  if (q.isPending) {
    return (
      <Screen header={<Header title="Your booking" />}>
        <LoadingBlock />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen header={<Header title="Your booking" />}>
        <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
      </Screen>
    );
  }

  const { reservation: r, canChange, policy, lateCancellation: late } = q.data;
  const active = ['confirmed', 'rescheduled', 'requested'].includes(r.status);
  const needsDeposit = r.depositStatus === 'pending' || r.depositStatus === 'failed';
  const location = venue.data
    ? `${venue.data.name}, ${venue.data.addressLines.join(', ')}`
    : 'Mábu Restaurant, Waterfall Wilds, Midrand';

  return (
    <Screen
      meta={{ title: 'Your booking', noindex: true }}
      header={
        <Header
          title={isNew ? 'Confirmed' : 'Your booking'}
          onBack={isNew ? () => router.replace('/home') : undefined}
        />
      }
    >
      {isNew && r.status === 'confirmed' ? (
        <View style={styles.confirmed}>
          <Animated.View
            entering={enter(ZoomIn.springify().damping(14).reduceMotion(ReduceMotion.System))}
            style={styles.tick}
          >
            <Feather name="check" size={34} color={colors.textOnAccent} />
          </Animated.View>
          <Animated.View
            entering={enter(FadeIn.delay(250).duration(600).reduceMotion(ReduceMotion.System))}
            style={{ gap: spacing.sm }}
          >
            <Text variant="h1" align="center" accessibilityRole="header">
              Your table at Mábu is reserved.
            </Text>
            <Text variant="body" color="textMuted" align="center">
              A confirmation is on its way to {r.guestEmail}. We look forward to welcoming you.
            </Text>
          </Animated.View>
        </View>
      ) : (
        <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
          <Text variant="eyebrow" color="accent">
            {r.status === 'requested'
              ? 'Held — awaiting deposit'
              : r.status === 'cancelled'
                ? 'Cancelled'
                : r.status === 'completed'
                  ? 'Visited'
                  : 'Reserved'}
          </Text>
          <Text variant="h1" accessibilityRole="header">
            {formatDateShort(r.startsAt)} · {formatTime(r.startsAt)}
          </Text>
        </View>
      )}

      {needsDeposit && active ? (
        <Card style={{ marginTop: spacing.xl, gap: spacing.md, borderColor: colors.warning }}>
          <Text variant="h3">Secure your table</Text>
          <Text variant="body" color="textMuted">
            Your table is held. Complete the deposit to confirm it.
          </Text>
          {r.depositStatus === 'failed' ? (
            <InlineNotice tone="danger">
              The last payment did not go through. No money was taken.
            </InlineNotice>
          ) : null}
          <PaymentChoice amountCents={r.depositCents} token={payToken} onChange={setPayToken} />
          <PremiumButton
            label="Pay deposit"
            loading={pay.isPending}
            onPress={() =>
              pay.mutate(
                { id: r.id, methodToken: payToken, idempotencyKey: payKey },
                {
                  onSettled: () => setPayKey(newIdempotencyKey()),
                  onSuccess: () => haptic.success(),
                },
              )
            }
          />
          {pay.isError ? (
            <InlineNotice tone="danger">{errorMessage(pay.error)}</InlineNotice>
          ) : null}
          <CompletePayment
            purpose="deposit"
            referenceId={r.id}
            autoOpen={!!pay.data}
            refresh={['booking.get', 'booking.mine']}
          />
          {pay.data?.depositStatus === 'pending' ? (
            <InlineNotice tone="info">
              Your payment is being confirmed by the bank. We will let you know as soon as it lands.
            </InlineNotice>
          ) : null}
        </Card>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <ReservationSummary reservation={r} venue={venue.data} />
      </View>

      {r.dietaryNotes || r.accessibilityNotes || r.specialRequest || r.occasionNote ? (
        <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Text variant="eyebrow" color="textMuted">
            Your notes
          </Text>
          {[r.occasionNote, r.dietaryNotes, r.accessibilityNotes, r.specialRequest]
            .filter(Boolean)
            .map((n) => (
              <Text key={n} variant="body">
                {n}
              </Text>
            ))}
        </Card>
      ) : null}

      {active ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <PremiumButton
            label="Add to calendar"
            icon="calendar"
            variant="secondary"
            onPress={async () => {
              const result = await addToCalendar({
                title: `Dinner at Mábu · table for ${r.partySize}`,
                startsAt: r.startsAt,
                endsAt:
                  r.endsAt ??
                  new Date(new Date(r.startsAt).getTime() + 2 * 3_600_000).toISOString(),
                location,
                notes: `Reference ${r.reference}`,
              });
              setCalendarNote(result === 'added' ? 'Added to your calendar.' : null);
            }}
          />
          {calendarNote ? <InlineNotice tone="success">{calendarNote}</InlineNotice> : null}
          <PremiumButton
            label="Share with your party"
            icon="share"
            variant="secondary"
            onPress={() =>
              void shareText(
                'Mábu',
                `We have a table at Mábu on ${formatDateLong(r.startsAt)} at ${formatTime(r.startsAt)}. Mábu Restaurant, Waterfall Wilds, Midrand.`,
              )
            }
          />
        </View>
      ) : null}

      {active && venue.data ? (
        <View style={{ marginTop: spacing.xl }}>
          <DirectionsCard venue={venue.data} />
        </View>
      ) : null}

      {active ? (
        <>
          <SectionTitle eyebrow="Manage" title="Need to change something?" />
          {!canChange ? (
            <View style={{ gap: spacing.md }}>
              <Text variant="body" color="textMuted">
                Within {policy.amendCutoffHours} hours of your booking our team makes any changes
                personally — please get in touch.
              </Text>
              {venue.data ? (
                <ContactActions venue={venue.data} subject={`Booking ${r.reference}`} />
              ) : null}
            </View>
          ) : mode === 'amend' ? (
            <AmendForm id={r.id} initial={r} onDone={() => setMode('view')} />
          ) : mode === 'cancel' ? (
            <Card style={{ gap: spacing.md }}>
              <Text variant="h3">Cancel this booking?</Text>
              <Text variant="body" color="textMuted">
                {late
                  ? `Your booking is within ${policy.cancellationCutoffHours} hours, so this will be recorded as a late cancellation. ${policy.cancellationPolicyText}`
                  : 'You are cancelling in good time — thank you for letting us know.'}
              </Text>
              <PremiumButton
                label="Yes, cancel my booking"
                variant="danger"
                loading={cancel.isPending}
                onPress={() =>
                  cancel.mutate(
                    { id: r.id, idempotencyKey: newIdempotencyKey() },
                    { onSuccess: () => setMode('view') },
                  )
                }
              />
              <PremiumButton
                label="Keep my booking"
                variant="ghost"
                onPress={() => setMode('view')}
              />
              {cancel.isError ? (
                <InlineNotice tone="danger">{errorMessage(cancel.error)}</InlineNotice>
              ) : null}
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <PremiumButton
                label="Change date or time"
                variant="secondary"
                onPress={() => router.push(`/booking/${r.id}/reschedule`)}
              />
              <PremiumButton
                label="Update occasion or notes"
                variant="secondary"
                onPress={() => setMode('amend')}
              />
              <PremiumButton
                label="Cancel booking"
                variant="ghost"
                onPress={() => setMode('cancel')}
              />
            </View>
          )}
        </>
      ) : r.status === 'cancelled' ? (
        <View style={{ marginTop: spacing.xl }}>
          <PremiumButton label="Book another table" onPress={() => router.navigate('/book')} />
        </View>
      ) : null}

      {history.data?.length ? (
        <>
          <SectionTitle eyebrow="Record" title="History" />
          <View accessibilityRole="list">
            {history.data
              .filter((e) => EVENT_LABEL[e.eventType])
              .map((e) => (
                <View key={e.id} style={styles.historyRow}>
                  <View style={styles.historyDot} />
                  <Text variant="bodySmall" style={{ flex: 1 }}>
                    {EVENT_LABEL[e.eventType]}
                  </Text>
                  <Text variant="caption" color="textSubtle">
                    {formatDateShort(e.occurredAt)} {formatTime(e.occurredAt)}
                  </Text>
                </View>
              ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function AmendForm({
  id,
  initial,
  onDone,
}: {
  id: string;
  initial: {
    occasion?: Occasion;
    occasionNote?: string;
    dietaryNotes?: string;
    accessibilityNotes?: string;
    specialRequest?: string;
  };
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    occasion: initial.occasion,
    occasionNote: initial.occasionNote ?? '',
    dietaryNotes: initial.dietaryNotes ?? '',
    accessibilityNotes: initial.accessibilityNotes ?? '',
    specialRequest: initial.specialRequest ?? '',
  });
  const [key] = useState(newIdempotencyKey);
  const amend = useRpcMutation('booking.amend', ['booking.get', 'booking.history', 'booking.mine']);
  return (
    <Card>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.lg,
        }}
      >
        {(Object.keys(OCCASION_LABEL) as Occasion[]).map((o) => (
          <Chip
            key={o}
            label={OCCASION_LABEL[o]!}
            selected={form.occasion === o}
            onPress={() => setForm({ ...form, occasion: form.occasion === o ? undefined : o })}
          />
        ))}
      </View>
      <TextField
        label="Occasion note"
        value={form.occasionNote}
        onChangeText={(occasionNote) => setForm({ ...form, occasionNote })}
      />
      <TextField
        label="Dietary needs"
        value={form.dietaryNotes}
        multiline
        onChangeText={(dietaryNotes) => setForm({ ...form, dietaryNotes })}
      />
      <TextField
        label="Accessibility"
        value={form.accessibilityNotes}
        multiline
        onChangeText={(accessibilityNotes) => setForm({ ...form, accessibilityNotes })}
      />
      <TextField
        label="Special requests"
        value={form.specialRequest}
        multiline
        onChangeText={(specialRequest) => setForm({ ...form, specialRequest })}
      />
      {amend.isError ? (
        <InlineNotice tone="danger" style={{ marginBottom: spacing.md }}>
          {errorMessage(amend.error)}
        </InlineNotice>
      ) : null}
      <PremiumButton
        label="Save changes"
        loading={amend.isPending}
        onPress={() =>
          amend.mutate({ id, patch: form, idempotencyKey: key }, { onSuccess: onDone })
        }
      />
      <PremiumButton label="Never mind" variant="ghost" onPress={onDone} />
    </Card>
  );
}

const styles = StyleSheet.create({
  confirmed: { alignItems: 'center', gap: spacing.xl, marginTop: spacing.xxl },
  tick: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  historyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
});
