import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import { availabilitySummary } from '@/domain/catalogue';
import type { Product } from '@/domain/types';
import { useFormatMoney } from '@/features/catalogue';
import { useSaved } from '@/store/saved';
import { AssetImage } from './AssetImage';
import { PressableScale } from './PressableScale';
import { AvailabilityBadge } from './Tag';
import { Text } from './Text';
import { toast } from './Toast';

export function ProductCard({ product, width }: { product: Product; width?: number }) {
  const format = useFormatMoney();
  const price = format(product.price);
  const availability = availabilitySummary(product).label;
  return (
    <View style={[styles.card, width ? { width } : null]}>
      <PressableScale
        onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, ${price}, ${availability}, sample product`}
        pressedScale={0.98}
      >
        <AssetImage assetId={product.media[0]!.assetId} decorative style={styles.image} />
        <View style={styles.body}>
          <Text variant="subhead" weight="600" numberOfLines={2}>
            {product.name}
          </Text>
          <Text variant="subhead" color="ink2" style={{ fontVariant: ['tabular-nums'] }}>
            {price}
          </Text>
          <AvailabilityBadge product={product} />
        </View>
      </PressableScale>
      <View style={styles.save}>
        <WishlistButton productId={product.id} name={product.name} />
      </View>
    </View>
  );
}

export function WishlistButton({
  productId,
  name,
  onMedia,
}: {
  productId: string;
  name: string;
  onMedia?: boolean;
}) {
  const { colors } = useTheme();
  const saved = useSaved((s) => s.productIds.includes(productId));
  const toggle = useSaved((s) => s.toggle);
  return (
    <PressableScale
      onPress={() => {
        const nowSaved = toggle(productId);
        void Haptics.selectionAsync();
        toast({
          message: nowSaved ? 'Saved to this device' : 'Removed from Saved',
          icon: nowSaved ? 'heart' : 'heart-outline',
          action: nowSaved ? undefined : { label: 'Undo', run: () => toggle(productId) },
        });
      }}
      accessibilityRole="button"
      accessibilityLabel={`Save ${name}`}
      accessibilityState={{ selected: saved }}
      hitSlop={6}
      style={[styles.heart, onMedia && { backgroundColor: colors.material }]}
    >
      <Ionicons
        name={saved ? 'heart' : 'heart-outline'}
        size={20}
        color={saved ? colors.rust : '#16130F'}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0 },
  image: { aspectRatio: 4 / 5, borderRadius: radius.s },
  body: { paddingTop: space.s, gap: 3 },
  save: { position: 'absolute', top: space.xs, right: space.xs },
  heart: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
