import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function CheckoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.backgroundAlt },
      }}
    />
  );
}
