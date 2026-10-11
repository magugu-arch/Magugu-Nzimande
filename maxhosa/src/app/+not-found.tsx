import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/States';

export default function NotFound() {
  return (
    <Screen title="Not found">
      <EmptyState
        icon="compass-outline"
        title="This page doesn’t exist"
        body="The link may be old or mistyped."
        action={{ label: 'Go to Home', onPress: () => router.replace('/') }}
      />
    </Screen>
  );
}
