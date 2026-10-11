import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { AssetImage } from '@/components/AssetImage';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { PressableScale } from '@/components/PressableScale';
import { ProductCard, WishlistButton } from '@/components/ProductCard';
import { HeaderButton, Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/States';
import { Tag } from '@/components/Tag';
import { Text } from '@/components/Text';
import { toast } from '@/components/Toast';
import { useTheme } from '@/design/theme';
import { radius, space } from '@/design/tokens';
import type { Product, ProductVariant } from '@/domain/types';
import { useFormatMoney, useMarket, useProduct, useProducts } from '@/features/catalogue';
import { openOfficialSite } from '@/features/links';
import { useBag } from '@/store/bag';
import { usePrefs } from '@/store/prefs';
import { useSaved } from '@/store/saved';

const PLACEHOLDER_STORY =
  'Editorial placeholder — awaiting brand-approved copy. Collection stories, motif meanings and cultural context are published only from text MAXHOSA AFRICA has approved.';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(id);
  const { width } = useWindowDimensions();

  if (product.status === 'loading') {
    return (
      <Screen title="">
        <LoadingSkeleton rows={1} />
      </Screen>
    );
  }
  if (product.status === 'error') {
    return (
      <Screen title="">
        <ErrorState onRetry={product.retry} />
      </Screen>
    );
  }
  if (!product.data) {
    return (
      <Screen title="Not found">
        <EmptyState
          icon="search"
          title="This piece isn’t available"
          body="It may have been removed from the catalogue."
        />
      </Screen>
    );
  }
  return <ProductDetail product={product.data} heroHeight={Math.min(width * 1.25, 640)} />;
}

