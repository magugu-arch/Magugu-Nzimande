import type { Metadata } from 'next';
import { Content } from '@/views/Content';

export const metadata: Metadata = { title: 'Help content & search' };

export default function Page() {
  return <Content />;
}
