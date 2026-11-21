import type { Metadata } from 'next';
import { PartnerScreen } from './PartnerScreen';

export const metadata: Metadata = { title: 'Verification sandbox' };

export default function PartnerPage() {
  return <PartnerScreen />;
}
