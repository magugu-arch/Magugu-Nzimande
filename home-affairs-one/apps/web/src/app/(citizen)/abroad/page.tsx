import type { Metadata } from 'next';
import { AbroadScreen } from './AbroadScreen';

export const metadata: Metadata = { title: 'South Africans abroad' };

export default function AbroadPage() {
  return <AbroadScreen />;
}
