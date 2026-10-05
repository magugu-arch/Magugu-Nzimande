import type { Metadata } from 'next';
import { Analytics } from '@/views/Analytics';

export const metadata: Metadata = { title: 'Analytics' };

export default function Page() {
  return <Analytics />;
}
