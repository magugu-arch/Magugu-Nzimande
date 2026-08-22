import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { BrandMark } from '@/components/brand/BrandMark';
import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

/**
 * Splash / route gate.
 *
 * Zustand's persist middleware hydrates asynchronously, so the branded splash
 * holds until we know whether to route to onboarding or the main app. Without
 * this gate a returning customer would flash the onboarding screen on launch.
 */
export default function SplashRoute() {
  const hasHydrated = useAuthStore.persist.hasHydrated();
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);

  useEffect(() => {
    // No-op subscription keeps the component re-rendering once hydration lands.
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => undefined);
    return unsubscribe;
  }, []);

  if (hasHydrated) {
    return <Redirect href={hasCompletedOnboarding ? '/(tabs)/home' : '/(onboarding)/welcome'} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <BrandMark size="lg" onDark />
      <Text variant="caption" color={colors.textOnDarkMuted} align="center">
        Korean fried chicken, done properly
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    backgroundColor: colors.primary,
  },
});
