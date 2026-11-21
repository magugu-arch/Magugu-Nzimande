import type { Metadata } from 'next';
import { RequireTier } from '@/components/RequireTier';
import { PreferencesScreen } from './PreferencesScreen';

export const metadata: Metadata = { title: 'Choose how we contact you' };

export default function PreferencesPage() {
  return (
    <RequireTier tier="A2" reason="choose how we contact you">
      <PreferencesScreen />
    </RequireTier>
  );
}
