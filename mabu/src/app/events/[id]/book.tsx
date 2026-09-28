import { CompletePayment } from '@/components/mabu/CompletePayment';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { ZoomIn, ReduceMotion } from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { DEFAULT_TEST_TOKEN, PaymentChoice } from '@/components/mabu/PaymentChoice';
import {
  Card,
  Header,
  InlineNotice,
  LoadingBlock,
  PremiumButton,
  Screen,
  SectionTitle,
  Stepper,
  Text,
} from '@/components/ui';
import { formatDateLong, formatRand, formatTime } from '@/domain/shared/format';
import { newIdempotencyKey } from '@/domain/shared/ids';
import { errorMessage } from '@/services/api';
import { ACCOUNT_QUERIES, useRpc, useRpcMutation } from '@/services/queries';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import { addToCalendar } from '@/utils/calendar';
import { haptic } from '@/utils/haptics';
import { enter } from '@/utils/motion';

/** §11 Booking: reserve event places, pay, or join the waitlist when full. */
export default function BookEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const signedIn = useSession((s) => !!s.actor);
  const q = useRpc('events.get', { id });
  const [seats, setSeats] = useState(2);
  const [token, setToken] = useState<string>(DEFAULT_TEST_TOKEN);
  const [key, setKey] = useState(newIdempotencyKey);
  const book = useRpcMutation('events.book', [...ACCOUNT_QUERIES, 'events.list', 'events.get']);

  if (!q.data)
    return (
      <Screen header={<Header title="Reserve" />}>
        <LoadingBlock />
      </Screen>
    );
  const e = q.data;
  const waitlist = e.availability === 'waitlist';
  const left = Math.max(0, e.capacity - e.seatsBooked);
  const max = waitlist ? e.maxSeatsPerBooking : Math.min(e.maxSeatsPerBooking, left);
  const total = (e.priceCents ?? 0) * seats;
  const result = book.data;

  if (
    result &&
    (result.status === 'confirmed' ||
      result.status === 'waitlisted' ||
      result.status === 'pending_payment')
  ) {
    const title =
      result.status === 'confirmed'
        ? 'Your place is reserved.'
        : result.status === 'waitlisted'
          ? 'You are on the waitlist.'
          : 'Your places are held.';
    const body =
      result.status === 'confirmed'
        ? `${seats} ${seats === 1 ? 'place' : 'places'} at ${e.title}. Reference ${result.reference}.`
        : result.status === 'waitlisted'
          ? 'We will be in touch the moment a place opens up. You have not been charged.'
          : 'Your payment is being confirmed by the bank. We will let you know as soon as it lands.';
    return (
      <Screen header={<Header title="Reserved" />}>
        <View style={styles.done}>
          <Animated.View
            entering={enter(ZoomIn.springify().damping(14).reduceMotion(ReduceMotion.System))}
            style={styles.tick}
          >
            <Feather
              name={result.status === 'confirmed' ? 'check' : 'clock'}
              size={32}
              color={colors.textOnAccent}
            />
          </Animated.View>
          <Text variant="h1" align="center" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body" color="textMuted" align="center">
            {body}
          </Text>
        </View>
        {result.status === 'pending_payment' ? (
          <CompletePayment
            purpose="event"
            referenceId={result.id}
            autoOpen
            refresh={['events.mine', 'events.get']}
          />
        ) : null}
        {result.status === 'confirmed' ? (
          <PremiumButton
            label="Add to calendar"
            icon="calendar"
            variant="secondary"
            onPress={() =>
              void addToCalendar({
                title: `${e.title} · Mábu`,
                startsAt: e.startsAt,
                endsAt: e.endsAt,
                location: e.room,
              })
            }
          />
        ) : null}
        <PremiumButton
          label="My events"
          variant="ghost"
          style={{ marginTop: spacing.md }}
          onPress={() => router.replace('/profile/bookings?tab=events')}
        />
      </Screen>
    );
  }

  const submit = () => {
    if (!signedIn) {
      router.push('/sign-in?reason=event');
      return;
    }
    book.mutate(
      {
        eventId: e.id,
        seats,
        methodToken: total > 0 && !waitlist ? token : undefined,
        idempotencyKey: key,
      },
      {
        onSuccess: () => haptic.success(),
        // A failed attempt is finished; the next tap is a new intent.
        onError: () => {
          haptic.warn();
          setKey(newIdempotencyKey());
        },
      },
    );
  };

  return (
    <Screen
      meta={{ title: 'Reserve your place', noindex: true }}
      header={<Header title="Reserve" />}
      footer={
        <PremiumButton
          label={
            waitlist ? 'Join the waitlist' : total > 0 ? `Pay ${formatRand(total)}` : 'Reserve'
          }
          loading={book.isPending}
          disabled={max < 1}
          onPress={submit}
          testID="event-pay"
        />
      }
    >
      <Card style={{ marginTop: spacing.lg, gap: spacing.xs }}>
        <Text variant="eyebrow" color="accent">
          {formatDateLong(e.startsAt)} · {formatTime(e.startsAt)}
        </Text>
        <Text variant="h2">{e.title}</Text>
        <Text variant="bodySmall" color="textMuted">
          {e.priceCents === null
            ? 'Price on request — our events team will confirm details.'
            : `${formatRand(e.priceCents)} per guest`}
        </Text>
      </Card>

      <SectionTitle eyebrow="Guests" title="How many places?" />
      <Card>
        <Stepper
          label="Places"
          value={Math.min(seats, Math.max(1, max))}
          min={1}
          max={Math.max(1, max)}
          onChange={setSeats}
        />
      </Card>
      {!waitlist && left <= 6 ? (
        <Text variant="caption" color="warning" style={{ marginTop: spacing.sm }}>
          {left} {left === 1 ? 'place' : 'places'} left
        </Text>
      ) : null}

      {waitlist ? (
        <InlineNotice tone="info" style={{ marginTop: spacing.xl }}>
          This evening is fully reserved. Join the waitlist and we will contact you if places open.
          Nothing is charged now.
        </InlineNotice>
      ) : total > 0 ? (
        <>
          <SectionTitle eyebrow="Payment" title={`Total ${formatRand(total)}`} />
          <PaymentChoice amountCents={total} token={token} onChange={setToken} />
          <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.md }}>
            Cancel up to 48 hours before for a full refund.
          </Text>
        </>
      ) : null}

      {book.isError ? (
        <InlineNotice tone="danger" style={{ marginTop: spacing.xl }}>
          {errorMessage(book.error)}
        </InlineNotice>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: { alignItems: 'center', gap: spacing.lg, marginVertical: spacing.xxl },
  tick: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