function ProductDetail({ product, heroHeight }: { product: Product; heroHeight: number }) {
  const { colors } = useTheme();
  const format = useFormatMoney();
  const market = useMarket();
  const [variant, setVariant] = useState<ProductVariant | null>(null);
  const [needsChoice, setNeedsChoice] = useState(false);
  const [added, setAdded] = useState(false);
  const add = useBag((s) => s.add);
  const mySizes = usePrefs((s) => s.sizes);
  const requestRestock = useSaved((s) => s.requestRestock);
  const requested = useSaved((s) =>
    variant ? s.restock.some((r) => r.productId === product.id && r.size === variant.size) : false,
  );
  const all = useProducts();
  const price = format(product.price);

  const onPrimary = () => {
    if (!variant) {
      // Say what is needed, where it is needed — no disabled button to puzzle over.
      setNeedsChoice(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (variant.stock === 'unavailable') {
      requestRestock({ productId: product.id, size: variant.size });
      toast({
        message: 'Restock request saved on this device. Demo — no alert will be sent.',
        icon: 'notifications-outline',
        offset: 'action-bar',
      });
      return;
    }
    add({ productId: product.id, variantId: variant.id, size: variant.size });
    // Causality: label, badge and haptic change together, on this tap.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
    toast({
      message: `${product.name} · ${variant.size} added`,
      icon: 'bag-outline',
      offset: 'action-bar',
      action: { label: 'View bag', run: () => router.push('/bag') },
    });
  };

  const label = added
    ? 'Added to bag'
    : variant?.stock === 'unavailable'
      ? requested
        ? 'Restock requested'
        : 'Tell me if it returns'
      : `${variant?.stock === 'preorder' ? 'Pre-order' : 'Add to bag'} · ${price}`;

  return (
    <Screen
      title={product.name}
      hero={<Gallery product={product} height={heroHeight} />}
      heroHeight={heroHeight}
      right={
        <>
          <WishlistButton productId={product.id} name={product.name} onMedia />
          <HeaderButton
            icon="share-outline"
            label="Share"
            onMedia
            onPress={() =>
              void Share.share({
                message: `${product.name} — MAXHOSA AFRICA concept demo (sample product)`,
              })
            }
          />
        </>
      }
      actionBar={
        <Button
          label={label}
          icon={added ? 'checkmark' : undefined}
          onPress={onPrimary}
          testID="add-to-bag"
        />
      }
    >
      <View style={styles.body}>
        <View style={styles.tags}>
          <Tag label="Sample product" tone="sample" />
          <Tag label="Concept image" tone="sample" />
        </View>
        <Text variant="title" accessibilityRole="header" style={{ marginTop: space.s }}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>
            {price}
          </Text>
          <Text variant="footnote" color="ink3">
            Sample price · {market.label}
          </Text>
        </View>
        <Text variant="footnote" color="ink3">
          Style code {product.code}
        </Text>

        <View style={styles.sizeHead}>
          <Text variant="headline" accessibilityRole="header">
            Size
          </Text>
          {product.sizeGuideId ? (
            <PressableScale
              accessibilityRole="button"
              hitSlop={10}
              onPress={() =>
                router.push({ pathname: '/size-guide/[id]', params: { id: product.sizeGuideId! } })
              }
              style={styles.linkRow}
            >
              <Ionicons name="resize-outline" size={16} color={colors.ink2} />
              <Text
                variant="subhead"
                weight="600"
                color="ink2"
                style={{ textDecorationLine: 'underline' }}
              >
                Size guide
              </Text>
            </PressableScale>
          ) : null}
        </View>
        <Animated.View
          layout={LinearTransition}
          style={styles.sizes}
          accessibilityRole="radiogroup"
          accessibilityLabel="Size"
        >
          {product.variants.map((v) => {
            const mine = mySizes.includes(v.size);
            const word =
              v.stock === 'available'
                ? 'available'
                : v.stock === 'preorder'
                  ? 'pre-order'
                  : 'unavailable';
            return (
              <Chip
                key={v.id}
                tall
                kind="radio"
                label={v.size}
                icon={v.stock === 'preorder' ? 'time-outline' : mine ? 'ellipse' : undefined}
                struck={v.stock === 'unavailable'}
                selected={variant?.id === v.id}
                accessibilityLabel={`${v.size}, ${word}${mine ? ', your saved size' : ''}`}
                onPress={() => {
                  setVariant(v);
                  setNeedsChoice(false);
                  void Haptics.selectionAsync();
                }}
              />
            );
          })}
        </Animated.View>
        <SizeStatus product={product} variant={variant} needsChoice={needsChoice} />

        <View
          style={[styles.callout, { backgroundColor: colors.card, borderColor: colors.hairline }]}
        >
          <Ionicons name="car-outline" size={20} color={colors.ink} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Text variant="subhead" weight="600">
              Delivery and returns
            </Text>
            <Text variant="subhead" color="ink2">
              Delivery options, costs, duties and taxes for {market.label} are worked out by
              checkout for your address. This demo does not quote them.
            </Text>
            <PressableScale
              accessibilityRole="link"
              onPress={openOfficialSite}
              style={styles.linkRow}
            >
              <Text
                variant="subhead"
                weight="600"
                color="ink2"
                style={{ textDecorationLine: 'underline' }}
              >
                Current delivery and returns policies
              </Text>
              <Ionicons name="open-outline" size={14} color={colors.ink2} />
            </PressableScale>
          </View>
        </View>

        <Button
          label="Ask a stylist"
          icon="chatbubble-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: '/appointment', params: { product: product.id } })}
          style={{ alignSelf: 'flex-start', marginTop: space.l }}
        />

        <View style={[styles.accordion, { borderColor: colors.hairlineStrong }]}>
          <Accordion title="Details">
            Sample data: {product.colours.join(', ')} colourway. Fabric, composition and origin are
            shown here only when MAXHOSA’s product data confirms them.
          </Accordion>
          <Accordion title="Care">
            Care instructions come from the product record. None are shown for sample products.
          </Accordion>
          <Accordion title="The story">{PLACEHOLDER_STORY}</Accordion>
        </View>
      </View>

      {product.pairsWith.length && all.data ? (
        <View style={{ paddingTop: space.xxl }}>
          <View style={styles.pairHead}>
            <Text variant="heading" accessibilityRole="header">
              Complete the look
            </Text>
            <Tag label="Curated pairing · sample" tone="sample" />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            {product.pairsWith
              .map((pid) => all.data!.find((p) => p.id === pid))
              .filter((p) => !!p)
              .map((p) => (
                <ProductCard key={p.id} product={p} width={170} />
              ))}
          </ScrollView>
        </View>
      ) : null}
    </Screen>
  );
}

function Gallery({ product, height }: { product: Product; height: number }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  return (
    <View style={{ height }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        accessibilityLabel="Product images"
      >
        {product.media.map((m, i) => (
          <PressableScale
            key={m.assetId}
            pressedScale={1}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Image ${i + 1} of ${product.media.length}: ${m.alt} Opens zoom.`}
            onPress={() => router.push({ pathname: '/zoom/[asset]', params: { asset: m.assetId } })}
            style={{ width, height }}
          >
            <AssetImage
              assetId={m.assetId}
              decorative
              style={StyleSheet.absoluteFill}
              priority={i ? 'normal' : 'high'}
            />
          </PressableScale>
        ))}
      </ScrollView>
      {product.media.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {product.media.map((m, i) => (
            <View
              key={m.assetId}
              style={[
                styles.dot,
                { opacity: i === page ? 1 : 0.5, transform: [{ scale: i === page ? 1.2 : 1 }] },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SizeStatus({
  product,
  variant,
  needsChoice,
}: {
  product: Product;
  variant: ProductVariant | null;
  needsChoice: boolean;
}) {
  const { colors } = useTheme();
  let icon: keyof typeof Ionicons.glyphMap = 'information-circle-outline';
  let text = 'Choose a size to see its availability. Nothing is pre-selected.';
  let tint = colors.ink2;
  if (needsChoice) {
    icon = 'alert-circle-outline';
    text = 'Choose a size to add this to your bag.';
    tint = colors.rust;
  } else if (variant?.stock === 'available') {
    icon = 'checkmark';
    text = `${variant.size} is available (sample stock).`;
  } else if (variant?.stock === 'preorder') {
    icon = 'time-outline';
    text = `${variant.size} is pre-order. Sample lead time ${product.preorder?.leadTime ?? 'to be confirmed'} — the real lead time comes from MAXHOSA before you pay.`;
  } else if (variant) {
    icon = 'remove';
    text = `${variant.size} is unavailable. You can ask to hear if it returns (demo — nothing is sent).`;
  }
  return (
    <Animated.View
      key={text}
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(80)}
      style={styles.status}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={icon} size={16} color={tint} />
      <Text variant="subhead" style={{ color: tint, flex: 1 }}>
        {text}
      </Text>
    </Animated.View>
  );
}

function Accordion({ title, children }: { title: string; children: string | string[] }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Animated.View
      layout={LinearTransition}
      style={[styles.accItem, { borderColor: colors.hairlineStrong }]}
    >
      <PressableScale
        pressedScale={0.99}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.accHead}
      >
        <Text variant="callout" weight="600">
          {title}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.ink} />
      </PressableScale>
      {open ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(100)}
          style={{ paddingBottom: space.l }}
        >
          <Text variant="callout" color="ink2">
            {children}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, paddingTop: space.l },
  tags: { flexDirection: 'row', gap: space.s, flexWrap: 'wrap' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.s,
    flexWrap: 'wrap',
    marginTop: space.xs,
  },
  sizeHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.xl,
    marginBottom: space.s,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  status: {
    flexDirection: 'row',
    gap: space.s,
    alignItems: 'flex-start',
    marginTop: space.m,
    minHeight: 22,
  },
  callout: {
    flexDirection: 'row',
    gap: space.m,
    marginTop: space.xl,
    padding: space.l,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accordion: { marginTop: space.xl, borderTopWidth: StyleSheet.hairlineWidth },
  accItem: { borderBottomWidth: StyleSheet.hairlineWidth },
  accHead: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pairHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.gutter,
    paddingBottom: space.m,
  },
  rail: { paddingHorizontal: space.gutter, gap: space.m },
  dots: {
    position: 'absolute',
    bottom: space.m,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: space.s,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(22,19,15,0.32)',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFCF7' },
});
