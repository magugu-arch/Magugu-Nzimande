import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/system/OfflineBanner';
import { startNetworkMonitoring } from '@/features/system/useNetworkStatus';
import {
  useInitialNotificationRoute,
  useNotificationRouting,
  usePushRegistration,
} from '@/features/notifications/hooks';
import { configureNotificationHandler } from '@/services/notificationService';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

// Both are process-level and must be in place before the first query runs or
// the first notification arrives, so they sit outside the component.
configureNotificationHandler();
startNetworkMonitoring();

/**
 * Query defaults tuned for a mobile ordering app: retry transient failures
 * twice, keep data warm across screen changes, and never refetch on every
 * focus (which would burn data on a metered connection).
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      // onlineManager is wired to NetInfo, so a query started offline pauses
      // and resumes on reconnect instead of burning its retries.
      networkMode: 'offlineFirst',
    },
    mutations: { retry: 0, networkMode: 'offlineFirst' },
  },
});

export default function RootLayout() {
  useEffect(() => {
    // Nothing async to wait on yet (fonts are system faces), so reveal the app
    // as soon as the first layout commits.
    void SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <AppShell />
          </ErrorBoundary>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Everything that needs router or query context lives below the providers.
 * Split out so the hooks below can use `useRouter` without the root component
 * sitting inside its own provider tree.
 */
function AppShell() {
  usePushRegistration();
  useNotificationRouting();
  useInitialNotificationRoute();

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="cart" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="order" />
        <Stack.Screen name="account" />
      </Stack>

      <OfflineBanner />
    </View>
  );
}
