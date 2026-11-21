import { LoadingState } from '@hao/design-system';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ComplaintScreen } from './ComplaintScreen';

export const metadata: Metadata = { title: 'Complaint or feedback' };

export default function ComplaintPage() {
  return (
    // The screen reads `?case=`; useSearchParams needs a Suspense boundary in a static export.
    <Suspense fallback={<LoadingState label="Loading the form" rows={3} />}>
      <ComplaintScreen />
    </Suspense>
  );
}
