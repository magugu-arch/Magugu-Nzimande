import { PageMeta } from '@/seo/PageMeta';
import { restaurantSchema } from '@/seo/structured';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInUp, ReduceMotion } from 'react-native-reanimated';
import { Wordmark } from '@/components/brand/Wordmark';
import { Photo, Text } from '@/components/ui';
import { mockBackend } from '@/services/mockServer';
import { config } from '@/services/config';
import { colors, spacing } from '@/theme';
import { useReduceMotion } from '@/utils/useReduceMotion';
import { enter } from '@/utils/motion';

/**
 * §4 Splash: logo, subtle motion, short brand statement — then Home. Held
 * just long enough to read, and shorter with Reduce Motion.
 */
export default function Splash() {
  const reduce = useReduceMotion();
  useEffect(() => {
    const started = Date.now();
    const minimum = reduce ? 500 : 1700;
    const boot = config.useMockApi ? mockBackend().catch(() => undefined) : Promise.resolve();
    void boot.then(() => {
      const wait = Math.max(0, minimum - (Date.now() - started));
      setTimeout(() => router.replace('/home'), wait);
    });
  }, [reduce]);

  return (
    <View style={styles.root}>
      {/* The address people share; the home screen it opens is the canonical page. */}
      <PageMeta path="/home" type="restaurant.restaurant" schema={[restaurantSchema()]} />
      <Animated.View
        entering={enter(FadeIn.duration(1200).reduceMotion(ReduceMotion.System))}
        style={StyleSheet.absoluteFill}
      >
        <Photo photo="chandeliers" label="" style={StyleSheet.absoluteFill} scrim="full" />
      </Animated.View>
      <View style={styles.centre}>
        <Animated.View
          entering={enter(FadeInUp.duration(900).delay(200).reduceMotion(ReduceMotion.System))}
        >
          <Wordmark size={60} />
        </Animated.View>
        <Animated.View
          entering={enter(FadeIn.duration(900).delay(900).reduceMotion(ReduceMotion.System))}
          style={{ marginTop: spacing.xl }}
        >
          <Text variant="quote" align="center" color="text">
            A culinary journey rooted in culture,{'\n'}crafted for today.
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
});
