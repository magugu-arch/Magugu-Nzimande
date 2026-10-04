import { Redirect } from 'expo-router';
import { useSession } from '@/state/session';

/** The anchor route: where protected-route redirects land. */
export default function Index() {
  const signedIn = useSession((s) => s.status === 'signed-in');
  return <Redirect href={signedIn ? '/home' : '/sign-in'} />;
}
