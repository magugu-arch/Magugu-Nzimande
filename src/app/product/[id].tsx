import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  FavouriteButton,
  LoadingState,
  OfflineState,
  QuantityStepper,
  Section,
  Text,
} from '@/components/ui';
import { isOfflinePending } from '@/features/system/queryPhase';
import { isNotFound } from '@/services/apiClient';
import { NutritionPanel } from '@/features/menu/components/NutritionPanel';
import {
  isSoldOut,
  orderableFirst,
  SOLD_OUT_LABEL,
  soldOutReason,
} from '@/features/menu/availability';
import { OptionGroupPicker } from '@/features/menu/components/OptionGroupPicker';
import { ProductCard } from '@/features/menu/components/ProductCard';
import { useProduct, useProductsByIds } from '@/features/menu/hooks';
import { track } from '@/ux/analytics';
import { useCartStore } from '@/store/cartStore';
import { colors, radius, spacing, MIN_TOUCH_TARGET, typography } from '@/theme';
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

  /**
   * The catalogue's ranking, with today's stock applied over it. See
   * `orderableFirst` — the row used to lead with what nobody could buy.
   */
  const suggestions = useMemo(() => orderableFirst(recommended.data ?? []), [recommended.data]);

  /**
   * §15 `view_item` — the numerator of "top items" and the step add_to_cart is
   * measured against.
   *
   * Keyed on the product id rather than fired once on mount, because a
   * recommendation on this screen navigates to another product without
   * unmounting it. Fired once per product either way: the ref remembers which
   * one was last announced.
   */
  const announcedProductId = useRef<string | null>(null);
  useEffect(() => {
    const viewed = product.data;
    if (!viewed || announcedProductId.current === viewed.id) return;
    announcedProductId.current = viewed.id;
    track('view_item', {
      productId: viewed.id,
      categoryId: viewed.categoryId,
      price: viewed.basePrice,
    });
  }, [product.data]);

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

      /**
       * Which options people actually change, and what it costs them — the
       * question behind "should this add-on be a default, or is it carrying
       * the margin".
       *
       * Only the options newly *added* are reported. A size group swaps one id
       * for another on every tap, so reporting the whole selection would count
       * the untouched ones again on each change and make a rarely-picked
       * option look popular.
       */
      const previous = new Set(activeSelection[groupId] ?? []);
      const group = product.data?.optionGroups?.find((candidate) => candidate.id === groupId);
      for (const optionId of optionIds) {
        if (previous.has(optionId)) continue;
        const option = group?.options.find((candidate) => candidate.id === optionId);
        track('select_modifier', {
          productId: product.data?.id ?? '',
          groupId,
          optionId,
          priceDelta: option?.priceDelta ?? 0,
        });
      }

      setSelection({ ...activeSelection, [groupId]: optionIds });
    },
    [activeSelection, product.data],
  );

  const handleAddToCart = useCallback(() => {
    if (!product.data) return;
    // The guard as well as the disabled button: a screen reader can still
    // activate a control, and `reconcileCart` would drop the line anyway —
    // silently, one screen later.
    if (isSoldOut(product.data)) return;

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

  // Offline is not "this item is gone".
  if (isOfflinePending(product)) {
    return (
      <View style={styles.stateRoot}>
        <StatusBar style="dark" />
        <OfflineState onRetry={() => void product.refetch()} />
        <View style={styles.stateAction}>
          <Button label="Back to the menu" onPress={() => router.replace('/(tabs)/menu')} />
        </View>
      </View>
    );
  }

  if (product.isError || !product.data) {
    // Only a 404 licenses the claim that the item was delisted. Every other
    // failure — a timeout, a dead host, a 500 — is the app's problem, and
    // saying "it may have come off the menu" invents a fact to explain it.
    const delisted = isNotFound(product.error) || (!product.isError && !product.data);

    return (
      <View style={styles.stateRoot}>
        <StatusBar style="dark" />
        {delisted ? (
          <ErrorState
            title="We can't find that item"
            message="It may have come off the menu. Browse what we have instead."
            onRetry={() => void product.refetch()}
          />
        ) : (
          <ErrorState onRetry={() => void product.refetch()} />
        )}
        <View style={styles.stateAction}>
          <Button label="Back to the menu" onPress={() => router.replace('/(tabs)/menu')} />
        </View>
      </View>
    );
  }

  const item = product.data;
  /**
   * A withdrawn product cannot be added, and the button has to say so rather
   * than offer the basket and let the cart refuse later.
   *
   * `Product.available` was read only by `reorder` and `reconcileCart`, so
   * this screen offered "Add to cart R 82.00" for something the kitchen has
   * none of. Sold out outranks an unmet required group: there is no point
   * telling somebody to choose a size for a dish nobody can cook.
   */
  const soldOut = isSoldOut(item);
  const ctaLabel = soldOut
    ? SOLD_OUT_LABEL
    : unmetGroups.length > 0
      ? `Choose ${unmetGroups[0]?.name.toLowerCase()}`
      : 'Add to cart';

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

          <FavouriteButton
            productId={item.id}
            productName={item.name}
            onImage
            style={[styles.floatingButton, styles.favourite, { top: insets.top + spacing.sm }]}
            testID="product-favourite"
          />

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
              {/*
                First, and instead of the others. "New" beside "Sold out" reads
                as an invitation to a dish the kitchen cannot make.
              */}
              {soldOut ? <Badge label={SOLD_OUT_LABEL} tone="warning" /> : null}
              {!soldOut && item.tags.includes('bestseller') ? (
                <Badge label="Bestseller" tone="dark" />
              ) : null}
              {!soldOut && item.tags.includes('new') ? <Badge label="New" tone="primary" /> : null}
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

            {/*
              Said in a sentence, above the options, not only on the button at
              the bottom of a long screen. Somebody who has scrolled through
              three option groups and typed a note to the kitchen should not
              meet the news at the end.
            */}
            {soldOut ? (
              <View style={styles.allergens} testID="product-sold-out">
                <Ionicons name="alert-circle-outline" size={17} color={colors.status.warning} />
                <Text variant="caption" color={colors.textSecondary} style={styles.allergenText}>
                  {soldOutReason(item)}
                </Text>
              </View>
            ) : null}

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

          {/*
            Allergens — and the shared-kitchen notice, which is not conditional
            on there being a declared allergen.

            The whole block used to sit behind `allergens.length > 0`, so the
            one product in the catalogue with an empty list showed nothing at
            all. That product is Sweet Potato Fries. French Fries beside it
            declares Gluten, which for a plain potato can only be the fryer —
            so the two fries disagree about a kitchen they share, and the one
            that says nothing is the one that also loses the sentence telling
            somebody to ask.

            An empty list is a gap in the data, not a statement that the item
            is free of anything, and the screen must not read as the second.
            `audit:launch` carries the missing data as a blocker; this makes
            sure a customer is not quietly told less in the meantime.
          */}
          <View style={styles.allergens}>
            <Ionicons name="information-circle-outline" size={17} color={colors.textMuted} />
            <Text variant="caption" color={colors.textSecondary} style={styles.allergenText}>
              {item.allergens.length > 0
                ? `Contains ${item.allergens.join(', ').toLowerCase()}. Prepared in a kitchen that handles other allergens.`
                : 'Allergen details for this item are not confirmed — please check with the store. Prepared in a kitchen that handles other allergens.'}
            </Text>
          </View>

          {/*
            Nutrition, or the sentence that says there isn't any.

            `nutrition` is optional and all 28 products carried it, so this
            ternary had only ever taken the first branch. On the second the
            panel simply vanished: no heading, no note, nothing between the
            allergen line and "Goes well with" to say the figures were missing
            rather than nil.

            Sweet Potato Fries is where that became visible, and it is the
            product that makes the inconsistency plain. Its `allergens` are
            empty and the line above says so in words, because an empty list is
            a gap in the data rather than a claim about the food. The same is
            true of absent nutrition — and it was the half that stayed silent.
            One product, two datasets the franchise has not confirmed, and only
            one of them admitted it.

            `audit:launch` carries the missing figures as a blocker. This makes
            sure a customer is not quietly told less in the meantime.
          */}
          {item.nutrition ? (
            <NutritionPanel nutrition={item.nutrition} serves={item.serves} />
          ) : (
            <View style={styles.allergens} testID="nutrition-unconfirmed">
              <Ionicons name="information-circle-outline" size={17} color={colors.textMuted} />
              <Text variant="caption" color={colors.textSecondary} style={styles.allergenText}>
                Nutritional information for this item is not confirmed — please check with the
                store.
              </Text>
            </View>
          )}

          {/* Recommended add-ons */}
          {suggestions.length > 0 ? (
            <Section title="Goes well with" bleed style={styles.recommended}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carousel}
              >
                {suggestions.map((suggestion) => (
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
          disabled={soldOut}
          trailingLabel={soldOut || unmetGroups.length > 0 ? undefined : formatPrice(lineTotal)}
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
    left: spacing.gutter,
    // 44, not 40. It floated over the photograph and cost no layout to grow,
    // so there was no reason for it to be four points short of §22.9.
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  // Mirrors the back button across the hero. The scrim comes from onImage,
  // so the white pill is overridden here rather than inherited.
  favourite: { left: undefined, right: spacing.gutter, backgroundColor: colors.scrim },
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
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  // minWidth is what makes the wrap happen: below it the CTA drops to its own
  // row rather than sharing one with the stepper and squeezing to nothing.
  // 254 is measured, not guessed — "Add to cart" plus a four-figure price plus
  // §22.4's 32pt padding either side. On a phone that always wraps, which is
  // the right answer; a tablet has room for both on one row and keeps them.
  cta: { flex: 1, minWidth: 254 },
});
