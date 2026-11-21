import type { Metadata } from 'next';
import { RequireRole } from '@/components/RequireTier';
import { QueueScreen } from './QueueScreen';

export const metadata: Metadata = { title: 'Work queue' };

export default function StaffQueuePage() {
  return (
    <RequireRole role="staff" signInHref="/staff/">
      <QueueScreen />
    </RequireRole>
  );
}
