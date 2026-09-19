import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Chip, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { requestReservation } from '@/services/reservationService';
import { useReservationStore } from '@/store/reservationStore';
import type { ReservationOccasion, SeatingPreference } from '@/types/reservation';
import { colors, radius, spacing } from '@/theme';

/**
 * Reserve, step two — seating, occasion and who is coming. Brief §7.
 *
 * The second half of the journey: the choices that do not constrain each
 * other, and the contact details Pappas needs to come back to the guest.
 *
 * ── Why the required fields are so few ───────────────────────────────────
 *
 * A name and a phone number. That is what a restaurant needs to hold a table
 * and to ring you if something changes; everything else on this screen is
 * optional and says so.
 *
 * A booking form that demands an email address, a surname and a marketing
 * consent before it will take a reservation is a form, not a concierge.
 * §7 asks to "keep the form visually light", and the lightest a form gets is
 * fewer fields.
 */

const SEATING: { value: SeatingPreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] =
  [
    { value: 'no-preference', label: 'No preference', icon: 'checkmark-circle-outline' },
    { value: 'dining-room', label: 'Dining room', icon: 'restaurant-outline' },
    { value: 'window', label: 'By the window', icon: 'sunny-outline' },
    { value: 'bar', label: 'At the bar', icon: 'wine-outline' },
    { value: 'outdoor', label: 'Outside', icon: 'leaf-outline' },
    { value: 'quiet', label: 'Somewhere quiet', icon: 'volume-low-outline' },
  ];

const OCCASIONS: { value: ReservationOccasion; label: string }[] = [
  { value: 'none', label: 'Just dinner' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'celebration', label: 'Celebration' },
  { value: 'date-night', label: 'Date night' },
  { value: 'business', label: 'Business' },
];

export default function ReservationDetailsScreen() {
  const router = useRouter();
  const draft = useReservationStore((state) => state.draft);
  const setSeating = useReservationStore((state) => state.setSeating);
  const setOccasion = useReservationStore((state) => state.setOccasion);
  const setNotes = useReservationStore((state) => state.setNotes);
  const setDetails = useReservationStore((state) => state.setDetails);

  const [firstName, setFirstName] = useState(draft.firstName ?? '');
  const [lastName, setLastName] = useState(draft.lastName ?? '');
  const [phone, setPhone] = useState(draft.phone ?? '');
  const [email, setEmail] = useState(draft.email ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: requestReservation,
    onSuccess: (reservation) => {
      // The draft has done its job. Clearing it means a guest who books again
      // starts fresh rather than editing the booking they just made.
      useReservationStore.getState().reset();
      router.replace(`/reserve/${reservation.id}`);
    },
    onError: (cause: Error) => setError(cause.message),
  });

  const handleSubmit = useCallback(() => {
    setError(null);
    const details = { firstName, lastName, phone, email };
    setDetails(details);
    submit.mutate({ ...draft, ...details });
  }, [draft, firstName, lastName, phone, email, setDetails, submit]);

  const canSubmit = firstName.trim().length > 0 && phone.trim().length >= 6;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <ScreenHeader title="A few details" subtitle="So we can look after you properly" />

      <View style={styles.body}>
        <Field
          title="Where would you like to sit?"
          hint="A preference, not a promise — we will do our best on the night."
        >
          <View style={styles.wrap}>
            {SEATING.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                icon={option.icon}
                selected={(draft.seating ?? 'no-preference') === option.value}
                onPress={() => setSeating(option.value)}
              />
            ))}
          </View>
        </Field>

        <Field
          title="Is this a special occasion?"
          hint="Optional. Tell us and we will make something of it."
        >
          <View style={styles.wrap}>
            {OCCASIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={(draft.occasion ?? 'none') === option.value}
                onPress={() => setOccasion(option.value)}
              />
            ))}
          </View>
        </Field>

        <Field
          title="Anything we should know?"
          hint="Allergies, access needs, a pushchair, a quiet corner — anything at all."
        >
          <TextField
            label="Notes for the restaurant"
            value={draft.notes ?? ''}
            onChangeText={setNotes}
            placeholder="Optional"
            multiline
          />
        </Field>

        <Field title="Who shall we put the table under?">
          <TextField
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            textContentType="givenName"
          />
          <TextField
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            textContentType="familyName"
            placeholder="Optional"
          />
          <TextField
            label="Mobile number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            helperText="So we can reach you if anything changes."
          />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
            placeholder="Optional"
            helperText="For your confirmation, if you would like one."
          />
        </Field>

        {/*
          The promise this screen is careful not to make.

          There is no booking system behind this app yet, and §15 forbids
          inventing customer promises. So the button says "Send request", not
          "Book table", and the note below says what actually happens next. A
          guest who reads "Table confirmed" and arrives to find no table has
          been failed by the app, not by the restaurant.
        */}
        <Card style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={colors.secondary} />
          <Text variant="caption" color={colors.textSecondary} style={styles.noticeCopy}>
            We will send this to the restaurant and come back to you to confirm. Nothing is charged,
            and you can cancel any time from the app.
          </Text>
        </Card>

        {error ? (
          <Text variant="caption" color={colors.status.error}>
            {error}
          </Text>
        ) : null}

        <Button
          label="Send request"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submit.isPending}
          fullWidth
        />
      </View>
    </Screen>
  );
}

function Field({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text variant="h2">{title}</Text>
      {hint ? (
        <Text variant="caption" color={colors.textMuted}>
          {hint}
        </Text>
      ) : null}
      <View style={styles.fieldBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xxl, paddingBottom: spacing.xxl },
  field: { gap: spacing.xxs },
  fieldBody: { marginTop: spacing.md, gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.secondarySoft,
    borderColor: colors.secondarySoft,
  },
  noticeCopy: { flex: 1 },
});
