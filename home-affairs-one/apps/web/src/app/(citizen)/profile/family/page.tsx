import type { Metadata } from 'next';
import { RequireTier } from '@/components/RequireTier';
import { FamilyScreen } from './FamilyScreen';

export const metadata: Metadata = { title: 'Family and delegates' };

export default function FamilyPage() {
  return (
    <RequireTier tier="A2" reason="see the people linked to your account">
      <FamilyScreen />
    </RequireTier>
  );
}
