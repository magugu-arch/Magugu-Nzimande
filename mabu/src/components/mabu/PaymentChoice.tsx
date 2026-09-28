import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { MOCK_PAYMENT_TOKENS } from '@/domain/payments/service';
import { formatRand } from '@/domain/shared/format';
import { config } from '@/services/config';
import { colors, radius, spacing } from '@/theme';
import { Text } from '../ui';

const OPTIONS = [
  {
    token: MOCK_PAYMENT_TOKENS.success,
    label: 'Approve',
    body: 'The gateway approves the payment.',
  },
  {
    token: MOCK_PAYMENT_TOKENS.decline,
    label: 'Decline',
    body: 'The bank declines — nothing is charged.',
  },
  {
    token: MOCK_PAYMENT_TOKENS.pending,
    label: 'Delayed',
    body: 'Taken, but confirmation arrives later.',
  },
];

/**
 * The payment step. The app never collects card details (§19, §28): a real
 * gateway runs a hosted checkout and returns a token. Until Mábu's merchant
 * gateway is connected, the mock back end stands in, and this says so
 * plainly and lets each outcome be tried — it never pretends to take money.
 */
export function PaymentChoice({
  amountCents,
  token,
  onChange,
}: {
  amountCents: number;
  token: string;
  onChange: (token: string) => void;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.secure}>
        <Feather name="lock" size={16} color={colors.accent} />
        <Text variant="bodySmall" color="textMuted" style={{ flex: 1 }}>
          {formatRand(amountCents)} is paid on our payment partner&apos;s secure page. Mábu never
          sees or stores your card details.
        </Text>
      </View>
      {config.useMockApi ? (
        <View
          style={{ gap: spacing.sm }}
          accessibilityRole="radiogroup"
          accessibilityLabel="Test payment outcome"
        >
          <Text variant="eyebrow" color="warning">
            Test mode · no real payment
          </Text>
          {OPTIONS.map((o) => {
            const selected = token === o.token;
            return (
              <Pressable
                key={o.token}
                onPress={() => onChange(o.token)}
                accessibilityRole="radio"
                aria-checked={selected}
                accessibilityLabel={`${o.label}. ${o.body}`}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <View style={[styles.radio, selected && styles.radioOn]} />
                <View style={{ flex: 1 }}>
                  <Text variant="title">{o.label}</Text>
                  <Text variant="caption" color="textMuted">
                    {o.body}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export const DEFAULT_TEST_TOKEN = MOCK_PAYMENT_TOKENS.success;

const styles = StyleSheet.create({
  secure: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  option: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 56,
  },
  optionSelected: { borderColor: colors.accent },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  radioOn: { borderColor: colors.accent, borderWidth: 6 },
});
