import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { OCCASION_LABEL } from '@/components/mabu/Cards';
import {
  Chip,
  Header,
  PremiumButton,
  Screen,
  SectionTitle,
  Text,
  TextField,
} from '@/components/ui';
import type { Occasion } from '@/domain/reservations/types';
import { formatDateLong, formatTime } from '@/domain/shared/format';
import { useRpc } from '@/services/queries';
import { useBookingDraft } from '@/store/bookingDraft';
import { spacing } from '@/theme';

const OCCASIONS: Occasion[] = [
  'birthday',
  'anniversary',
  'business',
  'date-night',
  'celebration',
  'other',
];

/** §6 steps 4–6: seating preference, occasion, and notes. Everything optional. */
export default function BookingDetails() {
  const draft = useBookingDraft();
  const policy = useRpc('booking.policy');
  if (!draft.slot) return <Redirect href="/book" />;

  return (
    <Screen
      header={<Header title="Your occasion" />}
      footer={
        <PremiumButton
          label="Continue"
          onPress={() => router.push('/book/review')}
          testID="details-continue"
        />
      }
    >
      <Text variant="body" color="textMuted" style={{ marginTop: spacing.md }}>
        Table for {draft.partySize} · {formatDateLong(draft.slot.startsAt)} at{' '}
        {formatTime(draft.slot.startsAt)}
      </Text>

      <SectionTitle eyebrow="Optional" title="Is it a special occasion?" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {OCCASIONS.map((o) => (
          <Chip
            key={o}
            label={OCCASION_LABEL[o]!}
            selected={draft.occasion === o}
            onPress={() => draft.set({ occasion: draft.occasion === o ? undefined : o })}
          />
        ))}
      </View>
      {draft.occasion ? (
        <View style={{ marginTop: spacing.lg }}>
          <TextField
            label="Tell us more"
            placeholder={
              draft.occasion === 'birthday'
                ? 'Whose birthday? A candle on dessert?'
                : 'Anything we should know'
            }
            value={draft.occasionNote}
            onChangeText={(occasionNote) => draft.set({ occasionNote })}
            maxLength={200}
          />
        </View>
      ) : null}

      {policy.data?.seatingAreas.length ? (
        <>
          <SectionTitle eyebrow="Optional" title="Seating preference" />
          <View style={{ gap: spacing.sm }}>
            {policy.data.seatingAreas
              .filter((a) => !draft.slot?.seatingAreas || draft.slot.seatingAreas.includes(a.id))
              .map((a) => (
                <Chip
                  key={a.id}
                  label={`${a.label} — ${a.description}`}
                  selected={draft.seatingPreference === a.id}
                  onPress={() =>
                    draft.set({
                      seatingPreference: draft.seatingPreference === a.id ? undefined : a.id,
                    })
                  }
                />
              ))}
          </View>
          <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.sm }}>
            We will do our best to seat you where you prefer; it cannot always be guaranteed.
          </Text>
        </>
      ) : null}

      <SectionTitle eyebrow="Optional" title="Notes for the team" />
      <TextField
        label="Dietary needs"
        placeholder="Allergies, intolerances, preferences"
        value={draft.dietaryNotes}
        onChangeText={(dietaryNotes) => draft.set({ dietaryNotes })}
        multiline
        maxLength={500}
      />
      <TextField
        label="Accessibility"
        placeholder="Step-free access, seating needs"
        value={draft.accessibilityNotes}
        onChangeText={(accessibilityNotes) => draft.set({ accessibilityNotes })}
        multiline
        maxLength={500}
      />
      <TextField
        label="Special requests"
        value={draft.specialRequest}
        onChangeText={(specialRequest) => draft.set({ specialRequest })}
        multiline
        maxLength={500}
      />
    </Screen>
  );
}
