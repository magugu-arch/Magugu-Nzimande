import { useRouter } from 'expo-router';
import { BackHeader, EmptyState, Screen } from '@/components';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen topInset={false} header={<BackHeader />}>
      <EmptyState
        icon="compass-outline"
        title="This page isn’t here"
        body="The link may be out of date."
        action={{ label: 'Go home', onPress: () => router.replace('/home') }}
      />
    </Screen>
  );
}
