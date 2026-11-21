import { LoadingState } from '@hao/design-system';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RequireTier } from '@/components/RequireTier';
import { AppointmentsScreen } from './AppointmentsScreen';

export const metadata: Metadata = { title: 'Appointments' };

export default function AppointmentsPage() {
  return (
    <RequireTier tier="A2" reason="see and book your appointments">
      {/* useSearchParams needs a Suspense boundary in a static export. */}
      <Suspense fallback={<LoadingState label="Loading your appointments" rows={3} />}>
        <AppointmentsScreen />
      </Suspense>
    </RequireTier>
  );
}
