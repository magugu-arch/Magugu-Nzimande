import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { queryClient } from '@/data/queryClient';
import { brandFonts } from '@/design/fonts';
import { colors, MAX_CONTENT_WIDTH, useReduceMotion } from '@/design';
import { configureNotificationHandler } from '@/features/notifications/delivery';
import { InAppBanner, OfflineBanner } from '@/features/system/Banners';
import { ErrorBoundary } from '@/features/system/ErrorBoundary';
import { startConnectivityMonitoring } from '@/state/connectivity';
import { useSession } from '@/state/session';

void SplashScreen.preventAutoHideAsync();
configureNotificationHandler();
startConnectivityMonitoring();

/**
 * Root: fonts, providers, and the authentication boundary. Everything a
 * signed-in person can reach lives under (app) and is unreachable — by link,
 * deep link or back gesture — until there is a session (brief §30
 * "sensitive routes require authentication").
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(brandFonts);
  const status = useSession((s) => s.status);
  const restore = useSession((s) => s.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  const ready = (fontsLoaded || !!fontError) && status !== 'restoring';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <Shell />
          </ErrorBoundary>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const signedIn = useSession((s) => s.status === 'signed-in');
  const reduceMotion = useReduceMotion();

  return (
    // On the web and on tablets the phone layout centres rather than stretching.
    <View style={styles.outer}>
      <View style={styles.column}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: reduceMotion ? 'fade' : 'default',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          {/* Returns from NMU SSO and the payment provider: reachable either side of sign-in. */}
          <Stack.Screen name="auth/callback" options={{ animation: 'fade' }} />
          <Stack.Screen name="payments/return" options={{ animation: 'fade' }} />
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
          </Stack.Protected>
        </Stack>
        <OfflineBanner />
        <InAppBanner />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  outer: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#DCDBD3' : colors.background,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? MAX_CONTENT_WIDTH : undefined,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
});
