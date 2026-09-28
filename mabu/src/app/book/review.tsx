import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { OCCASION_LABEL, ContactActions } from '@/components/mabu/Cards';
import {
  Card,
  Header,
  InlineNotice,
  PremiumButton,
  Screen,
  SectionTitle,
  Text,
  TextField,
} from '@/components/ui';
import { formatDateLong, formatRand, formatTime } from '@/domain/shared/format';
import { validateContact, type FieldErrors, type GuestContact } from '@/domain/shared/validation';
import { errorCode, errorMessage } from '@/services/api';
import { ACCOUNT_QUERIES, useRpc, useRpcMutation } from '@/services/queries';
import { useBookingDraft } from '@/store/bookingDraft';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';
import { haptic } from '@/utils/haptics';

/**
 * §6 steps 7–8 and §31: confirm guest details, read the policy, confirm.
 * Guests sign in with a one-time code first — it proves the email is theirs
 * and is what lets them manage the booking afterwards.
 */
export default function BookingReview() {
  const draft = useBookingDraft();
  const session = useSession();
  const client = useQueryClient();
  const policy = useRpc('booking.policy');
  const venue = useRpc('content.venue');
  const me = useRpc('me.get', undefined, { enabled: !!session.actor });
  // Validate live once the guest has tried to confirm, so an error clears the
  // moment it is fixed — including when profile autofill lands a beat late.
  const [submitted, setSubmitted] = useState(false);
  // The form's values, falling back to the saved profile: the autofill effect
  // lands a render after the profile does, and a quick tap must not beat it.
  const contact: GuestContact = {
    name: draft.name || me.data?.name || '',
    email: draft.email || me.data?.email || '',
    phone: draft.phone || me.data?.phone || '',
  };
  const errors: FieldErrors<GuestContact> = submitted ? validateContact(contact) : {};
  const create = useRpcMutation('booking.create', [
    ...ACCOUNT_QUERIES,
    'booking.search',
    'booking.dayStates',
  ]);

  // Autofill from the profile (§30 "optional profile autofill").
  useEffect(() => {
    if (!me.data) return;
    draft.set({
      name: draft.name || me.data.name,
      email: draft.email || me.data.email,
      phone: draft.phone || me.data.phone,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data]);

  if (!draft.slot) return <Redirect href="/book" />;
  const slot = draft.slot;
  const p = policy.data;
  const deposit =
    p?.deposit.enabled && draft.partySize >= p.deposit.appliesFromPartySize
      ? p.deposit.perPersonCents * draft.partySize
      : 0;

  const confirm = () => {
    if (!session.actor) {
      router.push('/sign-in?reason=booking');
      return;
    }
    setSubmitted(true);
    if (Object.keys(validateContact(contact)).length) {
      haptic.warn();
      return;
    }
    create.mutate(
      {
        slotId: slot.slotId,
        partySize: draft.partySize,
        children: draft.children,
        guest: contact,
        occasion: draft.occasion,
        occasionNote: draft.occasionNote || undefined,
        seatingPreference: draft.seatingPreference,
        dietaryNotes: draft.dietaryNotes || undefined,
        accessibilityNotes: draft.accessibilityNotes || undefined,
        specialRequest: draft.specialRequest || undefined,
        waitlistId: draft.waitlistId,
        idempotencyKey: draft.idempotencyKey,
      },
      {
        onSuccess: (r) => {
          haptic.success();
          void client.invalidateQueries({ queryKey: ['booking.search'] });
          draft.reset();
          if (router.canDismiss()) router.dismissAll();
          router.push(`/booking/${r.id}?new=1`);
        },
        onError: (e) => {
          haptic.warn();
          // The slot went while the guest was reading: a new attempt is a new intent.
          if (errorCode(e) === 'SLOT_UNAVAILABLE') draft.rekey();
        },
      },
    );
  };

  return (
    <Screen
      header={<Header title="Review" />}
      footer={
        <PremiumButton
          label={
            session.actor
              ? deposit
                ? 'Confirm & pay deposit'
                : 'Confirm booking'
              : 'Continue — confirm your email'
          }
          // Held until a signed-in guest's saved details have filled the form.
          loading={create.isPending || (!!session.actor && me.isPending)}
          onPress={confirm}
          testID="review-confirm"
        />
      }
    >
      <Card style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Text variant="eyebrow" color="accent">
          Your table
        </Text>
        <Text variant="h2">
          {formatDateLong(slot.startsAt)} · {formatTime(slot.startsAt)}
        </Text>
        <Text variant="body" color="textMuted">
          Table for {draft.partySize}
          {draft.children ? ` (incl. ${draft.children} children)` : ''}
          {draft.occasion ? ` · ${OCCASION_LABEL[draft.occasion]}` : ''}
          {draft.seatingPreference
            ? ` · ${p?.seatingAreas.find((a) => a.id === draft.seatingPreference)?.label ?? ''}`
            : ''}
        </Text>
        <PremiumButton
          label="Change"
          variant="ghost"
          compact
          style={{ alignSelf: 'flex-start' }}
          onPress={() => router.navigate('/book')}
        />
      </Card>

      <SectionTitle eyebrow="Guest details" title="Who is the booking for?" />
      <TextField
        label="Name"
        value={draft.name}
        onChangeText={(name) => draft.set({ name })}
        autoComplete="name"
        textContentType="name"
        error={errors.name}
      />
      <TextField
        label="Mobile"
        value={draft.phone}
        onChangeText={(phone) => draft.set({ phone })}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        error={errors.phone}
        hint="For a call if we need to reach you on the day."
      />
      <TextField
        label="Email"
        value={draft.email}
        onChangeText={(email) => draft.set({ email })}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        error={errors.email}
      />

      {p ? (
        <>
          <SectionTitle eyebrow="Before you confirm" title="Our booking policy" />
          <View style={{ gap: spacing.md }}>
            <Text variant="body" color="textMuted">
              {p.cancellationPolicyText}
            </Text>
            <Text variant="body" color="textMuted">
              {p.noShowPolicyText}
            </Text>
            {deposit ? (
              <InlineNotice tone="warning">
                {`Parties of ${p.deposit.appliesFromPartySize} or more secure the table with a deposit of ${formatRand(p.deposit.perPersonCents)} per guest (${formatRand(deposit)}), deducted from your bill. Your booking is held until it is paid.`}
              </InlineNotice>
            ) : null}
          </View>
        </>
      ) : null}

      {create.isError ? (
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <InlineNotice tone="danger">{errorMessage(create.error)}</InlineNotice>
          {errorCode(create.error) === 'SLOT_UNAVAILABLE' ? (
            <PremiumButton
              label="Choose another time"
              variant="secondary"
              onPress={() => router.navigate('/book')}
            />
          ) : venue.data ? (
            <ContactActions venue={venue.data} />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
