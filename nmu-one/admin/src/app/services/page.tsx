import type { Metadata } from 'next';
import { Services } from '@/views/Services';

export const metadata: Metadata = { title: 'Service directory' };

export default function Page() {
  return <Services />;
}
