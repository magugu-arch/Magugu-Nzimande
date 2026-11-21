import type { Metadata } from 'next';
import { RequireTier } from '@/components/RequireTier';
import { InboxScreen } from './InboxScreen';

export const metadata: Metadata = { title: 'Messages' };

export default function MessagesPage() {
  return (
    <RequireTier tier="A2" reason="read your messages">
      <InboxScreen />
    </RequireTier>
  );
}
