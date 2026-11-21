import type { Metadata } from 'next';
import { RequireTier } from '@/components/RequireTier';
import { ProfileScreen } from './ProfileScreen';

export const metadata: Metadata = { title: 'Profile' };

export default function ProfilePage() {
  return (
    <RequireTier reason="see your profile">
      <ProfileScreen />
    </RequireTier>
  );
}
