import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { providers } from '@/core/adapters/registry';
import { isAdapterError } from '@/core/adapters/errors';
import type { Money, PaymentIntent, PaymentMethod, Receipt } from '@/core/domain/models';
import { formatMoney } from '@/core/domain/money';
import {
  Button,
  Icon,
  Notice,
  Sheet,
  Text,
  Touchable,
  colors,
  radius,
  spacing,
  type IconName,
} from '@/design';
import { recordAudit } from '@/state/governance';
import { useSession } from '@/state/session';

/**
 * The approved payment hand-off (brief §8, §10). NMU ONE never collects card
 * details: it creates a payment with the university's approved provider,
 * hands the person over, and shows the receipt when the provider confirms.
 * Used for fees, campus orders, event tickets and donations alike.
 */

const METHODS: { id: PaymentMethod; label: string; detail: string; icon: IconName }[] = [
  { id: 'card', label: 'Card', detail: 'Debit or credit card', icon: 'card-outline' },
  { id: 'instant-eft', label: 'Instant EFT', detail: 'Pay from your banking app', icon: 'business-outline' },
  { id: 'campus-wallet', label: 'Campus wallet', detail: 'Where NMU has approved it', icon: 'wallet-outline' },
];

type Step = 'choose' | 'processing' | 'failed';

export function PaymentSheet({
  visible,
  amount,
  purpose,
  description,
  onClose,
  onPaid,
  allowWallet = false,
}: {
  visible: boolean;
  amount: Money;
  purpose: PaymentIntent['purpose'];
  description: string;
  onClose: () => void;
  onPaid: (receipt: Receipt, paymentId: string) => Promise<void> | void;
  allowWallet?: boolean;
}) {
  const userId = useSession((s) => s.user?.id);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [step, setStep] = useState<Step>('choose');
  const [message, setMessage] = useState<string | null>(null);
  const methods = METHODS.filter((m) => allowWallet || m.id !== 'campus-wallet');

  const pay = async () => {
    setStep('processing');
    setMessage(null);
    try {
      const intent = await providers.finance.createPayment({ amount, method, purpose });
      const receipt = await providers.finance.confirmPayment(intent.id);
      if (userId) recordAudit('finance.payment', userId, `${purpose} payment ${formatMoney(amount)} (${receipt.reference})`);
      await onPaid(receipt, intent.id);
      setStep('choose');
    } catch (e) {
      setStep('failed');
      setMessage(
        isAdapterError(e) && e.kind === 'offline'
          ? 'You’re offline, so nothing was charged. Try again when you’re connected.'
          : isAdapterError(e) && e.message && e.kind !== 'unavailable'
            ? e.message
            : 'The payment didn’t go through, and nothing was charged. Please try again.',
      );
    }
  };

  const close = () => {
    if (step === 'processing') return;
    setStep('choose');
    setMessage(null);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={`Pay ${formatMoney(amount)}`} testID="payment-sheet">
      <Text variant="body" color={colors.textSecondary}>
        {description}
      </Text>
      <View style={styles.methods} accessibilityRole="radiogroup" accessibilityLabel="Payment method">
        {methods.map((m) => {
          const selected = m.id === method;
          return (
            <Touchable
              key={m.id}
              onPress={() => setMethod(m.id)}
              disabled={step === 'processing'}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: step === 'processing' }}
              accessibilityLabel={`${m.label}, ${m.detail}`}
              style={[styles.method, selected ? styles.methodOn : null]}
              testID={`method-${m.id}`}
            >
              <Icon name={m.icon} size={22} color={colors.navy} />
              <View style={{ flex: 1 }}>
                <Text variant="label">{m.label}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {m.detail}
                </Text>
              </View>
              <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.navy} />
            </Touchable>
          );
        })}
      </View>
      {step === 'failed' && message ? <Notice tone="danger" title="Payment not completed" body={message} /> : null}
      <View style={styles.secure}>
        <Icon name="lock-closed" size={16} color={colors.success} />
        <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
          You’ll be handed over to the university’s approved payment provider. NMU ONE never sees your card or banking details.
        </Text>
      </View>
      <Button
        label={step === 'processing' ? 'Waiting for the payment provider…' : `Pay ${formatMoney(amount)}`}
        variant="accent"
        fullWidth
        loading={step === 'processing'}
        onPress={pay}
        testID="pay-confirm"
      />
      <Button label="Cancel" variant="ghost" fullWidth onPress={close} disabled={step === 'processing'} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  methods: { gap: spacing.sm },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodOn: { borderColor: colors.navy },
  secure: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
