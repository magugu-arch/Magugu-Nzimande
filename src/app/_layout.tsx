import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { startFavouritesSync } from '@/features/favourites/sync';
// Imported per weight, not from the package root. The root barrel `require()`s
// all eighteen Montserrat cuts and every Cinzel weight, and Metro follows it —
// roughly 6MB of fonts to ship the ten the type scale actually names.
import { Montserrat_300Light } from '@expo-google-fonts/montserrat/300Light';
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular';
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold';
import { Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat/800ExtraBold';
import { Montserrat_900Black } from '@expo-google-fonts/montserrat/900Black';
import { Cinzel_400Regular } from '@expo-google-fonts/cinzel/400Regular';
import { Cinzel_600SemiBold } from '@expo-google-fonts/cinzel/600SemiBold';
import { Allura_400Regular } from '@expo-google-fonts/allura/400Regular';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/system/OfflineBanner';
import { DemoPricesBanner } from '@/components/system/DemoPricesBanner';
import { useAppFocus } from '@/features/system/useAppFocus';
import { useReduceMotion } from '@/features/system/useReduceMotion';
import { useSessionExpiry } from '@/features/system/useSessionExpiry';
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
 *
 * `refetchOnWindowFocus: false` covers returning to the app. What it does not
 * cover is polling while away — that is decided by the focus manager, which
 * `useAppFocus` wires to AppState below.
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

/**
 * The Pappas type system — CI sheet panel 04 and brief §3.
 *
 * Three faces and no more: Cinzel for display and editorial, Montserrat for
 * every piece of product UI, Allura for a single accent phrase. Nothing else
 * is loaded, so nothing silently falls back to a platform face.
 *
 * Only the two Cinzel cuts the scale names are bundled. Cinzel ships six
 * weights and the heavier ones are never used — at heading sizes they close
 * up the counters and the face starts reading as a logo rather than as type.
 */
const brandFonts = {
  Montserrat_300Light,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  Montserrat_900Black,
  Cinzel_400Regular,
  Cinzel_600SemiBold,
  Allura_400Regular,
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(brandFonts);

  useEffect(() => {
    // Hold the splash until the brand faces are in memory, so the first frame
    // is not a flash of the system font reflowing into Montserrat. A font that
    // fails to load must not take the app down with it: `useFonts` reports the
    // error, the app falls back to the platform face, and the splash lifts.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Push hearted products to the account as they change. Started once, for the
  // life of the app, because the store it listens to outlives every screen —
  // a heart can be given on the menu, the product page or a reorder row.
  useEffect(() => startFavouritesSync(), []);

  if (!fontsLoaded && !fontError) return null;

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
  useAppFocus();
  // Reduce Motion is on for vestibular disorders and motion sickness. A screen
  // sliding in from the edge is exactly what that setting exists to stop, so
  // the whole stack cross-fades instead. 'none' would be the other reading,
  // but a fade still shows that the screen changed.
  const reduceMotion = useReduceMotion();
  const transition = reduceMotion ? 'fade' : 'slide_from_right';

  useSessionExpiry();
  usePushRegistration();
  useNotificationRouting();
  useInitialNotificationRoute();

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: transition,
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen
          name="cart"
          options={{ animation: reduceMotion ? 'fade' : 'slide_from_bottom' }}
        />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="order" />
        <Stack.Screen name="account" />
      </Stack>

      <DemoPricesBanner />
      <OfflineBanner />
    </View>
  );
}
