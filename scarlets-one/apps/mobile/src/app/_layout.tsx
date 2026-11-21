import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiProvider } from '@/data/api';
import { track } from '@/lib/analytics';
import { usePrefs } from '@/state/prefs';
import { useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      gcTime: 10 * 60_000,
      // Refetching is driven by each query's own interval, tuned to how live it is.
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

export default function RootLayout() {
  const theme = useTheme();
  const hydrated = usePrefs((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    void SplashScreen.hideAsync().catch(() => undefined);
    track('app_open');
  }, [hydrated]);

  // Match the native window to the page, so nothing flashes white behind a transition.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.bg).catch(() => undefined);
  }, [theme.bg]);

  // Hold the splash until saved preferences are read, so the first frame is
  // already in the right language and theme.
  if (!hydrated) return null;

  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.bg,
      card: theme.bg,
      text: theme.text,
      border: theme.hairline,
      primary: theme.accentText,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ApiProvider>
            <ThemeProvider value={navigationTheme}>
              <Stack
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="onboarding"
                  options={{ animation: 'fade', gestureEnabled: false }}
                />
                <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
                <Stack.Screen name="quiz" options={{ presentation: 'modal' }} />
                <Stack.Screen name="fan-cam" options={{ presentation: 'modal' }} />
              </Stack>
            </ThemeProvider>
          </ApiProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
