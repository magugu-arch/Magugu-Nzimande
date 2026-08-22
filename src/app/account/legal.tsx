import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Screen, ScreenHeader, Text } from '@/components/ui';
import { SUPPORT } from '@/constants/config';
import { colors, spacing } from '@/theme';

type Tab = 'terms' | 'privacy';

interface Clause {
  heading: string;
  body: string;
}

const TERMS: Clause[] = [
  {
    heading: 'Using this app',
    body: 'By placing an order through the bb.q Chicken app you agree to these terms. You must be 18 or older, or have permission from a parent or guardian, to create an account.',
  },
  {
    heading: 'Orders and pricing',
    body: 'All prices are in South African rand and include VAT. We do our best to keep the menu accurate, but items occasionally sell out. If something you ordered is unavailable, the store will contact you and refund that item.',
  },
  {
    heading: 'Payment',
    body: 'Payment is taken when you place the order, except for cash on delivery where available. Card details are handled by our payment provider — we never see or store your full card number.',
  },
  {
    heading: 'Delivery',
    body: 'Delivery times are estimates that depend on distance, traffic and how busy the kitchen is. We deliver within defined zones around each store. If nobody is available at the address, the driver will wait 5 minutes and then return the order to the store.',
  },
  {
    heading: 'Cancellations and refunds',
    body: 'You can cancel free of charge while the order is still in the Received state. Once the kitchen starts preparing, cancellation is at the store manager’s discretion. If something is wrong with your order, contact us within 24 hours and we will refund or replace it.',
  },
  {
    heading: 'bb.q Rewards',
    body: 'Points have no cash value and cannot be transferred or sold. They expire 12 months after they are earned. We may change the rewards programme with reasonable notice.',
  },
  {
    heading: 'Our liability',
    body: 'Nothing in these terms limits your rights under the Consumer Protection Act 68 of 2008. We are not liable for indirect loss arising from a delayed or incorrect order beyond a refund of that order.',
  },
];

const PRIVACY: Clause[] = [
  {
    heading: 'What we collect',
    body: 'Your name, email address, mobile number and delivery addresses; your order history; and, if you allow it, your approximate location so we can find your nearest store. We never collect your full card number.',
  },
  {
    heading: 'Why we collect it',
    body: 'To take and deliver your orders, run bb.q Rewards, keep your account secure, and — only if you agree — send you offers. We also look at aggregated ordering patterns to decide what to put on the menu.',
  },
  {
    heading: 'Who we share it with',
    body: 'The store preparing your order, our delivery partners, our payment provider and our technology suppliers. Each is bound to use your data only to do their job for us. We never sell your personal information.',
  },
  {
    heading: 'How long we keep it',
    body: 'For as long as your account is open, and afterwards only where law requires it — for example, tax records must be kept for five years.',
  },
  {
    heading: 'Your rights under POPIA',
    body: 'Under the Protection of Personal Information Act you may ask us what we hold about you, correct it, or ask us to delete it. Use Delete account in your profile, or email us. You can also complain to the Information Regulator.',
  },
  {
    heading: 'Location and notifications',
    body: 'Location access is optional and only used while the app is open. You can turn notifications off entirely in Preferences, though we may still send essential order updates by SMS.',
  },
  {
    heading: 'Contact',
    body: `Questions about your data? Email ${SUPPORT.email} or call ${SUPPORT.phone}.`,
  },
];

/** Terms & Privacy (brief §4). */
export default function LegalScreen() {
  const [tab, setTab] = useState<Tab>('terms');
  const clauses = tab === 'terms' ? TERMS : PRIVACY;

  return (
    <Screen scroll edges={['top', 'bottom']} testID="legal-screen">
      <ScreenHeader title="Terms & privacy" />

      <View style={styles.tabs}>
        <Chip label="Terms of use" selected={tab === 'terms'} onPress={() => setTab('terms')} />
        <Chip
          label="Privacy policy"
          selected={tab === 'privacy'}
          onPress={() => setTab('privacy')}
        />
      </View>

      <View style={styles.body}>
        <Text variant="caption" color={colors.textMuted}>
          Last updated 1 January 2026
        </Text>

        {clauses.map((clause, index) => (
          <Card key={clause.heading} style={styles.clause}>
            <Text variant="h3">
              {index + 1}. {clause.heading}
            </Text>
            <Text variant="body" color={colors.textSecondary}>
              {clause.body}
            </Text>
          </Card>
        ))}

        <Text variant="caption" color={colors.textMuted} style={styles.footer}>
          bb.q Chicken South Africa. All rights reserved.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.md },
  body: { gap: spacing.md, paddingBottom: spacing.xxxl },
  clause: { gap: spacing.sm },
  footer: { paddingTop: spacing.lg },
});
