import { router } from 'expo-router';
import { EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState
        icon="compass"
        title="This page has moved on"
        body="Let us take you back to the table."
        action="Return home"
        onAction={() => router.replace('/home')}
      />
    </Screen>
  );
}
