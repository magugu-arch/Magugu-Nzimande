import type { Metadata } from 'next';
import { RequireTier } from '@/components/RequireTier';
import { ApplicationsScreen } from './ApplicationsScreen';

export const metadata: Metadata = { title: 'My applications' };

export default function ApplicationsPage() {
  return (
    <RequireTier tier="A2" reason="see your applications">
      <ApplicationsScreen />
    </RequireTier>
  );
}
