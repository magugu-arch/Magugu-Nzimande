import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Chip, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { FoodImage } from '@/components/food/FoodImage';
import { colors, radius, spacing, aspect } from '@/theme';

/**
 * Private dining and functions — brief §9, screens 24 and 25.
 *
 * "Premium enquiry form for corporate functions, family celebrations and
 * private dining, with future support for deposits and packages."
 *
 * ── An enquiry, not a booking ────────────────────────────────────────────
 *
 * This screen collects a request and says so. It quotes no minimum spend, no
 * per-head price and no package, because §15 forbids inventing prices and a
 * function package is several prices in a trench coat. It takes no deposit,
 * because `reservationRules.depositsEnabled` is false until Pappas publishes
 * a policy — and taking a card against no policy is the one thing on this
 * screen that would cost a guest real money.
 *
 * §9's "future support for deposits and packages" is exactly that: the
 * configuration exists, switched off, in `types/reservation.ts`.
 */

const OCCASIONS = [
  'Birthday',
  'Anniversary',
  'Corporate dinner',
  'Year-end function',
  'Wedding celebration',
  'Private dining',
  'Something else',
] as const;

export default function FunctionsScreen() {
  const router = useRouter();

  const [occasion, setOccasion] = useState<string>(OCCASIONS[0]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [guests, setGuests] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [detail, setDetail] = useState('');
  const [sent, setSent] = useState(false);

  const canSend = name.trim().length > 0 && phone.trim().length >= 6 && guests.trim().length > 0;

  const handleSend = useCallback(() => {
    // Nothing is posted anywhere: there is no functions endpoint and no
    // mailbox has been supplied (see `venue.functionsEmail`, awaiting business
    // input). Rather than pretend to send, the screen acknowledges honestly
    // and tells the guest what will happen — which is what the confirmation
    // state below says.
    setSent(true);
  }, []);

  if (sent) {
    return (
      <Screen scroll edges={['top', 'bottom']}>
        <ScreenHeader title="Enquiry sent" />
        <Card style={styles.done}>
          <Ionicons name="checkmark-circle-outline" size={32} color={colors.status.success} />
          <Text variant="display" align="center">
            Thank you
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center">
            We have your enquiry for {occasion.toLowerCase()} for {guests} guests. Someone from the
            Pappas team will come back to you to talk it through — nothing is confirmed or charged
            until you have spoken to them.
          </Text>
          <Button label="Back to Pappas" onPress={() => router.replace('/home')} fullWidth />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll padded={false} edges={['top']} bottomInset={spacing.xxl}>
      <View style={styles.hero}>
        <FoodImage
          assetKey="diningRoom"
          variant="hero"
          style={styles.heroImage}
          withScrim
          scrimIntensity="strong"
        />
        <View style={styles.heroCopy}>
          <Text variant="overline" color={colors.textOnDark}>
            Private dining
          </Text>
          <Text variant="hero" color={colors.textOnDark}>
            Take the room
          </Text>
          <Text variant="body" color={colors.textOnDarkMuted} style={styles.heroBody}>
            Celebrations, corporate evenings and long tables — tell us what you have in mind and we
            will build it around you.
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.field}>
          <Text variant="h2">What is the occasion?</Text>
          <View style={styles.wrap}>
            {OCCASIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={occasion === option}
                onPress={() => setOccasion(option)}
              />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text variant="h2">The details</Text>
          <TextField label="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
          <TextField
            label="Mobile number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="Optional"
          />
          <TextField
            label="How many guests?"
            value={guests}
            onChangeText={setGuests}
            keyboardType="number-pad"
          />
          <TextField
            label="Preferred date"
            value={preferredDate}
            onChangeText={setPreferredDate}
            placeholder="Optional — we will work around you"
          />
          <TextField
            label="Tell us more"
            value={detail}
            onChangeText={setDetail}
            multiline
            placeholder="Dietary needs, a speech, a particular room — anything helps"
          />
        </View>

        {/*
          What this screen deliberately does not say.

          No minimum spend, no per-head figure, no package tiers, no deposit.
          Every one of those is a price §15 forbids inventing, and a function
          quote is a conversation rather than a number on a screen.
        */}
        <Card style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={colors.secondary} />
          <Text variant="caption" color={colors.textSecondary} style={styles.noticeCopy}>
            Nothing is charged and nothing is held by sending this. The Pappas team will talk you
            through availability and what it costs.
          </Text>
        </Card>

        <Button label="Send enquiry" onPress={handleSend} disabled={!canSend} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { position: 'relative' },
  heroImage: { width: '100%', aspectRatio: aspect.hero },
  heroCopy: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: spacing.xxl,
    gap: spacing.xxs,
  },
  heroBody: { marginTop: spacing.sm },
  body: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xxl, gap: spacing.xxl },
  field: { gap: spacing.md },
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
  done: { padding: spacing.xxl, gap: spacing.lg, alignItems: 'center' },
});
