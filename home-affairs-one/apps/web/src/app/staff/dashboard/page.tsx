import type { Metadata } from 'next';
import { RequireRole } from '@/components/RequireTier';
import { DashboardScreen } from './DashboardScreen';

export const metadata: Metadata = { title: 'Service dashboard' };

export default function StaffDashboardPage() {
  return (
    <RequireRole role="staff" signInHref="/staff/">
      <DashboardScreen />
    </RequireRole>
  );
}
