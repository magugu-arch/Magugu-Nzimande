import { Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Divider, Screen, Text } from '@/components/ui';
import { FoodImage } from '@/components/food/FoodImage';
import { brand, venue } from '@/data/pappasContent';
import { factText, isVerified } from '@/data/businessInput';
import { colors, radius, spacing, aspect } from '@/theme';

/**
 * About Pappas, and finding it — brief §9 and §11's screens 30, 31 and 32.
 *
 * "Location — map, directions, call, hours and editorial venue story using
 * the attached Window/Square and dining-room imagery."
 *
 * One screen rather than three, because the brief's Restaurant, About and
 * Contact screens are the same page read in three moods, and splitting them
 * makes a guest hunt for the address under "About" and the story under
 * "Restaurant". §15's guardrail against burying things applies here.
 *
 * ── What it says and does not say ────────────────────────────────────────
 *
 * The venue story is written from what the supplied photography actually
 * shows — asset 13's olive trees and open kitchen, 14's lit stone bar, 16's
 * window onto the square. The brand lines are Pappas' own, read off the CI
 * sheet and the painted walls.
 *
 * The trading hours are not here, because nobody has supplied them and §15
 * forbids inventing opening hours. A "Mon–Sun 12:00–22:00" that turns out to
 * be wrong sends someone to a closed restaurant, which is the whole reason
 * that rule exists.
 */
export default function AboutScreen() {
  const router = useRouter();

  const phone = isVerified(venue.phone) ? venue.phone.value : null;
  const email = isVerified(venue.email) ? venue.email.value : null;
  const hours = isVerified(venue.hours) ? venue.hours.value : null;

  const openDirections = () => {
    const query = encodeURIComponent(`${venue.name}, Nelson Mandela Square, Sandton`);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  return (
    <Screen scroll padded={false} edges={['top']} bottomInset={spacing.xxl}>
      <View style={styles.hero}>
        <FoodImage
          assetKey="squareView"
          variant="hero"
          style={styles.heroImage}
          withScrim
          scrimIntensity="strong"
        />
        <View style={styles.heroCopy}>
          <Text variant="hero" color={colors.textOnDark}>
            {brand.name}
          </Text>
          <Text variant="overline" color={colors.textOnDark}>
            {brand.descriptor}
          </Text>
          <Text variant="accent" color={colors.textOnDark} style={styles.heroAccent}>
            {brand.tagline}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.section}>
          <Text variant="overline" color={colors.accentInk}>
            The restaurant
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.story}>
            {venue.story.value}
          </Text>
          <Text variant="quote" color={colors.primary} style={styles.promise}>
            {brand.promise}
          </Text>
        </View>

        <FoodImage assetKey="diningRoom" variant="banner" style={styles.plate} rounded="lg" />

        <Card style={styles.find}>
          <Text variant="overline" color={colors.textMuted}>
            Finding us
          </Text>
          <Text variant="h3">{venue.name}</Text>
          <Text variant="body" color={colors.textSecondary}>
            {factText(venue.addressLine, (line) => line)}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {venue.landmark.value}, {venue.suburb.value}, {venue.city}
          </Text>

          <Divider />

          {/*
            Hours, when there are any. §15 forbids inventing them, and a
            wrong opening time sends somebody to a dark restaurant — so when
            nobody has supplied them the screen says so and offers the two
            things that do work: directions, and a table booked in advance.
          */}
          {hours ? (
            <View style={styles.hours}>
              {hours.map((day) => (
                <View key={day.day} style={styles.hoursRow}>
                  <Text variant="caption" color={colors.textMuted}>
                    {day.day}
                  </Text>
                  <Text variant="captionMedium">
                    {day.opens} – {day.closes}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.hoursUnknown}>
              <Ionicons name="time-outline" size={18} color={colors.textMuted} />
              <Text variant="caption" color={colors.textSecondary} style={styles.hoursCopy}>
                {venue.hours.status === 'awaiting-business-input'
                  ? venue.hours.placeholder
                  : 'Hours confirmed on request'}
                . Book a table and we will confirm the time with you.
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button label="Directions" variant="secondary" size="sm" onPress={openDirections} />
            {phone ? (
              <Button
                label="Call"
                variant="secondary"
                size="sm"
                onPress={() => void Linking.openURL(`tel:${phone}`)}
              />
            ) : null}
            {email ? (
              <Button
                label="Email"
                variant="secondary"
                size="sm"
                onPress={() => void Linking.openURL(`mailto:${email}`)}
              />
            ) : null}
          </View>
        </Card>

        <FoodImage assetKey="barDetail" variant="banner" style={styles.plate} rounded="lg" />

        <View style={styles.section}>
          <Text variant="overline" color={colors.accentInk}>
            What we are for
          </Text>
          <Text variant="h2">{brand.purpose}</Text>
        </View>

        <Button label="Reserve a table" onPress={() => router.push('/reserve')} fullWidth />
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
  heroAccent: { marginTop: spacing.sm },
  body: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xxl, gap: spacing.xxl },
  section: { gap: spacing.xs },
  story: { marginTop: spacing.sm },
  promise: { marginTop: spacing.lg },
  plate: { width: '100%', aspectRatio: aspect.banner },
  find: { padding: spacing.lg, gap: spacing.xs, borderRadius: radius.lg },
  hours: { gap: spacing.xs },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hoursUnknown: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  hoursCopy: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
});
