import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Per-weight imports: the package roots pull in every cut of each family.
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BarlowCondensed_700Bold_Italic } from '@expo-google-fonts/barlow-condensed/700Bold_Italic';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono/400Regular';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono/500Medium';
import { resolution } from '@/config/env';
import { ConfigErrorScreen } from '@/features/system/ConfigErrorScreen';
import { isExpired, useSession } from '@/state/session';
import { color } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

const fonts = {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_700Bold_Italic,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  DMMono_400Regular,
  DMMono_500Medium,
};

export default function RootLayout() {
  const [loaded, error] = useFonts(fonts);

  useEffect(() => {
    // A font that fails must not hold the app hostage: fall back and go.
    if (loaded || error) void SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  // Misconfiguration is fatal and explained, never papered over with demo data.
  if (resolution.problems.length > 0) return <ConfigErrorScreen problems={resolution.problems} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Shell />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Ends a session the moment it expires, on resume or while open. */
function useSessionExpiry() {
  const router = useRouter();
  useEffect(() => {
    const check = () => {
      const { session, signOut } = useSession.getState();
      if (session && isExpired(session)) {
        signOut('expired');
        queryClient.clear();
        router.replace('/sign-in');
      }
    };
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    const timer = setInterval(check, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [router]);
}

function Shell() {
  useSessionExpiry();
  const reduceMotion = useReducedMotion();
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.bg },
          // Reduce Motion: cross-fade instead of sliding whole screens.
          animation: reduceMotion ? 'fade' : 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="fan/new"
          options={{ animation: reduceMotion ? 'fade' : 'slide_from_bottom', gestureEnabled: true }}
        />
      </Stack>
    </View>
  );
}
