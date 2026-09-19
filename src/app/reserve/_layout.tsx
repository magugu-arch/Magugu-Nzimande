import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function ReserveLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
