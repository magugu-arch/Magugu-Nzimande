import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Imported per weight: the package root would pull in every Playfair cut.
import { PlayfairDisplay_500Medium } from '@expo-google-fonts/playfair-display/500Medium';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DemoBanner } from '@/components/DemoBanner';
import { ToastHost } from '@/components/Toast';
import { ThemeProvider, useTheme } from '@/design/theme';
import { isDemo } from '@/providers';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({ PlayfairDisplay_500Medium });

  useEffect(() => {
    // A font that fails to load must not hold the app: fall back and go.
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Sheets are the platform's own (UISheetPresentationController on iOS), so
 * dragging, flicking, detents and the parent scaling back behave exactly as
 * the rest of iOS does — fully interruptible, velocity-aware. Pushed screens
 * use the native stack and its edge-swipe back. Under Reduce Motion pushes
 * cross-fade instead of sliding.
 */
function Shell() {
  const { colors, scheme } = useTheme();
  const reduced = useReducedMotion();
  const sheet = (detents: number[] | 'fitToContents') => ({
    presentation: 'formSheet' as const,
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    sheetCornerRadius: 24,
    contentStyle: { backgroundColor: colors.card },
  });
  // The demo strip is ink-coloured, so status-bar text inverts while it shows.
  const statusStyle = isDemo
    ? scheme === 'dark'
      ? 'dark'
      : 'light'
    : scheme === 'dark'
      ? 'light'
      : 'dark';

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <StatusBar style={statusStyle} />
      <DemoBanner />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
            animation: reduced ? 'fade' : 'default',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="bag" options={sheet([1])} />
          <Stack.Screen name="checkout" options={sheet('fitToContents')} />
          <Stack.Screen name="filters" options={sheet([0.75, 1])} />
          <Stack.Screen name="size-guide/[id]" options={sheet('fitToContents')} />
          <Stack.Screen name="market" options={sheet('fitToContents')} />
          <Stack.Screen name="delivery-preferences/[id]" options={sheet('fitToContents')} />
          <Stack.Screen name="about" options={sheet([0.75, 1])} />
          <Stack.Screen
            name="zoom/[asset]"
            options={{
              presentation: 'transparentModal',
              animation: 'fade',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
        </Stack>
      </View>
      <ToastHost />
    </View>
  );
}
