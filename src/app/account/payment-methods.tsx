import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PaymentMethod } from '@/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import {
  useDeletePaymentMethod,
  usePaymentMethods,
  useSetDefaultPaymentMethod,
} from '@/features/account/hooks';
import { config } from '@/constants/config';
import { describePaymentMethod } from '@/services/paymentService';
import { colors, radius, spacing } from '@/theme';

const ICONS: Record<PaymentMethod['type'], keyof typeof Ionicons.glyphMap> = {
  card: 'card-outline',
  eft: 'business-outline',
  snapscan: 'qr-code-outline',
  cash: 'cash-outline',
  applepay: 'logo-apple',
  googlepay: 'logo-google',
};

/** Saved Payment Methods (brief §4). */
export default function PaymentMethodsScreen() {
  const methods = usePaymentMethods();
  const deleteMethod = useDeletePaymentMethod();
  const setDefault = useSetDefaultPaymentMethod();

  const handleDelete = useCallback(
    (method: PaymentMethod) => {
      Alert.alert('Remove this payment method?', method.label, [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteMethod.mutate(method.id),
        },
      ]);
    },
    [deleteMethod],
  );

  const handleAdd = useCallback(() => {
    // Card capture must happen inside the gateway's PCI-compliant SDK, never in
    // our own form. This is the hook-in point for that flow.
    Alert.alert(
      'Add a payment method',
      `New cards are captured securely by our payment provider (${config.payments.provider}). Connect the provider SDK to enable this.`,
    );
  }, []);

  if (methods.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Payment methods" />
        <LoadingState />
      </Screen>
    );
  }

  if (methods.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Payment methods" />
        <ErrorState onRetry={() => void methods.refetch()} />
      </Screen>
    );
  }

  const list = methods.data ?? [];

  return (
    <Screen scroll edges={['top', 'bottom']} testID="payment-methods-screen">
      <ScreenHeader title="Payment methods" />

      {list.length === 0 ? (
        <EmptyState
          icon="card-outline"
          title="No payment methods saved"
          message="Add a card to check out faster next time."
          actionLabel="Add a payment method"
          onActionPress={handleAdd}
        />
      ) : (
        <View style={styles.list}>
          {list.map((method) => (
            <Card key={method.id} testID={`payment-method-${method.id}`}>
              <View style={styles.row}>
                <View style={styles.icon}>
                  <Ionicons name={ICONS[method.type]} size={20} color={colors.primary} />
                </View>

                <View style={styles.body}>
                  <View style={styles.labelRow}>
                    <Text variant="bodyMedium">{method.label}</Text>
                    {method.isDefault ? <Badge label="Default" tone="neutral" /> : null}
                  </View>
                  <Text variant="caption" color={colors.textSecondary}>
                    {method.expiry
                      ? `Expires ${method.expiry}`
                      : describePaymentMethod(method.type)}
                  </Text>
                </View>

                <Pressable
                  onPress={() => handleDelete(method)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${method.label}`}
                >
                  <Ionicons name="trash-outline" size={19} color={colors.textMuted} />
                </Pressable>
              </View>

              {!method.isDefault ? (
                <Button
                  label="Make this my default"
                  onPress={() => setDefault.mutate(method.id)}
                  variant="text"
                  size="sm"
                  fullWidth={false}
                  style={styles.defaultButton}
                />
              ) : null}
            </Card>
          ))}

          <Button
            label="Add a payment method"
            onPress={handleAdd}
            variant="tertiary"
            iconLeft="add"
            testID="payment-add"
            preserveCase
          />

          <View style={styles.securityNote}>
            <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted} style={styles.securityText}>
              Card details are stored by our payment provider, never on your device or our servers.
            </Text>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  body: { flex: 1, gap: spacing.xxs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  defaultButton: { marginTop: spacing.sm, marginLeft: -spacing.md },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  securityText: { flex: 1 },
});
