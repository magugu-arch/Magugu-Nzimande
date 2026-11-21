import type { Metadata } from 'next';
import { RequireRole } from '@/components/RequireTier';
import { AuditScreen } from './AuditScreen';

export const metadata: Metadata = { title: 'Audit log' };

export default function StaffAuditPage() {
  return (
    <RequireRole role="staff" signInHref="/staff/">
      <AuditScreen />
    </RequireRole>
  );
}
