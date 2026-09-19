import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Screen, Text } from '@/components/ui';
import { FoodImage } from '@/components/food/FoodImage';
import { colors, radius, spacing, aspect } from '@/theme';

/**
 * Gift cards — brief §9, screen 23.
 *
 * "Purchase, recipient, message, amount and digital delivery. Build for
 * future corporate bulk purchase."
 *
 * ── Why this screen does not sell anything ───────────────────────────────
 *
 * A gift card is a financial instrument. Selling one means taking money now
 * against a promise to honour it later, which needs, at minimum:
 *
 *   - denominations Pappas has set
 *   - an expiry policy, and its legal position under the CPA
 *   - a redemption mechanism the restaurant's till can actually read
 *   - a liability account the value sits in until it is spent
 *   - a merchant agreement covering all of the above
 *
 * None of those exists. §15 forbids inventing prices and customer promises,
 * and a gift card is both at once — a screen offering "R250 · R500 · R1 000"
 * would invent three denominations and a redemption promise in one row of
 * chips, against a card nobody can actually spend.
 *
 * So the screen states the position plainly and offers the thing Pappas *can*
 * honour today: a table, booked. That is a better answer than a checkout that
 * takes a stranger's money for a voucher with nothing behind it.
 *
 * The shape §9 asks for — recipient, message, amount, digital delivery,
 * corporate bulk — is documented here rather than half-built, so whoever
 * picks this up knows what it has to become.
 */
export default function GiftCardsScreen() {
  const router = useRouter();

  return (
    <Screen scroll padded={false} edges={['top']} bottomInset={spacing.xxl}>
      <View style={styles.hero}>
        <FoodImage
          assetKey="desserts"
          variant="hero"
          style={styles.heroImage}
          withScrim
          scrimIntensity="strong"
        />
        <View style={styles.heroCopy}>
          <Text variant="overline" color={colors.textOnDark}>
            Gift cards
          </Text>
          <Text variant="hero" color={colors.textOnDark}>
            Give an evening
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Card style={styles.notice}>
          <Ionicons name="time-outline" size={24} color={colors.accentInk} />
          <View style={styles.noticeCopy}>
            <Text variant="h3">Coming soon</Text>
            <Text variant="body" color={colors.textSecondary}>
              Pappas gift cards are being set up. We are not taking payment for one until the
              restaurant can honour it at the table — denominations, expiry and redemption are all
              still being agreed.
            </Text>
          </View>
        </Card>

        <View style={styles.section}>
          <Text variant="overline" color={colors.textMuted}>
            What it will do
          </Text>
          <Text variant="h2">Chosen, written and sent</Text>
          <View style={styles.list}>
            <Line icon="cash-outline" title="An amount you choose" />
            <Line icon="person-outline" title="Sent to whoever you like" />
            <Line icon="create-outline" title="With a message in your words" />
            <Line icon="mail-outline" title="Delivered digitally, straight away" />
            <Line icon="briefcase-outline" title="And in bulk, for companies" />
          </View>
        </View>

        <Card style={styles.alternative}>
          <Text variant="h3">In the meantime</Text>
          <Text variant="body" color={colors.textSecondary}>
            Book the table yourself and let us look after them. Tell us the occasion when you do and
            we will make something of it.
          </Text>
          <Button
            label="Reserve a table"
            onPress={() => router.push('/reserve')}
            style={styles.alternativeCta}
          />
        </Card>
      </View>
    </Screen>
  );
}

function Line({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text variant="body" style={styles.lineCopy}>
        {title}
      </Text>
    </View>
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
  body: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xxl, gap: spacing.xxl },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft,
  },
  noticeCopy: { flex: 1, gap: spacing.xs },
  section: { gap: spacing.xxs },
  list: { marginTop: spacing.lg, gap: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lineCopy: { flex: 1 },
  alternative: { padding: spacing.lg, gap: spacing.sm },
  alternativeCta: { marginTop: spacing.md },
});
