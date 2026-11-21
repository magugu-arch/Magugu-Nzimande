import type { Metadata } from 'next';
import { RequireTier } from '@/components/RequireTier';
import { HomeScreen } from './HomeScreen';

export const metadata: Metadata = { title: 'Home' };

export default function HomePage() {
  return (
    <RequireTier reason="see your home">
      <HomeScreen />
    </RequireTier>
  );
}
