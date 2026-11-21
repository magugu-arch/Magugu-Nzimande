import { LoadingState } from '@hao/design-system';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInScreen } from './SignInScreen';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    // useSearchParams needs a Suspense boundary in a static export.
    <Suspense fallback={<LoadingState label="Loading sign-in" rows={2} />}>
      <SignInScreen />
    </Suspense>
  );
}
