import type { Metadata } from 'next';
import { Moderation } from '@/views/Moderation';

export const metadata: Metadata = { title: 'Moderation' };

export default function Page() {
  return <Moderation />;
}
