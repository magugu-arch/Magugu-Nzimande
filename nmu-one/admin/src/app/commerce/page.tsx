import type { Metadata } from 'next';
import { Commerce } from '@/views/Commerce';

export const metadata: Metadata = { title: 'Commerce' };

export default function Page() {
  return <Commerce />;
}
