import type { Metadata } from 'next';
import { RequireTier } from '@/components/RequireTier';
import { WhatsAppScreen } from './WhatsAppScreen';

export const metadata: Metadata = { title: 'WhatsApp channel' };

export default function WhatsAppPage() {
  return (
    <RequireTier tier="A2" reason="manage your WhatsApp reminders">
      <WhatsAppScreen />
    </RequireTier>
  );
}
