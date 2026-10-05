import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { providers } from '@/core/adapters/registry';
import { readPaymentReturn } from '@/core/auth/oidc';
import { config } from '@/core/config';
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
 *
 * When the BFF answers with the provider's page (`redirectUrl`), the person
 * pays there, in the system browser on a phone or a provider window on the
 * web, and comes back to /payments/return; the payment is confirmed only if
 * the provider says it was approved. Browsers only let a page open a window
 * straight from a tap, so the web build asks for one more tap to continue.
 */

const METHODS: { id: PaymentMethod; label: string; detail: string; icon: IconName }[] = [
  { id: 'card', label: 'Card', detail: 'Debit or credit card', icon: 'card-outline' },
  {
    id: 'instant-eft',
    label: 'Instant EFT',
    detail: 'Pay from your banking app',
    icon: 'business-outline',
  },
  {
    id: 'campus-wallet',
    label: 'Campus wallet',
    detail: 'Where NMU has approved it',
    icon: 'wallet-outline',
  },
];

type Step = 'choose' | 'processing' | 'handoff' | 'cancelled' | 'failed';

/** Where the provider sends people back to; only a live BFF uses it. */
const returnUrl = () =>
  config.dataMode === 'live' ? Linking.createURL('/payments/return') : undefined;

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

  const [intent, setIntent] = useState<PaymentIntent | null>(null);

  const fail = (e: unknown) => {
    setStep('failed');
    setMessage(
      isAdapterError(e) && e.kind === 'offline'
        ? 'You’re offline, so nothing was charged. Try again when you’re connected.'
        : isAdapterError(e) && e.message && e.kind !== 'unavailable'
          ? e.message
          : 'The payment didn’t go through, and nothing was charged. Please try again.',
    );
  };

  const settle = async (paymentId: string) => {
    const receipt = await providers.finance.confirmPayment(paymentId);
    if (userId)
      recordAudit(
        'finance.payment',
        userId,
        `${purpose} payment ${formatMoney(amount)} (${receipt.reference})`,
      );
    await onPaid(receipt, paymentId);
    setIntent(null);
    setStep('choose');
  };

  /** Opens the provider's page; on the web this must run straight from a tap. */
  const handOver = async (created: PaymentIntent) => {
    setStep('processing');
    setMessage(null);
    try {
      const result = await WebBrowser.openAuthSessionAsync(created.redirectUrl!, returnUrl());
      const outcome =
        result.type === 'success' ? readPaymentReturn(result.url, created.id) : 'cancelled';
      if (outcome === 'approved') {
        await settle(created.id);
      } else {
        setIntent(null);
        setStep('cancelled');
      }
    } catch (e) {
      setIntent(null);
      fail(e);
    }
  };

  const pay = async () => {
    setStep('processing');
    setMessage(null);
    try {
      const created = await providers.finance.createPayment({
        amount,
        method,
        purpose,
        returnUrl: returnUrl(),
      });
      if (!created.redirectUrl) {
        await settle(created.id);
      } else if (Platform.OS === 'web') {
        setIntent(created);
        setStep('handoff');
      } else {
        await handOver(created);
      }
    } catch (e) {
      fail(e);
    }
  };

  const close = () => {
    if (step === 'processing') return;
    setStep('choose');
    setMessage(null);
    setIntent(null);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={`Pay ${formatMoney(amount)}`}
      testID="payment-sheet"
    >
      <Text variant="body" color={colors.textSecondary}>
        {description}
      </Text>
      <View
        style={styles.methods}
        accessibilityRole="radiogroup"
        accessibilityLabel="Payment method"
      >
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
              <Icon
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={colors.navy}
              />
            </Touchable>
          );
        })}
      </View>
      {step === 'failed' && message ? (
        <Notice tone="danger" title="Payment not completed" body={message} />
      ) : null}
      {step === 'cancelled' ? (
        <Notice
          tone="warning"
          title="Payment cancelled"
          body="Nothing was charged. You can try again whenever you’re ready."
        />
      ) : null}
      {step === 'handoff' ? (
        <Notice
          tone="info"
          icon="open-outline"
          title="Your payment is ready"
          body="The payment provider opens in a new window. Finish there and you’ll come straight back here."
        />
      ) : null}
      <View style={styles.secure}>
        <Icon name="lock-closed" size={16} color={colors.success} />
        <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
          You’ll be handed over to the university’s approved payment provider. NMU ONE never sees
          your card or banking details.
        </Text>
      </View>
      {step === 'handoff' && intent ? (
        <Button
          label="Continue to the payment provider"
          icon="open-outline"
          variant="accent"
          fullWidth
          onPress={() => void handOver(intent)}
          testID="pay-handoff"
        />
      ) : (
        <Button
          label={
            step === 'processing'
              ? 'Waiting for the payment provider…'
              : `Pay ${formatMoney(amount)}`
          }
          variant="accent"
          fullWidth
          loading={step === 'processing'}
          onPress={pay}
          testID="pay-confirm"
        />
      )}
      <Button
        label="Cancel"
        variant="ghost"
        fullWidth
        onPress={close}
        disabled={step === 'processing'}
      />
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
