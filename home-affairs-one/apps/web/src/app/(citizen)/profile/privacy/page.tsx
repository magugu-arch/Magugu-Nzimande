import type { Metadata } from 'next';
import { RequireTier } from '@/components/RequireTier';
import { PrivacyScreen } from './PrivacyScreen';

export const metadata: Metadata = { title: 'Privacy and consent' };

export default function PrivacyPage() {
  return (
    <RequireTier tier="A2" reason="see your consent receipts">
      <PrivacyScreen />
    </RequireTier>
  );
}
