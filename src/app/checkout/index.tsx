import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { PaymentMethod } from '@/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from '@/components/ui';
import { FoodImage } from '@/components/food/FoodImage';
import { OrderTotals } from '@/features/cart/components/OrderTotals';
import { FulfilmentSelector } from '@/features/home/components/FulfilmentSelector';
import { usePaymentMethods } from '@/features/account/hooks';
import { usePlaceOrder } from '@/features/orders/hooks';
import { useStoresForFulfilment } from '@/features/stores/hooks';
import { authorisePayment, describePaymentMethod, voidPayment } from '@/services/paymentService';
import { submitOrder } from '@/features/checkout/submitOrder';
import { useCartReconciliation } from '@/features/cart/useCartReconciliation';
import { useNow } from '@/features/system/useNow';
import { preferredStore } from '@/features/stores/opening';
import { useCartStore } from '@/store/cartStore';
import { missingFulfilmentRequirement, useFulfilmentStore } from '@/store/fulfilmentStore';
import { colors, radius, spacing } from '@/theme';
import { describeOptions, meetsDeliveryMinimum } from '@/utils/cart';
import { formatDateTime, formatEtaWindow } from '@/utils/datetime';
import { formatPrice } from '@/utils/money';

/**
 * Checkout (brief §11): fulfilment, location, payment, review and confirm — as
 * one reviewable screen with each step routing out to its own picker. Fewer
 * dead-end steps than a wizard, and the customer can always see the total.
 */
