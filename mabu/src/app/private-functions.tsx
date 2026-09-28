import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Header,
  LoadingBlock,
  Photo,
  PremiumButton,
  Screen,
  SectionTitle,
  Text,
  TextField,
} from '@/components/ui';
import { useRpc } from '@/services/queries';
import { useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';
import { emailVenue } from '@/utils/linking';

/** The five occasions of the supplied Events design, each with its tile photograph. */
const KINDS = [
  { label: 'Private dining', photo: 'event-private-dining' },
  { label: 'Corporate events', photo: 'event-corporate' },
  { label: 'Celebrations', photo: 'event-celebrations' },
  { label: 'Weddings', photo: 'event-weddings' },
  { label: 'Exclusive venue hire', photo: 'event-venue-hire' },
];

/**
 * §11 / board PRIVATE FUNCTIONS — an enquiry, composed as an email to the
 * reservations team until a functions CRM is chosen.
 */
export default function PrivateFunctions() {
  const venue = useRpc('content.venue');
  const name = useSession((s) => s.name);
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<string>('Private dining');
  const [guests, setGuests] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  if (!venue.data)
    return (
      <Screen header={<Header title="Private functions" />}>
        <LoadingBlock />
      </Screen>
    );

  const body = [
    `Occasion: ${kind}`,
    `Guests: ${guests || 'to be confirmed'}`,
    `Preferred date: ${date || 'flexible'}`,
    notes ? `\n${notes}` : '',
    name ? `\n${name}` : '',
  ].join('\n');

  return (
    <Screen
      header={<Header title="Private functions" />}
      footer={
        <PremiumButton
          label="Send enquiry"
          onPress={() =>
            void emailVenue(venue.data!.email, `Private function enquiry · ${kind}`, body)
          }
        />
      }
    >
      <View style={styles.hero}>
        <Photo
          photo="hero-events"
          label="A long table dressed with orchids, candles and brass for a private event"
          style={StyleSheet.absoluteFill}
        />
        {/* Candlelight sits right behind the copy: a deeper fade than the stock scrims. */}
        <LinearGradient
          colors={['rgba(11,11,11,0)', 'rgba(11,11,11,0.78)', colors.background]}
          locations={[0.3, 0.62, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.heroCopy}>
          <Text variant="eyebrow" color="accent" style={styles.tracked}>
            Unforgettable
          </Text>
          <Text variant="hero" accessibilityRole="header">
            Events
          </Text>
          <View style={styles.rule} />
          <Text variant="eyebrow" style={styles.tracked}>
            Exceptional spaces.{'\n'}Extraordinary experiences.
          </Text>
        </View>
      </View>
      <Text variant="body" color="textMuted" style={{ marginTop: spacing.lg }}>
        From an intimate dinner to exclusive use of the venue, our events team will compose the
        occasion with you — menu, wine pairing and setting.
      </Text>
      <SectionTitle eyebrow="Your occasion" title="What are we celebrating?" />
      <View style={styles.tiles} accessibilityRole="radiogroup">
        {KINDS.map((k, i) => {
          const selected = kind === k.label;
          // Two to a row; the last, venue hire, runs the full width.
          const full = i === KINDS.length - 1;
          const tileWidth = full
            ? width - spacing.gutter * 2
            : (width - spacing.gutter * 2 - spacing.sm) / 2;
          return (
            <Pressable
              key={k.label}
              onPress={() => {
                haptic.select();
                setKind(k.label);
              }}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityLabel={k.label}
              style={[styles.tile, { width: tileWidth }, selected && styles.tileOn]}
            >
              <Photo photo={k.photo} label="" style={StyleSheet.absoluteFill} scrim="bottom" />
              {selected ? (
                <View style={styles.tick}>
                  <Feather name="check" size={14} color={colors.textOnAccent} />
                </View>
              ) : null}
              <View style={styles.tileLabel}>
                <Text variant="eyebrow" style={{ letterSpacing: 1.8, textAlign: 'center' }}>
                  {k.label}
                </Text>
                <View style={[styles.tileRule, selected && { width: 36 }]} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <SectionTitle eyebrow="Details" title="Tell us a little" />
      <TextField
        label="Number of guests"
        value={guests}
        onChangeText={(v) => setGuests(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
      />
      <TextField
        label="Preferred date"
        value={date}
        onChangeText={setDate}
        placeholder="e.g. Saturday 14 November"
      />
      <TextField label="Anything else" value={notes} onChangeText={setNotes} multiline />
      <Photo
        photo="private-welcome"
        label="A host welcoming guests at the Mábu Private Functions entrance"
        style={{ height: 220, borderRadius: radius.md, marginTop: spacing.lg }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 300,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroCopy: { padding: spacing.lg, gap: spacing.xs },
  tracked: { letterSpacing: 3 },
  rule: { width: 44, height: 2, backgroundColor: colors.accent, marginVertical: spacing.xs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    height: 150,
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileOn: { borderColor: colors.accent, borderWidth: 2 },
  tileLabel: { alignItems: 'center', paddingBottom: spacing.md, paddingHorizontal: spacing.sm },
  tileRule: { width: 22, height: 2, backgroundColor: colors.accent, marginTop: spacing.xs },
  tick: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
