import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { HandoffScreen } from '@/features/auth/HandoffScreen';
import { SignInCancelled, finishWebSignIn } from '@/features/auth/sso';
import { useSession } from '@/state/session';

/**
 * Where NMU SSO sends the web build back to with a one-time code. The code
 * is exchanged once, with the verifier this tab kept, and the person lands
 * on Home.
 *
 * On iOS and Android the system's authentication session returns the code
 * to the sign-in screen directly; this route only opens there if the
 * redirect arrives after the app was closed, and then it starts over.
 */
export default function AuthCallback() {
  const router = useRouter();
  const status = useSession((s) => s.status);
  const signInWithCode = useSession((s) => s.signInWithCode);
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (Platform.OS !== 'web') {
      router.replace(useSession.getState().status === 'signed-in' ? '/home' : '/sign-in');
      return;
    }
    void (async () => {
      try {
        await signInWithCode(finishWebSignIn(globalThis.location.href));
        router.replace('/home');
      } catch (e) {
        // Already signed in (Back after signing in): nothing to finish.
        if (useSession.getState().status === 'signed-in') {
          router.replace('/home');
        } else if (e instanceof SignInCancelled) {
          router.replace('/sign-in');
        } else {
          setProblem(
            e instanceof Error && e.message
              ? e.message
              : 'NMU SSO didn’t complete the sign-in. Please try again.',
          );
        }
      }
    })();
  }, [router, signInWithCode]);

  return (
    <HandoffScreen
      message={status === 'signing-in' ? 'Verifying with NMU SSO…' : 'Signing you in…'}
      problem={problem}
      onBack={() => router.replace('/sign-in')}
      testID="auth-callback"
    />
  );
}