export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const lines = useCartStore((state) => state.lines);
  const getTotals = useCartStore((state) => state.getTotals);
  const voucher = useCartStore((state) => state.voucher);
  const reward = useCartStore((state) => state.reward);
  const clearCart = useCartStore((state) => state.clear);
  const setCartFulfilment = useCartStore((state) => state.setFulfilmentType);

  const fulfilmentType = useFulfilmentStore((state) => state.fulfilmentType);
  const setFulfilmentType = useFulfilmentStore((state) => state.setFulfilmentType);
  const store = useFulfilmentStore((state) => state.store);
  const setStore = useFulfilmentStore((state) => state.setStore);
  const address = useFulfilmentStore((state) => state.address);
  const deliveryInstructions = useFulfilmentStore((state) => state.deliveryInstructions);
  const tableNumber = useFulfilmentStore((state) => state.tableNumber);
  const setTableNumber = useFulfilmentStore((state) => state.setTableNumber);
  const scheduledFor = useFulfilmentStore((state) => state.scheduledFor);
  const resetFulfilment = useFulfilmentStore((state) => state.reset);

  // Two of the fulfilment rules are about *now* — whether the branch is
  // trading and whether the scheduled slot has passed — and a memo over state
  // cannot see the clock move. Without this the screen keeps showing the
  // answer it worked out when it opened.
  const now = useNow();

  const paymentMethods = usePaymentMethods();
  const availableStores = useStoresForFulfilment(fulfilmentType);
  const placeOrder = usePlaceOrder();

  /**
   * Checkout reconciles too, not only the cart.
   *
   * This is the screen where the totals become a charge, and a customer can
   * reach it without the cart having reconciled recently — deep-linked, or
   * left sitting here while the menu moved. Running it again costs nothing
   * when the basket already agrees, and the notice it produces is stored, so
   * they still see what changed.
   */
  const reconciliation = useCartReconciliation();

  const [chosenPaymentId, setChosenPaymentId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totals = getTotals();

  /** Rails offered for this fulfilment type — cash is delivery-only. */
  const offeredPaymentMethods = useMemo(
    () =>
      (paymentMethods.data ?? []).filter(
        (method) => method.type !== 'cash' || fulfilmentType === 'delivery',
      ),
    [paymentMethods.data, fulfilmentType],
  );

  /**
   * The selected rail is derived, not synced through an effect: the customer's
   * choice wins while it is still offered, otherwise we fall back to their
   * default card. Switching away from delivery therefore drops a cash
   * selection automatically, with no intermediate render where the CTA is
   * wrongly blocked.
   */
  const selectedPayment: PaymentMethod | undefined = useMemo(() => {
    const chosen = offeredPaymentMethods.find((method) => method.id === chosenPaymentId);
    if (chosen) return chosen;
    return offeredPaymentMethods.find((method) => method.isDefault) ?? offeredPaymentMethods[0];
  }, [offeredPaymentMethods, chosenPaymentId]);

  const selectedPaymentId = selectedPayment?.id ?? null;

  // Pre-selecting a store is a store-level side effect, not render state, so
  // it stays in an effect — but only fires when nothing is chosen, and picks
  // the nearest branch that can actually take the order rather than the
  // nearest branch full stop. See `preferredStore`.
  useEffect(() => {
    if (store) return;
    const suggested = preferredStore(availableStores.data ?? []);
    if (suggested) setStore(suggested);
  }, [store, availableStores.data, setStore]);

  const blocker = useMemo(() => {
    if (lines.length === 0) return 'Your cart is empty';
    if (!meetsDeliveryMinimum(totals.subtotal, fulfilmentType)) {
      return 'Below the delivery minimum';
    }
    const fulfilmentBlocker = missingFulfilmentRequirement({
      fulfilmentType,
      store,
      address,
      tableNumber,
      scheduledFor,
      now,
    });
    if (fulfilmentBlocker) return fulfilmentBlocker;
    if (!selectedPayment) return 'Choose a payment method';
    return null;
  }, [
    lines.length,
    totals.subtotal,
    fulfilmentType,
    store,
    address,
    tableNumber,
    scheduledFor,
    selectedPayment,
    now,
  ]);

  const etaMinutes = (store?.preparationMinutes ?? 18) + (fulfilmentType === 'delivery' ? 20 : 0);

  const handlePlaceOrder = useCallback(async () => {
    if (blocker || !store || !selectedPayment) return;

    // Re-checked against a fresh clock rather than trusting `blocker`, which
    // was computed on some earlier render. The tick above keeps the screen
    // honest, but a tick is a re-render and this is a tap — between the two
    // the clock can have crossed the scheduled slot or the branch's closing
    // time, and this is the line where the money moves.
    const stillBlocked = missingFulfilmentRequirement({
      fulfilmentType,
      store,
      address,
      tableNumber,
      scheduledFor,
      now: new Date(),
    });
    if (stillBlocked) {
      setSubmitError(stillBlocked);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Authorise, create the order, and give the money back if the order does
      // not happen. The sequence lives in `submitOrder` because it is the one
      // place in the app where getting it wrong costs a customer money, and it
      // needs to be testable without a screen.
      const outcome = await submitOrder(
        {
          amount: totals.total,
          paymentMethodId: selectedPayment.id,
          methodType: selectedPayment.type,
          orderReference: 'pending',
        },
        {
          lines,
          totals,
          fulfilmentType,
          storeId: store.id,
          ...(address ? { addressId: address.id } : {}),
          ...(fulfilmentType === 'dinein' ? { tableNumber } : {}),
          ...(scheduledFor ? { scheduledFor } : {}),
          paymentMethodId: selectedPayment.id,
          ...(voucher ? { voucherCode: voucher.code } : {}),
          ...(reward ? { redeemedRewardId: reward.rewardId } : {}),
        },
        {
          authorise: authorisePayment,
          place: (input) => placeOrder.mutateAsync(input),
          release: voidPayment,
        },
      );

      if (outcome.status !== 'placed') {
        setSubmitError(outcome.message);
        return;
      }

      // The basket has become an order — clear it before navigating so back
      // navigation can never resubmit.
      clearCart();
      resetFulfilment();
      router.replace(`/order/${outcome.order.id}/confirmation`);
    } finally {
      setSubmitting(false);
    }
  }, [
    blocker,
    store,
    selectedPayment,
    totals,
    lines,
    fulfilmentType,
    address,
    tableNumber,
    scheduledFor,
    voucher,
    reward,
    placeOrder,
    clearCart,
    resetFulfilment,
    router,
  ]);

  if (lines.length === 0) {
    return (
      <Screen edges={['top', 'bottom']} testID="checkout-empty">
        <ScreenHeader title="Checkout" />
        <EmptyState
          icon="basket-outline"
          title="Nothing to check out"
          message="Add something to your cart first."
          actionLabel="Browse the menu"
          onActionPress={() => router.replace('/(tabs)/menu')}
        />
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="Checkout"
          subtitle={`${lines.length} item${lines.length === 1 ? '' : 's'}`}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        testID="checkout-screen"
      >
        {/* Fulfilment */}
        <Card style={styles.card}>
          <Text variant="h3">How are you getting it?</Text>
          <FulfilmentSelector
            value={fulfilmentType}
            onChange={(next) => {
              setFulfilmentType(next);
              setCartFulfilment(next);
            }}
            compact
          />
        </Card>

        {/* Store */}
        <Card onPress={() => router.push('/checkout/store')} style={styles.card}>
          <SummaryRow
            icon="storefront-outline"
            label={fulfilmentType === 'delivery' ? 'Cooked at' : 'Store'}
            value={store?.name ?? 'Choose a store'}
            detail={store ? `${store.suburb}, ${store.city}` : undefined}
            complete={Boolean(store)}
          />
        </Card>

        {/* Delivery address / table */}
        {fulfilmentType === 'delivery' ? (
          <Card onPress={() => router.push('/checkout/address')} style={styles.card}>
            <SummaryRow
              icon="location-outline"
              label="Delivering to"
              value={address ? `${address.label} · ${address.line1}` : 'Add a delivery address'}
              detail={
                address
                  ? [address.suburb, deliveryInstructions].filter(Boolean).join(' · ')
                  : undefined
              }
              complete={Boolean(address)}
            />
          </Card>
        ) : null}

        {fulfilmentType === 'dinein' ? (
          <Card style={styles.card}>
            <TextField
              label="Table number"
              value={tableNumber}
              onChangeText={setTableNumber}
              placeholder="e.g. 12"
              keyboardType="number-pad"
              iconLeft="restaurant-outline"
              helperText="We bring it to your table."
              required
              testID="checkout-table-number"
            />
          </Card>
        ) : null}

        {/* Timing */}
        <Card onPress={() => router.push('/checkout/schedule')} style={styles.card}>
          <SummaryRow
            icon="time-outline"
            label="When"
            value={scheduledFor ? formatDateTime(scheduledFor) : 'As soon as possible'}
            detail={
              scheduledFor
                ? 'Scheduled'
                : `${fulfilmentType === 'delivery' ? 'Arriving in' : 'Ready in'} ${formatEtaWindow(etaMinutes)}`
            }
            complete
          />
        </Card>

        {/* Payment */}
        <Card style={styles.card}>
          <Text variant="h3">Payment</Text>

          {offeredPaymentMethods.map((method) => {
            const selected = method.id === selectedPaymentId;
            return (
              <Pressable
                key={method.id}
                onPress={() => setChosenPaymentId(method.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={method.label}
                testID={`payment-${method.id}`}
                style={({ pressed }) => [
                  styles.paymentRow,
                  selected ? styles.paymentRowSelected : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Ionicons
                  name={paymentIcon(method)}
                  size={20}
                  color={selected ? colors.primary : colors.textSecondary}
                />
                <View style={styles.paymentBody}>
                  <Text variant="bodyMedium">{method.label}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {method.expiry
                      ? `Expires ${method.expiry}`
                      : describePaymentMethod(method.type)}
                  </Text>
                </View>
                {method.isDefault ? <Badge label="Default" tone="neutral" /> : null}
                <View style={[styles.radio, selected ? styles.radioSelected : null]}>
                  {selected ? <Ionicons name="ellipse" size={10} color={colors.onPrimary} /> : null}
                </View>
              </Pressable>
            );
          })}

          <Button
            label="Manage payment methods"
            onPress={() => router.push('/account/payment-methods')}
            variant="text"
            size="sm"
            preserveCase
          />
        </Card>

        {/* Order review */}
        <Card style={styles.card}>
          <Text variant="h3">Your order</Text>

          {lines.map((line) => (
            <View key={line.id} style={styles.reviewLine}>
              <FoodImage
                assetKey={line.assetKey}
                variant="thumb"
                rounded="sm"
                compactPlaceholder
                style={styles.reviewImage}
              />
              <View style={styles.reviewBody}>
                <Text variant="bodyMedium" numberOfLines={1}>
                  {line.quantity} × {line.name}
                </Text>
                {describeOptions(line).length > 0 ? (
                  <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
                    {describeOptions(line)}
                  </Text>
                ) : null}
                {line.specialInstructions ? (
                  <Text variant="caption" color={colors.textMuted} numberOfLines={2}>
                    “{line.specialInstructions}”
                  </Text>
                ) : null}
              </View>
              <Text variant="bodyMedium">{formatPrice(line.lineTotal)}</Text>
            </View>
          ))}

          <Button label="Edit cart" onPress={() => router.push('/cart')} variant="text" size="sm" />
        </Card>

        {/* Totals */}
        <Card style={styles.card}>
          <OrderTotals
            totals={totals}
            fulfilmentType={fulfilmentType}
            {...(voucher ? { voucherCode: voucher.code } : {})}
            {...(reward ? { rewardName: reward.name } : {})}
          />
        </Card>

        {/* A basket repriced on the way to payment must not be repriced
            silently — this is the screen where the number becomes a charge. */}
        {reconciliation.notice ? (
          <View style={styles.errorBox} accessibilityRole="alert" testID="checkout-reprice-notice">
            <Ionicons name="information-circle" size={17} color={colors.status.info} />
            <Text variant="caption" color={colors.textSecondary} style={styles.errorText}>
              {reconciliation.notice}
            </Text>
          </View>
        ) : null}

        {submitError ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={17} color={colors.status.error} />
            <Text variant="caption" color={colors.status.error} style={styles.errorText}>
              {submitError}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {/* The caption says what is missing; the button says what it does.
            Both carried the blocker text at one point, which stacked the same
            sentence twice and left a disabled control looking like the action
            that would fix it. */}
        {blocker ? (
          <Text variant="caption" color={colors.status.warning} align="center">
            {blocker}
          </Text>
        ) : null}
        <Button
          label="Place order"
          onPress={() => void handlePlaceOrder()}
          trailingLabel={formatPrice(totals.total)}
          disabled={Boolean(blocker)}
          loading={submitting}
          size="lg"
          testID="checkout-place-order"
        />
      </View>
    </View>
  );
}

function paymentIcon(method: PaymentMethod): keyof typeof Ionicons.glyphMap {
  switch (method.type) {
    case 'card':
      return 'card-outline';
    case 'eft':
      return 'business-outline';
    case 'snapscan':
      return 'qr-code-outline';
    case 'cash':
      return 'cash-outline';
    case 'applepay':
      return 'logo-apple';
    case 'googlepay':
      return 'logo-google';
  }
}

interface SummaryRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  detail?: string | undefined;
  complete: boolean;
}

function SummaryRow({ icon, label, value, detail, complete }: SummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <View style={[styles.summaryIcon, complete ? null : styles.summaryIconIncomplete]}>
        <Ionicons name={icon} size={19} color={complete ? colors.primary : colors.status.warning} />
      </View>

      <View style={styles.summaryBody}>
        <Text variant="caption" color={colors.textMuted}>
          {label}
        </Text>
        <Text variant="bodyMedium" numberOfLines={1}>
          {value}
        </Text>
        {detail ? (
          <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.backgroundAlt },
  header: {
    paddingHorizontal: spacing.gutter,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  summaryIconIncomplete: { backgroundColor: colors.status.warningSoft },
  summaryBody: { flex: 1, gap: spacing.xxs },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  paymentRowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  paymentBody: { flex: 1, gap: spacing.xxs },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  reviewLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reviewImage: { width: 48, borderRadius: radius.sm },
  reviewBody: { flex: 1, gap: spacing.xxs },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.status.errorSoft,
  },
  errorText: { flex: 1 },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
});
