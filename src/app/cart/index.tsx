import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { CartLineRow } from '@/features/cart/components/CartLineRow';
import { OrderTotals } from '@/features/cart/components/OrderTotals';
import { FulfilmentSelector } from '@/features/home/components/FulfilmentSelector';
import { useValidateVoucher } from '@/features/rewards/hooks';
import { businessRules } from '@/constants/config';
import { useCartStore } from '@/store/cartStore';
import { useFulfilmentStore } from '@/store/fulfilmentStore';
import { colors, radius, spacing, typography } from '@/theme';
import { meetsDeliveryMinimum } from '@/utils/cart';
import { formatPrice } from '@/utils/money';

/**
 * Cart (brief §11): product, image, quantity, edit, remove, add more, promo
 * code, rewards redemption, subtotal, delivery fee and total.
 */
export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const lines = useCartStore((state) => state.lines);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const clear = useCartStore((state) => state.clear);
  const getTotals = useCartStore((state) => state.getTotals);
  const voucher = useCartStore((state) => state.voucher);
  const applyVoucher = useCartStore((state) => state.applyVoucher);
  const removeVoucher = useCartStore((state) => state.removeVoucher);
  const reward = useCartStore((state) => state.reward);
  const removeReward = useCartStore((state) => state.removeReward);
  const setCartFulfilment = useCartStore((state) => state.setFulfilmentType);

  const fulfilmentType = useFulfilmentStore((state) => state.fulfilmentType);
  const setFulfilmentType = useFulfilmentStore((state) => state.setFulfilmentType);

  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const validateVoucher = useValidateVoucher();

  const totals = getTotals();
  const belowMinimum = !meetsDeliveryMinimum(totals.subtotal, fulfilmentType);

  const handleFulfilmentChange = useCallback(
    (next: typeof fulfilmentType) => {
      setFulfilmentType(next);
      setCartFulfilment(next);
    },
    [setFulfilmentType, setCartFulfilment],
  );

  const handleApplyPromo = useCallback(async () => {
    setPromoError(null);
    try {
      const result = await validateVoucher.mutateAsync({
        code: promoCode,
        subtotal: totals.subtotal,
      });
      applyVoucher({
        code: result.voucher.code,
        discount: result.discount,
        freeDelivery: result.freeDelivery,
      });
      setPromoCode('');
    } catch (error) {
      setPromoError(error instanceof Error ? error.message : 'That code did not work.');
    }
  }, [promoCode, totals.subtotal, validateVoucher, applyVoucher]);

  const handleClear = useCallback(() => {
    Alert.alert('Empty your cart?', 'This removes everything you have added so far.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Empty cart', style: 'destructive', onPress: clear },
    ]);
  }, [clear]);

  if (lines.length === 0) {
    return (
      <Screen edges={['top', 'bottom']} testID="cart-empty-screen">
        <ScreenHeader title="Your cart" />
        <EmptyState
          icon="basket-outline"
          title="Your cart is empty"
          message="Nothing in here yet. Have a look at what is coming out of the fryer."
          actionLabel="Browse the menu"
          onActionPress={() => router.replace('/(tabs)/menu')}
          testID="cart-empty-state"
        />
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <ScreenHeader
          title="Your cart"
          subtitle={`${lines.length} item${lines.length === 1 ? '' : 's'}`}
          right={
            <Pressable
              onPress={handleClear}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Empty cart"
            >
              <Text variant="captionMedium" color={colors.status.error}>
                Clear
              </Text>
            </Pressable>
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        testID="cart-screen"
      >
        {/* Fulfilment */}
        <View style={styles.block}>
          <Text variant="h3">How are you getting it?</Text>
          <FulfilmentSelector value={fulfilmentType} onChange={handleFulfilmentChange} compact />
        </View>

        {/* Lines */}
        <View style={styles.block}>
          {lines.map((line, index) => (
            <View key={line.id}>
              {index > 0 ? <View style={styles.separator} /> : null}
              <CartLineRow
                line={line}
                onQuantityChange={(quantity) => updateQuantity(line.id, quantity)}
                onRemove={() => removeLine(line.id)}
                onEdit={() => router.push(`/product/${line.productId}`)}
                testID={`cart-line-${line.id}`}
              />
            </View>
          ))}

          <Button
            label="Add more items"
            onPress={() => router.push('/(tabs)/menu')}
            variant="tertiary"
            iconLeft="add"
            style={styles.addMore}
          />
        </View>

        {/* Promo code */}
        <Card style={styles.block}>
          <Text variant="h3">Promo code</Text>

          {voucher ? (
            <View style={styles.appliedRow}>
              <Badge label={voucher.code} tone="success" icon="checkmark-circle" />
              <Text variant="caption" color={colors.textSecondary} style={styles.appliedText}>
                {voucher.freeDelivery
                  ? 'Free delivery applied'
                  : `${formatPrice(voucher.discount)} off applied`}
              </Text>
              <Pressable
                onPress={removeVoucher}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove promo code ${voucher.code}`}
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.promoRow}>
                <TextInput
                  value={promoCode}
                  onChangeText={(text) => {
                    setPromoCode(text.toUpperCase());
                    setPromoError(null);
                  }}
                  placeholder="Enter code"
                  placeholderTextColor={colors.textDisabled}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.promoInput}
                  accessibilityLabel="Promo code"
                  testID="cart-promo-input"
                />
                <Button
                  label="Apply"
                  onPress={() => void handleApplyPromo()}
                  loading={validateVoucher.isPending}
                  disabled={promoCode.trim().length === 0}
                  variant="secondary"
                  fullWidth={false}
                  testID="cart-promo-apply"
                />
              </View>
              {promoError ? (
                <Text variant="caption" color={colors.status.error} accessibilityRole="alert">
                  {promoError}
                </Text>
              ) : null}
            </>
          )}
        </Card>

        {/* Rewards redemption */}
        <Card
          onPress={reward ? undefined : () => router.push('/(tabs)/rewards')}
          style={styles.block}
          accessibilityLabel="Redeem a reward"
        >
          <View style={styles.rewardRow}>
            <View style={styles.rewardIcon}>
              <Ionicons name="gift-outline" size={19} color={colors.primary} />
            </View>

            <View style={styles.rewardBody}>
              <Text variant="bodyMedium">{reward ? reward.name : 'Use a reward'}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {reward
                  ? `${formatPrice(reward.discount)} off · ${reward.pointsCost.toLocaleString('en-ZA')} points`
                  : 'Spend your bb.q points on this order'}
              </Text>
            </View>

            {reward ? (
              <Pressable
                onPress={removeReward}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Remove reward"
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
            )}
          </View>
        </Card>

        {/* Totals */}
        <Card style={styles.block}>
          <OrderTotals
            totals={totals}
            fulfilmentType={fulfilmentType}
            {...(voucher ? { voucherCode: voucher.code } : {})}
            {...(reward ? { rewardName: reward.name } : {})}
          />
        </Card>

        <Divider spacingSize="none" />
      </ScrollView>

      {/* Checkout CTA */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {belowMinimum ? (
          <View style={styles.minimumWarning} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={15} color={colors.status.warning} />
            <Text variant="caption" color={colors.status.warning} style={styles.minimumText}>
              Delivery orders start at {formatPrice(businessRules.minimumDeliverySubtotal)}. Add{' '}
              {formatPrice(businessRules.minimumDeliverySubtotal - totals.subtotal)} more, or switch
              to collection.
            </Text>
          </View>
        ) : null}

        <Button
          label="Go to checkout"
          onPress={() => router.push('/checkout')}
          trailingLabel={formatPrice(totals.total)}
          disabled={belowMinimum}
          size="lg"
          testID="cart-checkout"
        />
      </View>
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
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  block: { gap: spacing.md },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  addMore: { marginTop: spacing.sm },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  promoInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  appliedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  appliedText: { flex: 1 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  rewardBody: { flex: 1, gap: spacing.xxs },
  footer: {
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  minimumWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.status.warningSoft,
  },
  minimumText: { flex: 1 },
});
