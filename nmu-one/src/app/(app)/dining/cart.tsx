import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { providers } from '@/core/adapters/registry';
import { isAdapterError } from '@/core/adapters/errors';
import { formatMoney, multiplyMoney } from '@/core/domain/money';
import { useVendors } from '@/data/hooks';
import {
  Button,
  Card,
  Divider,
  Header,
  Icon,
  IconButton,
  Notice,
  Row,
  Screen,
  StateView,
  Text,
  colors,
  spacing,
} from '@/design';
import { cartTotal, useCart } from '@/features/dining/cart';
import { PaymentSheet } from '@/features/money/payment';
import { useSession } from '@/state/session';

/** Review, pay, and send to the kitchen (brief §10 "order / pickup", "payment handoff"). */
export default function CartScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useSession((s) => s.user?.id);
  const cart = useCart((s) => s.cart);
  const add = useCart((s) => s.add);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const vendors = useVendors();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vendor = vendors.data?.find((v) => v.id === cart.vendorId);
  const total = cartTotal(cart);

  if (cart.lines.length === 0) {
    return (
      <Screen header={<Header title="Your order" fallbackHref="/dining" />}>
        <StateView
          kind="empty"
          title="Your order is empty"
          body="Add something from a campus vendor first."
          actionLabel="Browse food"
          onAction={() => router.dismissTo('/dining')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={<Header title="Your order" fallbackHref="/dining" />}
      footer={
        <Button
          label={`Pay ${formatMoney(total)}`}
          variant="accent"
          icon="lock-closed"
          fullWidth
          disabled={!vendor?.isOpen}
          onPress={() => {
            setError(null);
            setPaying(true);
          }}
          testID="cart-pay"
        />
      }
      testID="cart"
    >
      <Text variant="title1" accessibilityRole="header">
        {vendor?.name ?? 'Your order'}
      </Text>
      {vendor ? (
        <Row gap={spacing.sm} style={styles.pickup}>
          <Icon name="location-outline" size={18} color={colors.navy2} />
          <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
            Collect from {vendor.pickupPoint} · ready in about {vendor.prepMinutes} min
          </Text>
        </Row>
      ) : null}
      {vendor && !vendor.isOpen ? (
        <Notice
          tone="warning"
          title={`${vendor.name} has closed`}
          body="This order can’t be placed until they open again."
        />
      ) : null}
      {error ? <Notice tone="danger" title="Your order wasn’t placed" body={error} /> : null}

      <Card style={{ marginTop: spacing.lg }}>
        {cart.lines.map((l, i) => (
          <View key={l.item.id}>
            {i > 0 ? <Divider /> : null}
            <Row style={styles.line} gap={spacing.md}>
              <View style={{ flex: 1 }}>
                <Text variant="label">{l.item.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {formatMoney(l.item.price)} each
                </Text>
              </View>
              <IconButton
                icon="remove"
                label={`Remove one ${l.item.name}`}
                onPress={() => remove(l.item.id)}
                tone="filled"
              />
              <Text variant="bodyStrong">{l.quantity}</Text>
              <IconButton
                icon="add"
                label={`Add another ${l.item.name}`}
                onPress={() => add(l.item)}
                tone="filled"
              />
              <Text variant="bodyStrong" style={styles.amount}>
                {formatMoney(multiplyMoney(l.item.price, l.quantity))}
              </Text>
            </Row>
          </View>
        ))}
        <Divider />
        <Row justify="space-between" style={styles.line}>
          <Text variant="title3">Total</Text>
          <Text variant="title3" testID="cart-total">
            {formatMoney(total)}
          </Text>
        </Row>
      </Card>
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.md }}>
        The price you see is the price you pay. Your receipt is kept with the order.
      </Text>

      <PaymentSheet
        visible={paying}
        amount={total}
        purpose="order"
        allowWallet
        description={`${vendor?.name ?? 'Campus vendor'} · collect at ${vendor?.pickupPoint ?? 'the counter'}`}
        onClose={() => setPaying(false)}
        onPaid={async (receipt, paymentId) => {
          try {
            const order = await providers.commerce.placeOrder({
              vendorId: cart.vendorId!,
              lines: cart.lines.map((l) => ({ itemId: l.item.id, quantity: l.quantity })),
              paymentId,
            });
            setPaying(false);
            clear();
            void queryClient.invalidateQueries({ queryKey: ['orders', userId] });
            router.replace(`/dining/order/${order.id}`);
          } catch (e) {
            setPaying(false);
            setError(
              `${isAdapterError(e) && e.message ? e.message : 'The kitchen didn’t accept the order.'} Keep your payment reference, ${receipt.reference} — the vendor or Student Finance can trace it.`,
            );
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pickup: { marginTop: spacing.sm },
  line: { paddingVertical: spacing.md },
  amount: { minWidth: 74, textAlign: 'right' },
});
