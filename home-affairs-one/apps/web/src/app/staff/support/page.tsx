import type { Metadata } from 'next';
import { RequireRole } from '@/components/RequireTier';
import { SupportScreen } from './SupportScreen';

export const metadata: Metadata = { title: 'Support requests' };

export default function StaffSupportPage() {
  return (
    <RequireRole role="staff" signInHref="/staff/">
      <SupportScreen />
    </RequireRole>
  );
}
