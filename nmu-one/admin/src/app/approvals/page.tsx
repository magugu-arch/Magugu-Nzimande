import type { Metadata } from 'next';
import { Approvals } from '@/views/Approvals';

export const metadata: Metadata = { title: 'Approvals' };

export default function Page() {
  return <Approvals />;
}
