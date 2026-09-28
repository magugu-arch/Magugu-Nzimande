import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ContactActions } from '@/components/mabu/Cards';
import {
  Header,
  LoadingBlock,
  PremiumButton,
  Screen,
  SectionTitle,
  Text,
  TextField,
} from '@/components/ui';
import { useRpc } from '@/services/queries';
import { colors, spacing } from '@/theme';
import { emailVenue } from '@/utils/linking';

const FAQ = [
  {
    q: 'How do I change or cancel my booking?',
    a: 'Open Profile › My bookings, choose the booking and tap Change or Cancel. Within a few hours of your table, please contact us and we will help personally.',
  },
  {
    q: 'Can you cater for allergies and dietary needs?',
    a: 'Yes. Add a note when you book and tell your server on arrival. Our menu shows only dietary labels our kitchen has verified.',
  },
  {
    q: 'Is there a dress code?',
    a: 'Smart elegant is appreciated. Some events set their own dress code, shown on the event page.',
  },
  {
    q: 'How do vouchers work?',
    a: 'Vouchers are valid for 36 months and can be used across more than one visit. Show the code or QR when settling the bill.',
  },
  {
    q: 'How do I earn MÁBU Rewards points?',
    a: 'Join in the app, then earn with each completed visit, event attended and voucher purchase. Points appear once your visit is marked complete.',
  },
  {
    q: 'Can I book for a large group?',
    a: 'For larger parties our events team will plan it with you — use Private Functions in the Events tab.',
  },
];

/** §4 Support — human service fallback: phone, reservations email, contact form, FAQ. */
export default function Support() {
  const venue = useRpc('content.venue');
  const [open, setOpen] = useState<number | null>(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  if (!venue.data)
    return (
      <Screen header={<Header title="Help" />}>
        <LoadingBlock />
      </Screen>
    );

  return (
    <Screen
      meta={{
        title: 'Contact & Help',
        description:
          'Contact the Mábu reservations team in Waterfall City, Midrand about bookings, private functions, gift vouchers and accessibility.',
        path: '/support',
      }}
      header={<Header title="Contact & help" />}
    >
      <Text variant="h1" style={{ marginTop: spacing.md }} accessibilityRole="header">
        We are here to help
      </Text>
      <View style={{ marginTop: spacing.xl }}>
        <ContactActions venue={venue.data} subject="Enquiry from the Mábu app" />
      </View>

      <SectionTitle eyebrow="Questions" title="Frequently asked" />
      {FAQ.map((f, i) => (
        <View key={f.q} style={{ borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <Pressable
            onPress={() => setOpen(open === i ? null : i)}
            accessibilityRole="button"
            aria-expanded={open === i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.lg,
            }}
          >
            <Text variant="title" style={{ flex: 1 }}>
              {f.q}
            </Text>
            <Feather name={open === i ? 'minus' : 'plus'} size={18} color={colors.accent} />
          </Pressable>
          {open === i ? (
            <Text variant="body" color="textMuted" style={{ paddingBottom: spacing.lg }}>
              {f.a}
            </Text>
          ) : null}
        </View>
      ))}

      <SectionTitle eyebrow="Write to us" title="Contact form" />
      <TextField label="Subject" value={subject} onChangeText={setSubject} />
      <TextField
        label="Message"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={1000}
      />
      <PremiumButton
        label="Send via email"
        variant="secondary"
        disabled={!message.trim()}
        onPress={() =>
          void emailVenue(venue.data!.email, subject || 'Enquiry from the Mábu app', message)
        }
      />
      <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.sm }}>
        Opens your email app, addressed to {venue.data.email}.
      </Text>
    </Screen>
  );
}
