import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { HandoffScreen } from '@/features/auth/HandoffScreen';

/**
 * Where the payment provider sends a person back to. On the web this page
 * opens in the provider's window: it passes the result to the NMU ONE tab
 * that is waiting for it, and that tab closes this window and shows the
 * receipt. On iOS and Android the system browser returns the result to the
 * payment sheet directly; this route only opens if the app was closed in
 * the meantime, and then it goes Home, where the fee or order shows its
 * current state.
 */
export default function PaymentReturn() {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (Platform.OS === 'web') {
      try {
        if (WebBrowser.maybeCompleteAuthSession().type === 'success') return;
      } catch {
        // The NMU ONE tab that started the payment is gone.
      }
    }
    router.replace('/');
  }, [router]);

  return <HandoffScreen message="Returning to NMU ONE…" testID="payment-return" />;
}
