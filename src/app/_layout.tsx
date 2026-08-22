import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

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
    },
    mutations: { retry: 0 },
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
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
