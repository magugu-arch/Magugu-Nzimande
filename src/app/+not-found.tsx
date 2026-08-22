import { useRouter } from 'expo-router';
import { Button, EmptyState, Screen } from '@/components/ui';
import { spacing } from '@/theme';

/** Catch-all for unknown routes and stale deep links. */
export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen edges={['top', 'bottom']} testID="not-found-screen">
      <EmptyState
        icon="help-circle-outline"
        title="This page has moved on"
        message="We couldn't find what you were looking for. It may have been taken off the menu."
      />
      <Button
        label="Back to home"
        onPress={() => router.replace('/(tabs)/home')}
        style={{ marginBottom: spacing.lg }}
      />
    </Screen>
  );
}
