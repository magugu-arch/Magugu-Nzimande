import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { OrderStatus } from '@/core/domain/models';
import { formatMoney } from '@/core/domain/money';
import { formatTime } from '@/core/time/sast';
import { useOrder } from '@/data/hooks';
import {
  Button,
  Card,
  Divider,
  Header,
  Icon,
  QRCode,
  QueryState,
  Row,
  Screen,
  Text,
  colors,
  radius,
  spacing,
} from '@/design';

const STEPS: { status: OrderStatus; label: string; detail: string }[] = [
  { status: 'placed', label: 'Order placed', detail: 'Paid and sent to the kitchen' },
  { status: 'preparing', label: 'Preparing', detail: 'Your food is being made' },
  { status: 'ready', label: 'Ready for pickup', detail: 'Show your code at the counter' },
];

const rank = (s: OrderStatus) => (s === 'collected' ? 3 : STEPS.findIndex((x) => x.status === s));

/**
 * Order status and pickup (brief §10 "order status", "push pickup
 * notification"; §26 step 9). The screen polls; when the order is ready the
 * notification arrives wherever the person is in the app.
 */
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const order = useOrder(id);

  return (
    <Screen header={<Header title="Your order" fallbackHref="/dining" />} testID="order">
      <QueryState query={order} what="your order">
        {(o) => {
          const current = rank(o.status);
          const ready = o.status === 'ready';
          return (
            <View style={{ gap: spacing.xl }}>
              <View style={{ gap: spacing.xs }} accessibilityLiveRegion="polite">
                <Text variant="overline" color={colors.textSecondary}>
                  {o.vendorName}
                </Text>
                <Text variant="title1" accessibilityRole="header" testID="order-status">
                  {ready
                    ? 'Ready for pickup'
                    : o.status === 'preparing'
                      ? 'Being prepared'
                      : o.status === 'collected'
                        ? 'Collected'
                        : 'Order placed'}
                </Text>
                <Text variant="body" color={colors.textSecondary}>
                  {ready && o.readyAt
                    ? `Ready since ${formatTime(o.readyAt)} at ${o.pickupPoint}`
                    : `Collect from ${o.pickupPoint}. We’ll notify you when it’s ready.`}
                </Text>
              </View>

              <Card tone={ready ? 'yellow' : 'surface'} style={styles.codeCard}>
                <Text variant="overline" color={colors.navy}>
                  Pickup code
                </Text>
                <Text
                  variant="metric"
                  testID="pickup-code"
                  accessibilityLabel={`Pickup code ${o.pickupCode.split('').join(' ')}`}
                >
                  {o.pickupCode}
                </Text>
                <View style={styles.qr}>
                  <QRCode
                    value={`NMUONE-ORDER:${o.id}:${o.pickupCode}`}
                    size={150}
                    label={`QR code for pickup code ${o.pickupCode}`}
                  />
                </View>
              </Card>

              <Card>
                {STEPS.map((step, i) => {
                  const done = current >= i;
                  return (
                    <Row key={step.status} gap={spacing.md} align="flex-start" style={styles.step}>
                      <View style={[styles.dot, done ? styles.dotDone : null]}>
                        {done ? <Icon name="checkmark" size={14} color={colors.navy} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          variant="label"
                          color={done ? colors.textPrimary : colors.textSecondary}
                        >
                          {step.label}
                        </Text>
                        <Text variant="caption" color={colors.textSecondary}>
                          {step.detail}
                        </Text>
                      </View>
                    </Row>
                  );
                })}
              </Card>

              <Card>
                {o.lines.map((l) => (
                  <Row key={l.itemId} justify="space-between" style={styles.line}>
                    <Text variant="body">
                      {l.quantity} × {l.name}
                    </Text>
                    <Text variant="body">
                      {formatMoney({ cents: l.unitPrice.cents * l.quantity, currency: 'ZAR' })}
                    </Text>
                  </Row>
                ))}
                <Divider />
                <Row justify="space-between" style={styles.line}>
                  <Text variant="bodyStrong">Paid</Text>
                  <Text variant="bodyStrong">{formatMoney(o.total)}</Text>
                </Row>
              </Card>

              <Button
                label="Directions to the counter"
                icon="navigate"
                variant="secondary"
                fullWidth
                onPress={() => router.push(`/campus-map?to=SC`)}
              />
              <Button
                label="Back to Home"
                variant="ghost"
                fullWidth
                onPress={() => router.dismissTo('/home')}
                testID="order-home"
              />
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: 'center', gap: spacing.xs },
  qr: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
  },
  step: { paddingVertical: spacing.sm },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.yellow, borderColor: colors.yellow },
  line: { paddingVertical: spacing.sm },
});
