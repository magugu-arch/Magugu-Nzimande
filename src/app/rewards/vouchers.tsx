import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Voucher } from '@/types';
import {
  Badge,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { useVouchers } from '@/features/rewards/hooks';
import { useCartStore } from '@/store/cartStore';
import { colors, radius, spacing } from '@/theme';
import { formatShortDate } from '@/utils/datetime';
import { formatPrice } from '@/utils/money';

type Filter = 'active' | 'used';

function describeDiscount(voucher: Voucher): string {
  switch (voucher.discountType) {
    case 'fixed':
      return `${formatPrice(voucher.discountValue)} off`;
    case 'percentage':
      return `${voucher.discountValue}% off`;
    case 'freeDelivery':
      return 'Free delivery';
    case 'freeItem':
      return 'Free item';
  }
}

/** Voucher Wallet (brief §4). */
export default function VoucherWalletScreen() {
  const router = useRouter();
  const vouchers = useVouchers();
  const applyVoucher = useCartStore((state) => state.applyVoucher);
  const cartLines = useCartStore((state) => state.lines);

  const [filter, setFilter] = useState<Filter>('active');

  // Expiry is resolved by the service at fetch time, so this is a pure split.
  const { active, used } = useMemo(() => {
    const list = vouchers.data ?? [];
    return {
      active: list.filter((voucher) => !voucher.used && !voucher.expired),
      used: list.filter((voucher) => voucher.used || voucher.expired),
    };
  }, [vouchers.data]);

  const visible = filter === 'active' ? active : used;

  if (vouchers.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Voucher wallet" />
        <LoadingState />
      </Screen>
    );
  }

  if (vouchers.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Voucher wallet" />
        <ErrorState onRetry={() => void vouchers.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom']} testID="voucher-wallet-screen">
      <ScreenHeader title="Voucher wallet" />

      <View style={styles.filters}>
        <Chip
          label={`Active${active.length > 0 ? ` (${active.length})` : ''}`}
          selected={filter === 'active'}
          onPress={() => setFilter('active')}
        />
        <Chip
          label="Used & expired"
          selected={filter === 'used'}
          onPress={() => setFilter('used')}
        />
      </View>

      {visible.length === 0 ? (
        <EmptyState
          icon="ticket-outline"
          title={filter === 'active' ? 'No vouchers yet' : 'Nothing here'}
          message={
            filter === 'active'
              ? 'Vouchers you earn or receive land here, ready to use at checkout.'
              : 'Vouchers you have used or that have expired will show up here.'
          }
          actionLabel={filter === 'active' ? 'See offers' : undefined}
          onActionPress={filter === 'active' ? () => router.push('/offers') : undefined}
        />
      ) : (
        <View style={styles.list}>
          {visible.map((voucher) => {
            const spent = voucher.used || voucher.expired;

            return (
              <Card
                key={voucher.id}
                onPress={
                  spent
                    ? undefined
                    : () => {
                        applyVoucher({
                          code: voucher.code,
                          discount: voucher.discountType === 'fixed' ? voucher.discountValue : 0,
                          freeDelivery: voucher.discountType === 'freeDelivery',
                        });
                        router.push(cartLines.length > 0 ? '/cart' : '/(tabs)/menu');
                      }
                }
                style={spent ? styles.spentCard : undefined}
                accessibilityLabel={`${voucher.title}, code ${voucher.code}`}
                testID={`voucher-${voucher.id}`}
              >
                <View style={styles.voucherHeader}>
                  <View style={styles.voucherIcon}>
                    <Ionicons
                      name={voucher.discountType === 'freeDelivery' ? 'bicycle' : 'pricetag'}
                      size={19}
                      color={spent ? colors.textDisabled : colors.primary}
                    />
                  </View>

                  <View style={styles.voucherBody}>
                    <Text variant="h3" color={spent ? colors.textDisabled : colors.textPrimary}>
                      {voucher.title}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {voucher.description}
                    </Text>
                  </View>

                  <Badge label={describeDiscount(voucher)} tone={spent ? 'neutral' : 'primary'} />
                </View>

                <View style={styles.codeRow}>
                  <View style={styles.code}>
                    <Text variant="captionMedium" color={colors.textPrimary}>
                      {voucher.code}
                    </Text>
                  </View>

                  <Text
                    variant="caption"
                    color={
                      voucher.used
                        ? colors.textMuted
                        : voucher.expired
                          ? colors.status.error
                          : colors.textSecondary
                    }
                  >
                    {voucher.used
                      ? 'Already used'
                      : voucher.expired
                        ? `Expired ${formatShortDate(voucher.expiresAt)}`
                        : `Expires ${formatShortDate(voucher.expiresAt)}`}
                  </Text>
                </View>

                {voucher.minimumSpend > 0 && !spent ? (
                  <Text variant="caption" color={colors.textMuted}>
                    Minimum spend {formatPrice(voucher.minimumSpend)}
                  </Text>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.md },
  list: { gap: spacing.md, paddingBottom: spacing.xxxl },
  spentCard: { opacity: 0.6 },
  voucherHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  voucherIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  voucherBody: { flex: 1, gap: spacing.xxs },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  code: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAlt,
  },
});
