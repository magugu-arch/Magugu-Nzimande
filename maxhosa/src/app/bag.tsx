import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { AssetImage } from '@/components/AssetImage';
import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { PressableScale } from '@/components/PressableScale';
import { SheetScaffold } from '@/components/SheetScaffold';
import { EmptyState } from '@/components/States';
import { Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { toast } from '@/components/Toast';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { multiply, sum } from '@/domain/money';
import { useFormatMoney, useMarket, useProducts } from '@/features/catalogue';
import { MAX_QUANTITY, useBag } from '@/store/bag';

export default function Bag() {
  const { colors } = useTheme();
  const market = useMarket();
  const format = useFormatMoney();
  const products = useProducts();
  const lines = useBag((s) => s.lines);
  const setQuantity = useBag((s) => s.setQuantity);
  const remove = useBag((s) => s.remove);
  const restore = useBag((s) => s.restore);

  const rows = useMemo(
    () =>
      lines
        .map((line) => {
          const product = products.data?.find((p) => p.id === line.productId);
          if (!product) return null;
          const stock =
            product.variants.find((v) => v.id === line.variantId)?.stock ?? 'unavailable';
          return { line, product, stock, total: multiply(product.price, line.quantity) };
        })
        .filter((r) => !!r),
    [lines, products.data],
  );
  const subtotal = rows.length
    ? sum(
        rows.map((r) => r.total),
        market.currencyCode,
      )
    : null;
  const blocked = rows.some((r) => r.stock === 'unavailable');

  const removeLine = (variantId: string, name: string) => {
    const removed = remove(variantId);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Forgiveness over confirmation: remove at once, offer Undo.
    if (removed)
      toast({
        message: `${name} removed`,
        icon: 'trash-outline',
        offset: 'none',
        action: { label: 'Undo', run: () => restore(removed.line, removed.index) },
      });
  };

  if (!lines.length) {
    return (
      <SheetScaffold title="Bag">
        <EmptyState
          icon="bag-outline"
          title="Your bag is empty"
          body="Pieces you add will wait here. Nothing in this demo is a real order."
          action={{
            label: 'Shop new arrivals',
            onPress: () => {
              router.back();
              router.navigate('/shop');
            },
          }}
        />
      </SheetScaffold>
    );
  }

  return (
    <SheetScaffold
      title="Bag"
      footer={
        <Button
          label="Continue to checkout (demo)"
          icon="shield-checkmark-outline"
          disabled={blocked}
          accessibilityHint={
            blocked ? 'Remove pieces that are no longer available first' : undefined
          }
          onPress={() => router.push('/checkout')}
        />
      }
    >
      <Callout title="Demo — no real order or payment.">
        Prices are sample prices for {market.label}. Checkout re-checks price and stock before
        anything is charged.
      </Callout>
      {rows.map(({ line, product, stock, total }) => (
        <Animated.View
          key={line.variantId}
          layout={LinearTransition}
          exiting={FadeOut.duration(160)}
          style={[styles.line, { borderColor: colors.hairline }]}
        >
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Open ${product.name}`}
            onPress={() => {
              router.back();
              router.push({ pathname: '/product/[id]', params: { id: product.id } });
            }}
          >
            <AssetImage assetId={product.media[0]!.assetId} decorative style={styles.thumb} />
          </PressableScale>
          <View style={styles.lineBody}>
            <Text variant="callout" weight="600">
              {product.name}
            </Text>
            <Text variant="footnote" color="ink3">
              Size {line.size} · {product.code}
            </Text>
            <Text variant="footnote" color="ink3">
              {format(product.price)} each
            </Text>
            {stock === 'preorder' ? (
              <Tag
                label={`Pre-order · sample lead time ${product.preorder?.leadTime ?? 'to be confirmed'}`}
                tone="warn"
                icon="time-outline"
              />
            ) : null}
            {stock === 'unavailable' ? (
              <Tag
                label="No longer available — remove to continue"
                tone="bad"
                icon="alert-circle-outline"
              />
            ) : null}
            <View style={styles.lineFoot}>
              <View
                style={[styles.stepper, { borderColor: colors.hairlineStrong }]}
                accessibilityRole="adjustable"
                accessibilityLabel={`Quantity of ${product.name}`}
                accessibilityValue={{ now: line.quantity, min: 1, max: MAX_QUANTITY }}
              >
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={
                    line.quantity === 1
                      ? `Remove ${product.name}`
                      : `Decrease quantity of ${product.name}`
                  }
                  onPress={() =>
                    line.quantity === 1
                      ? removeLine(line.variantId, product.name)
                      : setQuantity(line.variantId, line.quantity - 1)
                  }
                  style={styles.step}
                >
                  <Ionicons
                    name={line.quantity === 1 ? 'trash-outline' : 'remove'}
                    size={16}
                    color={colors.ink}
                  />
                </PressableScale>
                <Text variant="callout" weight="600" style={styles.qty}>
                  {line.quantity}
                </Text>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Increase quantity of ${product.name}`}
                  accessibilityState={{ disabled: line.quantity >= MAX_QUANTITY }}
                  onPress={() => setQuantity(line.variantId, line.quantity + 1)}
                  style={[styles.step, line.quantity >= MAX_QUANTITY && { opacity: 0.35 }]}
                >
                  <Ionicons name="add" size={16} color={colors.ink} />
                </PressableScale>
              </View>
              <Text variant="callout" weight="600" style={{ fontVariant: ['tabular-nums'] }}>
                {format(total)}
              </Text>
            </View>
          </View>
        </Animated.View>
      ))}
      <View style={styles.totals}>
        <Total label="Subtotal (sample)" value={subtotal ? format(subtotal) : '—'} />
        <Total label="Delivery" value="Calculated at checkout" />
        <Total label="Duties and taxes" value="Depend on your market — shown by checkout" />
        <View style={[styles.grand, { borderColor: colors.hairlineStrong }]}>
          <Total label="Total" value="Calculated at checkout" strong />
        </View>
      </View>
    </SheetScaffold>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text variant="callout" color={strong ? 'ink' : 'ink2'} weight={strong ? '600' : undefined}>
        {label}
      </Text>
      <Text
        variant="callout"
        weight={strong ? '600' : undefined}
        align="right"
        style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    gap: space.m,
    paddingVertical: space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 80, aspectRatio: 4 / 5, borderRadius: 8 },
  lineBody: { flex: 1, gap: 3 },
  lineFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.s,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  step: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 22, textAlign: 'center', fontVariant: ['tabular-nums'] },
  totals: { gap: space.s, marginTop: space.l },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.l },
  grand: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.m, marginTop: space.xs },
});
