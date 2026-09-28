import { usePushRegistration } from '@/features/usePushRegistration';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
// Per-weight imports: the package roots pull in every cut of each family.
import { PlayfairDisplay_400Regular } from '@expo-google-fonts/playfair-display/400Regular';
import { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display/400Regular_Italic';
import { PlayfairDisplay_500Medium } from '@expo-google-fonts/playfair-display/500Medium';
import { Montserrat_300Light } from '@expo-google-fonts/montserrat/300Light';
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular';
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold';
import { Allura_400Regular } from '@expo-google-fonts/allura/400Regular';
import { config } from '@/services/config';
import { mockBackend, mockTick, onMockPush } from '@/services/mockServer';
import { useSession } from '@/store/session';
import { colors } from '@/theme';
import { useReduceMotion } from '@/utils/useReduceMotion';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_500Medium,
    Montserrat_300Light,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Allura_400Regular,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Shell />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const reduce = useReduceMotion();
  useBackgroundServices();
  useNotificationRouting();
  usePushRegistration();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: reduce ? 'fade' : 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen
        name="dish/[id]"
        options={{ presentation: 'modal', animation: reduce ? 'fade' : 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="wine/[id]"
        options={{ presentation: 'modal', animation: reduce ? 'fade' : 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="sign-in"
        options={{ presentation: 'modal', animation: reduce ? 'fade' : 'slide_from_bottom' }}
      />
    </Stack>
  );
}

/**
 * In mock mode the app hosts the "server", so it also runs the server's
 * scheduler: reminders, retries, expiry and waitlist matching, on focus and
 * once a minute. Mock pushes surface as real local notifications on a device.
 */
function useBackgroundServices() {
  const actorId = useSession((s) => s.actor?.id);
  useEffect(() => {
    if (!config.useMockApi) return;
    void mockBackend();
    const tick = () => {
      void mockTick()
        .then(() => queryClient.invalidateQueries({ queryKey: ['notifications.inbox'] }))
        .catch(() => undefined);
    };
    const timer = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (s) => {
      focusManager.setFocused(s === 'active');
      if (s === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!config.useMockApi || Platform.OS === 'web') return;
    return onMockPush((entry) => {
      if (!actorId || entry.to !== `device:${actorId}`) return;
      void Notifications.getPermissionsAsync().then((p) => {
        if (!p.granted) return;
        return Notifications.scheduleNotificationAsync({
          content: { title: entry.subject, body: entry.body, data: { deepLink: entry.deepLink } },
          trigger: null,
        });
      });
    });
  }, [actorId]);
}

/** A tapped notification opens the screen it is about (§37 deep links). */
function useNotificationRouting() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const link = response.notification.request.content.data?.deepLink;
      if (typeof link === 'string' && link.startsWith('/')) router.push(link as never);
    });
    return () => sub.remove();
  }, []);
}
