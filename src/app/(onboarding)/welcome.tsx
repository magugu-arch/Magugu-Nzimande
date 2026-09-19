import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { FoodAssetKey } from '@/constants/foodAssets';
import { FoodImage } from '@/components/food/FoodImage';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button, Text } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  key: string;
  assetKey: FoodAssetKey;
  headline: string;
  body: string;
}

/**
 * §11's screen 02 — "Pappas in your pocket".
 *
 * Three slides, one per thing the app is for, drawn from §4's five customer
 * jobs: discover, reserve, belong. Ordering is deliberately not one of them —
 * it is the least surprising thing a restaurant app does, and spending a
 * slide on it would be spending the only three screens a customer reads on
 * the one they already assumed.
 *
 * Each slide takes a venue or food photograph rather than a single dish, and
 * the copy describes the restaurant rather than a product. §15's guardrail
 * about not turning Pappas into a fast-food UI starts here: the previous
 * onboarding's third slide said "Order more, pay less", which is
 * discount-first messaging in the first thirty seconds of the app.
 *
 * Nothing here states a price, a points rate or an opening hour — all three
 * are §15 inventions, and all three are what an onboarding carousel usually
 * reaches for.
 */
const SLIDES: Slide[] = [
  {
    key: 'discover',
    assetKey: 'diningRoom',
    headline: 'A taste of a brighter life',
    body: 'Greek and Mediterranean cooking on Nelson Mandela Square — olive trees, an open kitchen and a room built for long evenings.',
  },
  {
    key: 'reserve',
    assetKey: 'squareView',
    headline: 'Your table, in a few taps',
    body: 'Book, change or cancel a table without a phone call. We will remember where you like to sit.',
  },
  {
    key: 'belong',
    assetKey: 'mezedakia',
    headline: 'Good food. Great company.',
    body: 'Save your favourites, hear about new dishes first, and let us recognise you when you come back.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding);
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    setIndex(Math.round(offset / SCREEN_WIDTH));
  }, []);

  const isLastSlide = index === SLIDES.length - 1;

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      completeOnboarding();
      router.replace('/(auth)/sign-in');
      return;
    }
    listRef.current?.scrollToOffset({ offset: (index + 1) * SCREEN_WIDTH, animated: true });
  }, [isLastSlide, index, completeOnboarding, router]);

  const handleSkip = useCallback(() => {
    completeOnboarding();
    router.replace('/(auth)/sign-in');
  }, [completeOnboarding, router]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(slide) => slide.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        renderItem={({ item, index }) => (
          <View style={styles.slide}>
            <FoodImage
              assetKey={item.assetKey}
              variant="detail"
              // The first screen of the app, on whatever connection they have.
              // These are `detail` surfaces, so they would otherwise all load
              // first and eagerly — three full-bleed photographs racing each
              // other when only one is on screen. The other two are a swipe
              // away and can wait for it.
              aboveTheFold={index === 0}
              aspectRatio={SCREEN_WIDTH / (SCREEN_WIDTH * 1.25)}
              rounded="none"
              withScrim
              scrimIntensity="strong"
              style={styles.image}
            />
          </View>
        )}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <BrandMark size="sm" onDark />
        <Pressable
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          // 27x19, and `hitSlop` of 12 only reached 51x43 — one point short in
          // height on a handset, and 19 on the web build, where hitSlop does
          // nothing. Real padding, handed straight back by the margin.
          style={{ paddingVertical: 13, paddingHorizontal: 9, margin: -9, marginVertical: -13 }}
        >
          <Text variant="captionMedium" color={colors.textOnDark}>
            Skip
          </Text>
        </Pressable>
      </View>

      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, slideIndex) => (
            <View
              key={slide.key}
              style={[styles.dot, slideIndex === index ? styles.dotActive : null]}
            />
          ))}
        </View>

        <Text variant="h1" color={colors.textOnDark}>
          {SLIDES[index]?.headline ?? ''}
        </Text>
        <Text variant="body" color={colors.textOnDarkMuted}>
          {SLIDES[index]?.body ?? ''}
        </Text>

        <Button
          label={isLastSlide ? 'Get started' : 'Next'}
          onPress={handleNext}
          size="lg"
          iconRight={isLastSlide ? undefined : 'arrow-forward'}
          testID="onboarding-next"
          preserveCase
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brand.charcoal },
  slide: { width: SCREEN_WIDTH },
  image: { flex: 1, width: SCREEN_WIDTH },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.brand.charcoal,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  dots: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  dotActive: { width: 24, backgroundColor: colors.primary },
});
