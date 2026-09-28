import { useState } from 'react';
import { View } from 'react-native';
import {
  Chip,
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
import { radius, spacing } from '@/theme';
import { emailVenue } from '@/utils/linking';

const KINDS = ['Birthday', 'Anniversary', 'Corporate', 'Wedding', 'Product launch', 'Other'];

/**
 * §11 / board PRIVATE FUNCTIONS — an enquiry, composed as an email to the
 * reservations team until a functions CRM is chosen.
 */
export default function PrivateFunctions() {
  const venue = useRpc('content.venue');
  const name = useSession((s) => s.name);
  const [kind, setKind] = useState<string>('Birthday');
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
      <Photo
        photo="private-welcome"
        label="A host welcoming guests at the Mábu Private Functions entrance"
        style={{ height: 240, borderRadius: radius.md, marginTop: spacing.md }}
      />
      <Text variant="eyebrow" color="accent" style={{ marginTop: spacing.xl }}>
        Exclusive experiences · memorable occasions
      </Text>
      <Text variant="h1" accessibilityRole="header" style={{ marginTop: spacing.xs }}>
        Gather in grand style
      </Text>
      <Text variant="body" color="textMuted" style={{ marginTop: spacing.sm }}>
        From an intimate celebration to a long-table feast, our events team will compose the
        occasion with you — menu, wine pairing and setting.
      </Text>
      <SectionTitle eyebrow="Your occasion" title="Tell us a little" />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.lg,
        }}
      >
        {KINDS.map((k) => (
          <Chip key={k} label={k} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
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
    </Screen>
  );
}
