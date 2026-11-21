import { LoadingState } from '@hao/design-system';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CallbackScreen } from './CallbackScreen';

export const metadata: Metadata = { title: 'Request a call-back' };

export default function CallbackPage() {
  return (
    // The screen reads `?case=`; useSearchParams needs a Suspense boundary in a static export.
    <Suspense fallback={<LoadingState label="Loading the call-back form" rows={3} />}>
      <CallbackScreen />
    </Suspense>
  );
}
