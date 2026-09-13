import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
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

interface Slide {
  key: string;
  assetKey: FoodAssetKey;
  headline: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    key: 'crispy',
    assetKey: 'goldenOriginal',
    headline: 'Twice-fried. Never soggy.',
    body: 'Our signature bird is marinated overnight, hand-battered and fried twice for a crust you can hear from across the table.',
  },
  {
    key: 'glaze',
    assetKey: 'honeyGarlic',
    headline: 'Glazed to order, not in advance',
    body: 'Honey Garlic, Soy Garlic, Secret Sauce or Hot Spicy — every box is coated the moment it leaves the fryer.',
  },
  {
    key: 'rewards',
    assetKey: 'hotSpicy',
    headline: 'Order more, pay less',
    body: 'Earn a point for every rand, unlock free sides and delivery, and keep your favourites one tap away.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useAuthStore((state) => state.completeOnboarding);
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  /*
    The page width, asked for rather than remembered.

    This is a paged carousel, and the width is three separate things at once:
    how wide a slide is drawn, the divisor that turns a scroll offset back into
    a slide number, and the offset Next scrolls to. Read once at import, all
    three go stale together the moment the window changes size — a browser drag
    on the web build, a Split View on a tablet, a phone unfolding. The slides
    stop filling the viewport, the dots and the headline stop agreeing with the
    picture, and Next lands between two slides.

    Nobody would see it in a simulator, because a simulator opens at one size
    and stays there. The published web preview is exactly where somebody drags
    a window edge.
  */
  const { width } = useWindowDimensions();

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.x;
      setIndex(Math.round(offset / width));
    },
    [width],
  );

  const isLastSlide = index === SLIDES.length - 1;

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      completeOnboarding();
      router.replace('/(auth)/sign-in');
      return;
    }
    listRef.current?.scrollToOffset({ offset: (index + 1) * width, animated: true });
  }, [isLastSlide, index, width, completeOnboarding, router]);

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
          <View style={{ width }}>
            <FoodImage
              assetKey={item.assetKey}
              variant="detail"
              // The first screen of the app, on whatever connection they have.
              // These are `detail` surfaces, so they would otherwise all load
              // first and eagerly — three full-bleed photographs racing each
              // other when only one is on screen. The other two are a swipe
              // away and can wait for it.
              aboveTheFold={index === 0}
              // 1/1.25 — the slide is a quarter taller than it is wide. It was
              // written as `width / (width * 1.25)`, which is the same number
              // with the width cancelling itself out, and read as though it
              // depended on the screen.
              aspectRatio={1 / 1.25}
              rounded="none"
              withScrim
              scrimIntensity="strong"
              style={[styles.image, { width }]}
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
  root: { flex: 1, backgroundColor: colors.brand.black },
  image: { flex: 1 },
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
    backgroundColor: colors.brand.black,
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
