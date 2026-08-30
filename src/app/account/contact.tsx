import { useCallback, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  ListRow,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from '@/components/ui';
import { useSendContactMessage } from '@/features/account/hooks';
import { SUPPORT } from '@/constants/config';
import { colors, radius, spacing, typography } from '@/theme';
import { callNumber, openExternal } from '@/utils/linking';
import { required, validateFields } from '@/utils/validation';
import { track } from '@/ux/analytics';

const SUBJECTS = [
  'Something was missing',
  'Order was late',
  'Wrong order',
  'Payment problem',
  'Rewards question',
  'Something else',
];

/** Contact Us (brief §4). */
export default function ContactScreen() {
  const router = useRouter();
  const { order } = useLocalSearchParams<{ order?: string }>();

  const sendMessage = useSendContactMessage();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [orderReference, setOrderReference] = useState(order ?? '');
  const [errors, setErrors] = useState<Partial<Record<'subject' | 'message', string>>>({});
  const [ticketId, setTicketId] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const validationErrors = validateFields(
      { subject, message },
      { subject: required('Subject'), message: required('Message') },
    );

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const result = await sendMessage.mutateAsync({
      subject,
      message,
      ...(orderReference.trim().length > 0 ? { orderReference: orderReference.trim() } : {}),
    });
    // §15 `support_contact`. The topic only — never the subject line or the
    // message, which is where a customer types an order number, a phone number
    // or a complaint about a named member of staff.
    track('support_contact', { topicId: subject });
    setTicketId(result.ticketId);
  }, [subject, message, orderReference, sendMessage]);

  if (ticketId) {
    return (
      <Screen edges={['top', 'bottom']} testID="contact-sent">
        <ScreenHeader title="Message sent" />
        <View style={styles.confirmation}>
          <View style={styles.iconWell}>
            <Ionicons name="checkmark" size={32} color={colors.onPrimary} />
          </View>
          <Text variant="h2" align="center">
            We&apos;re on it
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center">
            Reference {ticketId}. We usually reply within one business day, by email.
          </Text>
          <Button label="Back to help" onPress={() => router.replace('/account/help')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom']} testID="contact-screen">
      <ScreenHeader title="Contact us" />

      {/* Direct channels */}
      <Card padded={false} style={styles.channels}>
        <ListRow
          title="Call us"
          subtitle={`${SUPPORT.phone} · ${SUPPORT.hours}`}
          icon="call-outline"
          accessibilityLabel={`Call support on ${SUPPORT.phone}, ${SUPPORT.hours}`}
          onPress={() => void callNumber(SUPPORT.phone)}
        />
        <ListRow
          title="Email us"
          subtitle={SUPPORT.email}
          icon="mail-outline"
          onPress={() =>
            void openExternal(`mailto:${SUPPORT.email}`, {
              failureTitle: 'Could not open your mail app',
              failureMessage: `Write to ${SUPPORT.email} instead.`,
            })
          }
        />
        <ListRow
          title="WhatsApp"
          subtitle={SUPPORT.whatsapp}
          icon="logo-whatsapp"
          onPress={() =>
            void openExternal(`https://wa.me/${SUPPORT.whatsapp.replace(/\D/g, '')}`, {
              failureTitle: 'Could not open WhatsApp',
              failureMessage: `Message ${SUPPORT.whatsapp} from WhatsApp instead.`,
            })
          }
        />
      </Card>

      {/* Message form */}
      <View style={styles.form}>
        <Text variant="h3">Or send us a message</Text>

        <View style={styles.subjectBlock}>
          <Text variant="captionMedium" color={colors.textSecondary}>
            What is this about?
          </Text>
          <View style={styles.subjectRow}>
            {SUBJECTS.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={subject === item}
                onPress={() => {
                  setSubject(item);
                  setErrors((current) => ({ ...current, subject: undefined }));
                }}
              />
            ))}
          </View>
          {errors.subject ? (
            <Text variant="caption" color={colors.status.error}>
              {errors.subject}
            </Text>
          ) : null}
        </View>

        <TextField
          label="Order reference"
          value={orderReference}
          onChangeText={setOrderReference}
          placeholder="BBQ-0000 (optional)"
          autoCapitalize="characters"
          iconLeft="receipt-outline"
          helperText="Helps us find the order faster."
        />

        <View style={styles.messageBlock}>
          <Text variant="captionMedium" color={colors.textSecondary}>
            Your message
          </Text>
          <TextInput
            value={message}
            onChangeText={(text) => {
              setMessage(text);
              setErrors((current) => ({ ...current, message: undefined }));
            }}
            placeholder="Tell us what happened"
            placeholderTextColor={colors.textDisabled}
            multiline
            maxLength={800}
            style={[styles.message, errors.message ? styles.messageError : null]}
            accessibilityLabel="Your message"
            testID="contact-message"
          />
          {errors.message ? (
            <Text variant="caption" color={colors.status.error}>
              {errors.message}
            </Text>
          ) : (
            <Text variant="caption" color={colors.textMuted} align="right">
              {message.length}/800
            </Text>
          )}
        </View>

        <Button
          label="Send message"
          onPress={() => void handleSubmit()}
          loading={sendMessage.isPending}
          size="lg"
          testID="contact-submit"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  channels: { paddingHorizontal: spacing.lg, marginVertical: spacing.md },
  form: { gap: spacing.lg, paddingBottom: spacing.xxxl },
  subjectBlock: { gap: spacing.sm },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  messageBlock: { gap: spacing.sm },
  message: {
    minHeight: 130,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
    ...typography.body,
    color: colors.textPrimary,
  },
  messageError: { borderColor: colors.status.error },
  confirmation: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  iconWell: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
