import type { Metadata } from 'next';
import { RequireTier } from '@/components/RequireTier';
import { SecurityScreen } from './SecurityScreen';

export const metadata: Metadata = { title: 'Sign-in and security' };

export default function SecurityPage() {
  return (
    <RequireTier reason="see your sign-in and security settings">
      <SecurityScreen />
    </RequireTier>
  );
}
