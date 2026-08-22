import { useCallback, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { isSubstituted } from '@/constants/foodAssets';
import { FoodImage } from '@/components/food/FoodImage';
import {
  Badge,
  Button,
  Divider,
  ErrorState,
  LoadingState,
  QuantityStepper,
  Section,
  Text,
} from '@/components/ui';
import { OptionGroupPicker } from '@/features/menu/components/OptionGroupPicker';
import { ProductCard } from '@/features/menu/components/ProductCard';
import { useProduct, useProductsByIds } from '@/features/menu/hooks';
import { useCartStore } from '@/store/cartStore';
import { colors, radius, spacing, typography } from '@/theme';
import {
  defaultSelectionFor,
  resolveSelectedOptions,
  unmetOptionGroups,
  unitPriceFor,
} from '@/utils/cart';
import { formatPrice } from '@/utils/money';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_WIDTH * 1.05;

/**
 * Product Detail + Customisation + Add-ons (brief §11).
 *
 * All three live on one scroll rather than three routes: option groups are
 * data-driven, so a product with no options simply shows fewer sections and
 * the customer never hits a pointless intermediate screen.
 */
export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const product = useProduct(id);
  const addLine = useCartStore((state) => state.addLine);

  const [selection, setSelection] = useState<Record<string, string[]> | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);

  // Initialise the selection the first time the product resolves.
  const activeSelection = useMemo(() => {
    if (selection) return selection;
    return product.data ? defaultSelectionFor(product.data) : {};
  }, [selection, product.data]);

  const recommended = useProductsByIds(product.data?.recommendedProductIds ?? []);

  const selectedOptions = useMemo(() => {
    if (!product.data) return [];
    return resolveSelectedOptions(product.data.optionGroups, activeSelection);
  }, [product.data, activeSelection]);

  const unitPrice = product.data ? unitPriceFor(product.data.basePrice, selectedOptions) : 0;
  const lineTotal = unitPrice * quantity;

  const unmetGroups = useMemo(() => {
    if (!product.data) return [];
    return unmetOptionGroups(product.data.optionGroups, activeSelection);
  }, [product.data, activeSelection]);

  const handleOptionChange = useCallback(
    (groupId: string, optionIds: string[]) => {
      setShowRequiredErrors(false);
      setSelection({ ...activeSelection, [groupId]: optionIds });
    },
    [activeSelection],
  );

  const handleAddToCart = useCallback(() => {
    if (!product.data) return;

    if (unmetGroups.length > 0) {
      setShowRequiredErrors(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    addLine(product.data, selectedOptions, quantity, instructions);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [product.data, unmetGroups, addLine, selectedOptions, quantity, instructions, router]);

  if (product.isLoading) {
    return (
      <View style={styles.stateRoot}>
        <StatusBar style="dark" />
        <LoadingState />
      </View>
    );
  }

  if (product.isError || !product.data) {
    return (
      <View style={styles.stateRoot}>
        <StatusBar style="dark" />
        <ErrorState
          title="We can't find that item"
          message="It may have come off the menu. Browse what we have instead."
          onRetry={() => void product.refetch()}
        />
        <View style={styles.stateAction}>
          <Button label="Back to the menu" onPress={() => router.replace('/(tabs)/menu')} />
        </View>
      </View>
    );
  }

  const item = product.data;
  const ctaLabel =
    unmetGroups.length > 0 ? `Choose ${unmetGroups[0]?.name.toLowerCase()}` : 'Add to cart';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        testID="product-detail-screen"
      >
        {/* Hero: the strongest large food crop (brief §9) */}
        <View>
          <FoodImage
            assetKey={item.assetKey}
            variant="detail"
            aspectRatio={SCREEN_WIDTH / HERO_HEIGHT}
            rounded="none"
            style={styles.hero}
          />

          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/menu'))}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[styles.floatingButton, { top: insets.top + spacing.sm }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>

          {/*
            This product is borrowing a related product's photograph until its
            own shoot lands. Say so plainly rather than implying the pictured
            item is what arrives.
          */}
          {isSubstituted(item.assetKey) ? (
            <View style={styles.servingSuggestion}>
              <Ionicons name="camera-outline" size={12} color={colors.textOnDark} />
              <Text variant="micro" color={colors.textOnDark}>
                SERVING SUGGESTION
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.sheet}>
          {/* Title block */}
          <View style={styles.titleBlock}>
            <View style={styles.tagRow}>
              {item.tags.includes('bestseller') ? <Badge label="Bestseller" tone="dark" /> : null}
              {item.tags.includes('new') ? <Badge label="New" tone="primary" /> : null}
              {item.spiceLevel >= 2 ? (
                <Badge
                  label={item.spiceLevel === 3 ? 'Hot' : 'Mild heat'}
                  tone="warning"
                  icon="flame"
                />
              ) : null}
            </View>

            <Text variant="display">{item.name}</Text>
            <Text variant="bodyLarge" color={colors.textSecondary}>
              {item.description}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.meta}>
                <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                <Text variant="caption" color={colors.textSecondary}>
                  {item.preparationMinutes} min
                </Text>
              </View>
              <View style={styles.meta}>
                <Ionicons name="people-outline" size={15} color={colors.textMuted} />
                <Text variant="caption" color={colors.textSecondary}>
                  {item.serves}
                </Text>
              </View>
              <Text variant="price" color={colors.primary} style={styles.basePrice}>
                {formatPrice(item.basePrice)}
              </Text>
            </View>
          </View>

          <Divider />

          {/* Customisation, add-ons, sides, drinks */}
          {item.optionGroups.map((group) => (
            <View key={group.id} style={styles.groupBlock}>
              <OptionGroupPicker
                group={group}
                selectedIds={activeSelection[group.id] ?? []}
                onChange={(optionIds) => handleOptionChange(group.id, optionIds)}
                showRequiredError={showRequiredErrors}
              />
            </View>
          ))}

          {/* Special instructions */}
          <View style={styles.groupBlock}>
            <Text variant="h3">Anything else?</Text>
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="e.g. extra crispy, no spring onion, sauce on the side"
              placeholderTextColor={colors.textDisabled}
              multiline
              maxLength={200}
              style={styles.instructions}
              accessibilityLabel="Special instructions"
              testID="product-instructions"
            />
            <Text variant="caption" color={colors.textMuted} align="right">
              {instructions.length}/200
            </Text>
          </View>

          {/* Allergens */}
          {item.allergens.length > 0 ? (
            <View style={styles.allergens}>
              <Ionicons name="information-circle-outline" size={17} color={colors.textMuted} />
              <Text variant="caption" color={colors.textSecondary} style={styles.allergenText}>
                Contains {item.allergens.join(', ').toLowerCase()}. Prepared in a kitchen that
                handles other allergens.
              </Text>
            </View>
          ) : null}

          {/* Recommended add-ons */}
          {(recommended.data?.length ?? 0) > 0 ? (
            <Section title="Goes well with" bleed style={styles.recommended}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carousel}
              >
                {(recommended.data ?? []).map((suggestion) => (
                  <ProductCard
                    key={suggestion.id}
                    product={suggestion}
                    width={168}
                    onPress={() => router.push(`/product/${suggestion.id}`)}
                  />
                ))}
              </ScrollView>
            </Section>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky add-to-cart */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <QuantityStepper quantity={quantity} onChange={setQuantity} testID="product-quantity" />
        <Button
          label={ctaLabel}
          onPress={handleAddToCart}
          trailingLabel={unmetGroups.length > 0 ? undefined : formatPrice(lineTotal)}
          size="lg"
          style={styles.cta}
          testID="product-add-to-cart"
          preserveCase
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  stateRoot: { flex: 1, backgroundColor: colors.background },
  stateAction: { padding: spacing.lg },
  content: { paddingBottom: spacing.giant },
  hero: { width: SCREEN_WIDTH },
  servingSuggestion: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xxl + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(34,30,30,0.72)',
  },
  floatingButton: {
    position: 'absolute',
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  sheet: {
    marginTop: -spacing.xxl,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.xl,
    gap: spacing.xl,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: colors.background,
  },
  titleBlock: { gap: spacing.sm },
  tagRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  basePrice: { marginLeft: 'auto' },
  groupBlock: { gap: spacing.sm },
  instructions: {
    minHeight: 88,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
    ...typography.body,
    color: colors.textPrimary,
  },
  allergens: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  allergenText: { flex: 1 },
  recommended: { marginHorizontal: -spacing.lg },
  carousel: { gap: spacing.md, paddingHorizontal: spacing.gutter },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cta: { flex: 1 },
});
