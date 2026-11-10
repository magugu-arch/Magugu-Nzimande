import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useOnboarding, useSession } from '@/state/session';
import { color } from '@/theme';

/** Entry: first run goes to the welcome screen; everyone else lands on Home. */
export default function Index() {
  const completed = useOnboarding((s) => s.completed);
  const hydrated = useOnboarding((s) => s.hydrated);
  const sessionHydrated = useSession((s) => s.hydrated);
  if (!hydrated || !sessionHydrated) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  return <Redirect href={completed ? '/home' : '/welcome'} />;
}
