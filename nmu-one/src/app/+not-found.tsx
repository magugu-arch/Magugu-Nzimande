import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Header, StateView, colors } from '@/design';

/** Unknown links land somewhere useful, never a blank screen. */
export default function NotFound() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Not found" fallbackHref="/" />
      <StateView
        kind="empty"
        title="That page doesn’t exist"
        body="The link may be old, or the page may have moved."
        actionLabel="Go to Home"
        onAction={() => router.replace('/')}
      />
    </View>
  );
}
