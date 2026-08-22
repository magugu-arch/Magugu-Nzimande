import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function OrderLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.backgroundAlt },
      }}
    >
      {/* Confirmation replaces checkout, so it must not slide back into it. */}
      <Stack.Screen
        name="[id]/confirmation"
        options={{ animation: 'fade', gestureEnabled: false }}
      />
    </Stack>
  );
}
